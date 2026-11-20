#!/usr/bin/env node
/**
 * create-web-page build script (Node >= 18, no dependencies).
 *
 *   node build.mjs <data.json> <out.html> [--template path]
 *
 * Validates the dataset, then injects it into template.html at DATA_MARKER and writes one
 * self-contained HTML file. `validate` and `renderHtml` are exported for the tests.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_MARKER = '/*__DATA__*/';

const VIEW_TYPES = ['map', 'flow', 'states', 'catalog', 'metrics', 'notes'];
const SEVERITIES = ['high', 'med', 'low'];
const STATUSES = ['verified', 'unverified'];
/** Pseudo-sources a transition may use: `null`/omitted = entry point, `*` = any state. */
const ANY_STATE = '*';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** Collects path-prefixed error messages so the author sees every problem in one run. */
class Errors {
  constructor() { this.list = []; }
  add(path, message) { this.list.push(`${path}: ${message}`); }
}

function requireString(errors, path, value) {
  if (!isNonEmptyString(value)) errors.add(path, 'must be a non-empty string');
}

/** Registers `id` in `seen`, reporting a duplicate; returns whether the id is usable. */
function registerId(errors, path, id, seen, what) {
  if (!isNonEmptyString(id)) {
    errors.add(path, 'must be a non-empty string');
    return false;
  }
  if (seen.has(id)) {
    errors.add(path, `duplicate ${what} id "${id}"`);
    return false;
  }
  seen.add(id);
  return true;
}

/** Keeps the first registration when a view id is duplicated, so one bad id cannot corrupt the lookups of the original view. */
function remember(byId, id, info) {
  if (!byId.has(id)) byId.set(id, info);
}

function forEachItem(errors, path, list, fn) {
  if (!Array.isArray(list)) {
    errors.add(path, 'must be an array');
    return;
  }
  list.forEach((item, i) => {
    if (!isObject(item)) errors.add(`${path}[${i}]`, 'must be an object');
    else fn(item, `${path}[${i}]`, i);
  });
}

function validateMap(errors, path, view, byId) {
  const groupIds = new Set((view.groups ?? []).map((g) => g?.id));
  forEachItem(errors, `${path}.groups`, view.groups ?? [], (g, p) => {
    requireString(errors, `${p}.id`, g.id);
    requireString(errors, `${p}.label`, g.label);
  });

  const nodeIds = new Set();
  forEachItem(errors, `${path}.nodes`, view.nodes, (n, p) => {
    registerId(errors, `${p}.id`, n.id, nodeIds, 'node');
    requireString(errors, `${p}.title`, n.title);
    for (const k of ['x', 'y', 'w', 'h']) if (!isNumber(n[k])) errors.add(`${p}.${k}`, 'must be a number');
    if (groupIds.size > 0 && n.group !== undefined && !groupIds.has(n.group)) {
      errors.add(`${p}.group`, `unknown group "${n.group}"`);
    }
  });

  const edgeIds = new Set();
  forEachItem(errors, `${path}.edges`, view.edges ?? [], (e, p) => {
    registerId(errors, `${p}.id`, e.id, edgeIds, 'edge');
    for (const k of ['from', 'to']) {
      if (!nodeIds.has(e[k])) errors.add(`${p}.${k}`, `unknown node "${e[k]}"`);
    }
  });
  remember(byId, view.id, { nodeIds, edgeIds, items: nodeIds });
}

