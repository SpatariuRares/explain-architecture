import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, renderHtml, DATA_MARKER } from '../build.mjs';

/** Smallest dataset that exercises every view type. */
function minimal() {
  return {
    meta: { title: 'Demo', lang: 'en', subtitle: 's', generated: '2026-01-01', source: 'unit test' },
    views: [
      {
        id: 'map', type: 'map', title: 'Map', viewBox: [0, 0, 400, 200],
        groups: [{ id: 'g1', label: 'G1', color: '#2f7fd8' }],
        nodes: [
          { id: 'a', group: 'g1', title: 'A', sub: 'sub', x: 10, y: 10, w: 100, h: 50, summary: 'sum', links: [{ view: 'notes', id: 'n1' }] },
          { id: 'b', group: 'g1', title: 'B', sub: 'sub', x: 200, y: 10, w: 100, h: 50, summary: 'sum' }
        ],
        edges: [{ id: 'e1', from: 'a', to: 'b', label: 'x' }]
      },
      {
        id: 'flow', type: 'flow', title: 'Flow', mapView: 'map',
        lanes: [{ id: 'L1', name: 'L1', color: '#2f7fd8' }],
        steps: [{ id: 's1', title: 'S1', actors: ['L1'], text: 't', edgeIds: ['e1'], nodeIds: ['a', 'b'] }]
      },
      {
        id: 'states', type: 'states', title: 'States', families: ['F'],
        states: [{ id: 'X', initial: true }, { id: 'Y' }],
        transitions: [{ from: 'X', to: 'Y', by: 'go', families: ['F'] }]
      },
      {
        id: 'cat', type: 'catalog', title: 'Catalog',
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ id: 'r1', name: 'row one' }]
      },
      {
        id: 'size', type: 'metrics', title: 'Size',
        series: [{ id: 'm1', title: 'M1', unit: 'lines', items: [{ label: 'x', value: 3 }] }]
      },
      {
        id: 'notes', type: 'notes', title: 'Notes',
        items: [{ id: 'n1', title: 'N1', text: 'txt', severity: 'high', status: 'verified' }]
      }
    ]
  };
}

const has = (errors, fragment) => errors.some((e) => e.includes(fragment));

test('valid minimal data passes', () => {
  assert.deepEqual(validate(minimal()), []);
});

test('missing meta.title and meta.lang are reported with their path', () => {
  const d = minimal();
  delete d.meta.title;
  delete d.meta.lang;
  const errors = validate(d);
  assert.ok(has(errors, 'meta.title'), errors.join('\n'));
  assert.ok(has(errors, 'meta.lang'), errors.join('\n'));
});

test('unknown view type is rejected', () => {
  const d = minimal();
  d.views[0].type = 'hologram';
  assert.ok(has(validate(d), 'views[0].type'));
});

test('duplicate view ids are rejected', () => {
  const d = minimal();
  d.views[1].id = 'map';
  assert.ok(has(validate(d), 'duplicate'));
});

test('duplicate node ids are rejected', () => {
  const d = minimal();
  d.views[0].nodes[1].id = 'a';
  assert.ok(has(validate(d), 'views[0].nodes[1].id'));
});

test('node without numeric w/h is rejected', () => {
  const d = minimal();
  delete d.views[0].nodes[0].w;
  d.views[0].nodes[1].h = 'tall';
  const errors = validate(d);
  assert.ok(has(errors, 'views[0].nodes[0].w'), errors.join('\n'));
  assert.ok(has(errors, 'views[0].nodes[1].h'), errors.join('\n'));
});

test('edge endpoints must exist', () => {
  const d = minimal();
  d.views[0].edges[0].to = 'ghost';
  assert.ok(has(validate(d), 'views[0].edges[0].to'));
});

test('node group must exist when groups are declared', () => {
  const d = minimal();
  d.views[0].nodes[0].group = 'nope';
  assert.ok(has(validate(d), 'views[0].nodes[0].group'));
});

