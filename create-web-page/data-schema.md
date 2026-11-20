# Dataset schema for `create-web-page`

The dataset is one JSON file. `build.mjs` validates it and injects it into `template.html`; the template renders everything from this data and contains no system-specific content.

Conventions:

- Ids are strings, unique inside their scope (see each view). They are used for deep links (`#<viewId>/<itemId>`), cross-links and the search palette, so keep them short and stable.
- Prose (titles, summaries, notes) is written in the output language. Identifiers, file paths, status names and code symbols are never translated.
- Everything is rendered as text. HTML in strings is shown literally, never interpreted.
- `links` is always an array of `{ "view": "<viewId>", "id": "<itemId>" }`. `id` may be omitted to link to a whole view. Every link is checked at build time.

## Top level

```json
{
  "meta": { "title": "...", "subtitle": "...", "lang": "it", "generated": "2026-11-19", "source": "docs/architecture.md" },
  "ui": { "search": "..." },
  "views": [ { "id": "map", "type": "map", "title": "..." } ]
}
```

| Field | Required | Notes |
|---|---|---|
| `meta.title` | yes | Page title and header. |
| `meta.lang` | yes | `it` and `en` have built-in UI strings. Any other code works too: provide the strings in `ui`, missing keys fall back to English. |
| `meta.subtitle`, `meta.generated`, `meta.source` | no | Shown under the title. |
| `ui` | no | Overrides the interface strings (buttons, labels). Keys are listed in the `STRINGS.en` object of `template.html`. |
| `views` | yes | Non-empty array. Each view has `id` (unique), `type`, `title`, optional `description`. The order is the tab order. |

View types: `map`, `flow`, `states`, `catalog`, `metrics`, `notes`.

## `map`

A diagram of boxes and arrows. Supports pan and zoom, group toggles, selection with neighbour highlighting, path tracing and a detail panel.

```json
{
  "id": "map", "type": "map", "title": "System map",
  "groups": [{ "id": "be", "label": "Backend", "color": "#2e9d6b" }],
  "containers": [{ "id": "be-box", "label": "backend", "x": 290, "y": 10, "w": 430, "h": 400 }],
  "nodes": [{
    "id": "session", "group": "be", "title": "Session service", "sub": "2,077 lines",
    "x": 515, "y": 45, "w": 185, "h": 56, "external": false,
    "summary": "One or two sentences.", "size": "free text",
    "files": ["path/to/file.ts:123"], "notes": ["Gotcha."],
    "extra": [{ "label": "For the migration", "text": "..." }],
    "links": [{ "view": "flow", "id": "s2" }]
  }],
  "edges": [{ "id": "e1", "from": "fe", "to": "session", "label": "RPC", "path": "M0,0 L10,10", "lx": 100, "ly": 40 }],
  "viewBox": [0, 0, 1000, 430]
}
```

- Nodes: `id`, `title`, `x`, `y`, `w`, `h` are required (numbers for the last four). `group` must exist in `groups` when groups are declared. `external: true` draws a dashed border (components outside the repository). Everything else is optional.
- Edges: `from` and `to` must be node ids. Without `path` the engine routes a straight line between the box borders and offsets parallel edges. `lx`/`ly` place the label manually. Edge ids are what `flow` steps reference.
- `containers` are dashed frames drawn behind the nodes. `viewBox` is optional and overrides the automatic framing.
- Lay nodes out on a grid with about 30-90 units between boxes. Boxes of 185x56 fit a title and one line of subtitle.

## `flow`

A step-by-step walkthrough. Each step can highlight nodes and edges of a map; highlighted edges show a moving dot.

```json
{
  "id": "flow", "type": "flow", "title": "Request flow", "mapView": "map",
  "lanes": [{ "id": "FE", "name": "FE", "sub": "frontend", "color": "#2f7fd8" }],
  "steps": [{
    "id": "s1", "title": "Create the session", "actors": ["FE", "BE"], "status": "TO_START",
    "text": "What happens.", "nodeIds": ["fe", "routes"], "edgeIds": ["e1"],
    "refs": ["file.ts:381"], "links": [{ "view": "states", "id": "TO_START" }]
  }]
}
```