function validateFlow(errors, path, view, byId, viewsById, pending) {
  const mapView = viewsById.get(view.mapView);
  if (view.mapView !== undefined && (!mapView || mapView.type !== 'map')) {
    errors.add(`${path}.mapView`, `"${view.mapView}" is not a map view`);
  }
  const stepIds = new Set();
  const laneIds = new Set((view.lanes ?? []).map((l) => l?.id));
  forEachItem(errors, `${path}.steps`, view.steps, (s, p) => {
    registerId(errors, `${p}.id`, s.id, stepIds, 'step');
    requireString(errors, `${p}.title`, s.title);
    for (const a of s.actors ?? []) {
      if (laneIds.size > 0 && !laneIds.has(a)) errors.add(`${p}.actors`, `unknown lane "${a}"`);
    }
    // The map view may be declared after the flow view, so edge/node checks run later.
    pending.push(() => {
      const target = mapView && mapView.type === 'map' ? byId.get(mapView.id) : null;
      if (!target) return;
      for (const id of s.edgeIds ?? []) if (!target.edgeIds.has(id)) errors.add(`${p}.edgeIds`, `unknown edge "${id}"`);
      for (const id of s.nodeIds ?? []) if (!target.nodeIds.has(id)) errors.add(`${p}.nodeIds`, `unknown node "${id}"`);
    });
  });
  remember(byId, view.id, { items: stepIds });
}

function validateStates(errors, path, view, byId) {
  const families = new Set(view.families ?? []);
  const stateIds = new Set();
  forEachItem(errors, `${path}.states`, view.states, (s, p) => registerId(errors, `${p}.id`, s.id, stateIds, 'state'));
  forEachItem(errors, `${path}.transitions`, view.transitions ?? [], (t, p) => {
    if (t.from !== null && t.from !== undefined && t.from !== ANY_STATE && !stateIds.has(t.from)) {
      errors.add(`${p}.from`, `unknown state "${t.from}"`);
    }
    if (!stateIds.has(t.to)) errors.add(`${p}.to`, `unknown state "${t.to}"`);
    requireString(errors, `${p}.by`, t.by);
    for (const f of t.families ?? []) {
      if (!families.has(f)) errors.add(`${p}.families`, `family "${f}" is not declared in ${path}.families`);
    }
  });
  remember(byId, view.id, { items: stateIds });
}

function validateCatalog(errors, path, view, byId) {
  forEachItem(errors, `${path}.columns`, view.columns, (c, p) => {
    requireString(errors, `${p}.key`, c.key);
    requireString(errors, `${p}.label`, c.label);
  });
  const rowIds = new Set();
  // Rows are validated by hand (not forEachItem) so the error path is the row itself.
  if (!Array.isArray(view.rows)) errors.add(`${path}.rows`, 'must be an array');
  else view.rows.forEach((r, i) => {
    const p = `${path}.rows[${i}]`;
    if (!isObject(r)) return errors.add(p, 'must be an object');
    if (r.id !== undefined) registerId(errors, `${p}.id`, r.id, rowIds, 'row');
  });
  remember(byId, view.id, { items: rowIds });
}

function validateMetrics(errors, path, view, byId) {
  const seriesIds = new Set();
  forEachItem(errors, `${path}.series`, view.series, (s, p) => {
    registerId(errors, `${p}.id`, s.id, seriesIds, 'series');
    forEachItem(errors, `${p}.items`, s.items, (it, ip) => {
      requireString(errors, `${ip}.label`, it.label);
      if (!isNumber(it.value)) errors.add(`${ip}.value`, 'must be a number');
    });
  });
  remember(byId, view.id, { items: seriesIds });
}

function validateNotes(errors, path, view, byId) {
  const noteIds = new Set();
  forEachItem(errors, `${path}.items`, view.items, (n, p) => {
    registerId(errors, `${p}.id`, n.id, noteIds, 'note');
    requireString(errors, `${p}.title`, n.title);
    if (n.severity !== undefined && !SEVERITIES.includes(n.severity)) {
      errors.add(`${p}.severity`, `must be one of ${SEVERITIES.join(', ')}`);
    }
    if (n.status !== undefined && !STATUSES.includes(n.status)) {
      errors.add(`${p}.status`, `must be one of ${STATUSES.join(', ')}`);
    }
  });
  remember(byId, view.id, { items: noteIds });
}