test('flow.mapView must point to a map view', () => {
  const d = minimal();
  d.views[1].mapView = 'cat';
  assert.ok(has(validate(d), 'views[1].mapView'));
});

test('flow steps must reference existing edges and nodes of the map', () => {
  const d = minimal();
  d.views[1].steps[0].edgeIds = ['ghost-edge'];
  d.views[1].steps[0].nodeIds = ['ghost-node'];
  const errors = validate(d);
  assert.ok(has(errors, 'views[1].steps[0].edgeIds'), errors.join('\n'));
  assert.ok(has(errors, 'views[1].steps[0].nodeIds'), errors.join('\n'));
});

test('transition endpoints must exist, except the wildcard and the entry marker', () => {
  const d = minimal();
  d.views[2].transitions.push({ from: '*', to: 'Y', by: 'any', families: ['F'] });
  d.views[2].transitions.push({ from: null, to: 'X', by: 'create', families: ['F'] });
  assert.deepEqual(validate(d), []);
  d.views[2].transitions.push({ from: 'X', to: 'ghost', by: 'bad', families: ['F'] });
  assert.ok(has(validate(d), 'views[2].transitions[3].to'));
});

test('transition families must be declared', () => {
  const d = minimal();
  d.views[2].transitions[0].families = ['Z'];
  assert.ok(has(validate(d), 'views[2].transitions[0].families'));
});

test('links must point to an existing view and item', () => {
  const d = minimal();
  d.views[0].nodes[0].links = [{ view: 'ghost-view', id: 'x' }, { view: 'notes', id: 'ghost-note' }, { view: 'notes', id: 'n1' }];
  const errors = validate(d);
  assert.ok(has(errors, 'views[0].nodes[0].links[0]'), errors.join('\n'));
  assert.ok(has(errors, 'views[0].nodes[0].links[1]'), errors.join('\n'));
  assert.ok(!has(errors, 'links[2]'), errors.join('\n'));
});

test('catalog rows must be objects and ids unique', () => {
  const d = minimal();
  d.views[3].rows.push({ id: 'r1', name: 'dup' });
  d.views[3].rows.push('not an object');
  const errors = validate(d);
  assert.ok(has(errors, 'views[3].rows[1].id'), errors.join('\n'));
  assert.ok(has(errors, 'views[3].rows[2]'), errors.join('\n'));
});

test('metrics values must be numbers', () => {
  const d = minimal();
  d.views[4].series[0].items[0].value = 'many';
  assert.ok(has(validate(d), 'views[4].series[0].items[0].value'));
});

test('notes severity and status are constrained', () => {
  const d = minimal();
  d.views[5].items[0].severity = 'apocalyptic';
  d.views[5].items[0].status = 'maybe';
  const errors = validate(d);
  assert.ok(has(errors, 'severity'), errors.join('\n'));
  assert.ok(has(errors, 'status'), errors.join('\n'));
});

test('renderHtml injects the data and leaves no placeholder', () => {
  const template = `<html><body><script type="application/json" id="data">${DATA_MARKER}</script></body></html>`;
  const html = renderHtml(minimal(), template);
  assert.ok(!html.includes(DATA_MARKER));
  assert.ok(html.includes('"title":"Demo"'));
});

test('renderHtml escapes script terminators and comment openers inside strings', () => {
  const d = minimal();
  d.meta.title = 'evil </script><script>alert(1)</script> <!-- x   y  ';
  const template = `<script type="application/json" id="data">${DATA_MARKER}</script>`;
  const html = renderHtml(d, template);
  const body = html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>'));
  assert.ok(!body.includes('</script>'), 'raw </script> leaked');
  assert.ok(!body.includes('<!--'), 'raw <!-- leaked');
  assert.ok(!body.includes(' ') && !body.includes(' '), 'raw line separators leaked');
  const roundTrip = JSON.parse(body);
  assert.equal(roundTrip.meta.title, d.meta.title);
});

test('renderHtml refuses a template without the marker', () => {
  assert.throws(() => renderHtml(minimal(), '<html></html>'), /marker/i);
});