- `mapView` (optional) is the id of a `map` view. When present, `nodeIds` and `edgeIds` of every step must exist in that map.
- `lanes` are the actors shown above the steps; `actors` of a step must be lane ids.
- `status` is a free label (typically the state after the step).

## `states`

A state machine drawn as a layered graph (layers from the initial states), with a simulator.

```json
{
  "id": "states", "type": "states", "title": "Session states",
  "families": ["2D", "3D"],
  "states": [{ "id": "TO_START", "description": "...", "initial": true, "terminal": false, "group": "optional", "links": [] }],
  "transitions": [
    { "from": null, "to": "TO_START", "by": "createSession", "families": ["2D", "3D"] },
    { "from": "TO_START", "to": "TO_RESET", "by": "init", "families": ["2D"], "note": "optional" },
    { "from": "*", "to": "ABORTED", "by": "error", "families": ["2D", "3D"] }
  ]
}
```

- State ids are shown as labels (`label` overrides). Mark at least one state `initial`.
- Transition `from`: a state id, `null` (entry point: the state where the machine starts, shown as a marker), or `"*"` (from any state, shown as a badge and allowed everywhere in the simulator). `to` must be a state id.
- `families` (optional) are tags such as device types or flows. Every family used by a transition must be declared in `families`. A transition without families matches every filter.
- States that cannot be reached from an initial state are placed in a last layer.

## `catalog`

A sortable, filterable table (messages, endpoints, routes, tables...).

```json
{
  "id": "messages", "type": "catalog", "title": "Messages", "groupBy": "channel",
  "columns": [
    { "key": "name", "label": "Name", "mono": true },
    { "key": "channel", "label": "Channel", "filterable": true }
  ],
  "rows": [{ "id": "msg-1", "name": "resetCompleted", "channel": "FE session", "links": [] }]
}
```

- `columns[].key` indexes the row objects. `filterable` columns get value chips; `mono` uses a monospace font.
- Rows are objects. Give every row an `id` (unique) so it can be deep-linked and found by the palette; extra keys that are not columns appear in the detail panel.
- `groupBy` (optional) is a column key; the table shows collapsible sections.

## `metrics`

Bar charts with a linear/square-root toggle and sorting.

```json
{
  "id": "size", "type": "metrics", "title": "Size",
  "series": [{ "id": "be", "title": "Backend", "unit": "lines", "description": "optional",
    "items": [{ "label": "Session", "value": 3897, "group": "Backend" }] }],
  "callouts": [{ "title": "Docs vs measured", "text": "..." }],
  "tables": [{ "title": "Tests", "columns": ["Where", "What"], "rows": [["be", "72 specs"]] }]
}
```

- `value` must be a number. `group` colours the bars and creates a legend.
- The "sum" shown is the sum of the listed items only. If the list is partial, say what the real total is in `description`.
- `tables` are plain string tables.

## `notes`

Risks, open questions, things to verify.

```json
{
  "id": "risks", "type": "notes", "title": "Risks and open points",
  "items": [{ "id": "r1", "title": "...", "text": "...", "severity": "high", "status": "verified", "links": [] }]
}
```

- `severity`: `high`, `med` or `low` (optional). `status`: `verified` or `unverified` (optional).
- Put everything that was not checked against the code in items with `"status": "unverified"`. Severity is a judgment: say so in the view `description`.

## What the build checks

`node build.mjs` reports every problem with its path (for example `views[0].nodes[2].w: must be a number`) and exits with code 1:

missing `meta.title` / `meta.lang`; unknown view type; duplicate ids (views, nodes, edges, steps, states, rows, series, notes); nodes without numeric `x y w h`; unknown node group; edges to missing nodes; `flow.mapView` that is not a map; steps pointing to missing edges or nodes; transitions with unknown states or undeclared families; links to missing views or items; non-numeric metric values; invalid `severity` or `status`.