/** Walks the whole dataset and checks every `links` array against the collected ids. */
function validateLinks(errors, data, byId) {
  const visit = (value, path) => {
    if (Array.isArray(value)) return value.forEach((v, i) => visit(v, `${path}[${i}]`));
    if (!isObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'links' && Array.isArray(child)) checkLinks(child, `${path}.links`);
      else visit(child, `${path}.${key}`);
    }
  };
  const checkLinks = (links, path) => links.forEach((l, i) => {
    const p = `${path}[${i}]`;
    const target = isObject(l) ? byId.get(l.view) : undefined;
    if (!target) return errors.add(p, `unknown view "${l?.view}"`);
    if (l.id !== undefined && !(target.items?.has(l.id))) errors.add(p, `view "${l.view}" has no item "${l.id}"`);
  });
  visit(data.views, 'views');
}

/** Returns an array of error strings; an empty array means the dataset is valid. */
export function validate(data) {
  const errors = new Errors();
  if (!isObject(data)) return ['data: must be an object'];

  if (!isObject(data.meta)) errors.add('meta', 'must be an object');
  else {
    requireString(errors, 'meta.title', data.meta.title);
    requireString(errors, 'meta.lang', data.meta.lang);
  }

  if (!Array.isArray(data.views) || data.views.length === 0) {
    errors.add('views', 'must be a non-empty array');
    return errors.list;
  }

  const viewsById = new Map();
  const viewIds = new Set();
  data.views.forEach((v, i) => {
    if (isObject(v) && registerId(errors, `views[${i}].id`, v.id, viewIds, 'view')) viewsById.set(v.id, v);
  });

  const byId = new Map();
  const pending = [];
  data.views.forEach((view, i) => {
    const path = `views[${i}]`;
    if (!isObject(view)) return errors.add(path, 'must be an object');
    requireString(errors, `${path}.title`, view.title);
    switch (view.type) {
      case 'map': return validateMap(errors, path, view, byId);
      case 'flow': return validateFlow(errors, path, view, byId, viewsById, pending);
      case 'states': return validateStates(errors, path, view, byId);
      case 'catalog': return validateCatalog(errors, path, view, byId);
      case 'metrics': return validateMetrics(errors, path, view, byId);
      case 'notes': return validateNotes(errors, path, view, byId);
      default: return errors.add(`${path}.type`, `unknown view type "${view.type}" (expected ${VIEW_TYPES.join(', ')})`);
    }
  });
  pending.forEach((check) => check());
  validateLinks(errors, data, byId);
  return errors.list;
}

/**
 * Serializes the dataset so it is safe inside a <script> element: `<` becomes < (covers
 * `</script>` and `<!--`) and the JS-only line separators are escaped.
 */
function serializeForScript(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}

export function renderHtml(data, template) {
  if (!template.includes(DATA_MARKER)) throw new Error(`template has no ${DATA_MARKER} marker`);
  // A function replacer keeps `$&`-style sequences inside the data from being interpreted.
  return template.replace(DATA_MARKER, () => serializeForScript(data));
}

function parseArgs(argv) {
  const positional = [];
  let templatePath = join(dirname(fileURLToPath(import.meta.url)), 'template.html');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--template') templatePath = resolve(argv[++i] ?? '');
    else positional.push(argv[i]);
  }
  return { dataPath: positional[0], outPath: positional[1], templatePath };
}

function main() {
  const { dataPath, outPath, templatePath } = parseArgs(process.argv.slice(2));
  if (!dataPath || !outPath) {
    console.error('usage: node build.mjs <data.json> <out.html> [--template path]');
    process.exit(2);
  }
  let data;
  try {
    data = JSON.parse(readFileSync(dataPath, 'utf8'));
  } catch (err) {
    console.error(`cannot read ${dataPath}: ${err.message}`);
    process.exit(2);
  }
  const errors = validate(data);
  if (errors.length > 0) {
    console.error(`${errors.length} validation error(s) in ${dataPath}:`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  const html = renderHtml(data, readFileSync(templatePath, 'utf8'));
  writeFileSync(outPath, html, 'utf8');
  console.log(`wrote ${outPath} (${Buffer.byteLength(html)} bytes, ${data.views.length} views)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
