---
name: create-web-page
description: Generates a self-contained, interactive HTML explorer of a system's architecture (clickable map, animated flows, state machine with simulator, searchable catalogs, size charts, risk notes) from an architecture report or a codebase analysis, in the language the user chooses. Use when the user asks to "create web page", "interactive architecture", "html explorer", "visual/interactive version of the architecture", or to "regenerate the html in <language>" (for example "rigenera l'html in italiano"). Companion to explain-architecture, which writes the Markdown report.
---

# Create Web Page

Turns an architecture analysis into one offline HTML file with a data-driven engine: you write a JSON dataset, `build.mjs` validates it and injects it into `template.html`. The template contains no system-specific content, so the same engine serves any project.

Files in this skill:

| File | Purpose |
|---|---|
| `template.html` | The engine: views, command palette (Ctrl/Cmd+K), deep links, theme, self-test. |
| `build.mjs` | `node build.mjs <data.json> <out.html>`: validates and builds. |
| `data-schema.md` | Exact dataset format. Read it before writing the JSON. |
| `examples/parcel-lockers.en.json` | A small dataset for an invented system that uses every view type, useful as a model. |
| `tests/build.test.mjs` | Tests of the build script (`node --test tests/*.test.mjs`). |

## Workflow

### Step 0: ask the language (always first)

Before reading or analyzing anything, ask one question with `AskUserQuestion`:

> In which language should the page be generated?
> - **Italiano**
> - **English**
> - (Other is offered automatically)

Wait for the answer. All prose in the dataset and the interface strings use that language (`meta.lang`: `it`, `en`, or another code with a `ui` block, see `data-schema.md`). Identifiers, file paths, status names and code symbols are never translated.

### Step 1: pick the source

Use the first that applies, and ask only if it is genuinely ambiguous:

1. A report the user names (for example `docs/acquisition-architecture.md`).
2. `docs/architecture.md` if it exists.
3. Otherwise analyze the codebase the way `explain-architecture` does (entry points, layers, one traced end-to-end flow) and keep the findings as the source.

If a dataset JSON already exists next to the target HTML (`<name>.data.json`), this is a **regeneration**: skip to the section below.

### Step 2: write the dataset

Read `data-schema.md`, then write `<name>.data.json`. Rules:

- Facts only from code or from the report; take counts from commands, never estimate; versions from manifests.
- Whatever was not verified goes in a `notes` view as items with `"status": "unverified"`. Severity is a judgment; say so in the view description.
- No invented numbers. A partial list must say what the real total is.
- Connect the views with `links` (a map node to its flow step, a state to the step that enters it, a risk to the node it concerns). The palette and deep links depend on stable ids.
- Choose views that fit the system. Typical set: `map`, `flow` (one important end-to-end flow), `states` (only if there is a real state machine), `catalog` (messages, routes, tables), `metrics`, `notes`. Do not pad with views that have no data.
- Lay the map out on a grid; boxes of about 185x56 hold a title and a one-line subtitle.

### Step 3: build

```bash
node ~/.claude/skills/create-web-page/build.mjs docs/<name>.data.json docs/<name>.html
```

Validation errors are printed with their path (for example `views[0].nodes[2].w: must be a number`); fix the JSON and rebuild. Keep the JSON next to the HTML: regeneration then needs no new analysis.

### Step 4: verify, then report

The page has a built-in self-test: `<file>.html?selftest=1` drives every view (selects every node, traces a path, steps the flow, walks the simulator, sorts and filters, uses the palette, applies deep links, checks the text for rendering bugs) and sets `document.title` to `selftest:PASS` or `selftest:FAIL`, with details in `#selftest-result`.

Run it in headless Edge (Windows):

```bash
"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --virtual-time-budget=15000 \
  --dump-dom "file:///C:/path/to/docs/<name>.html?selftest=1"
```

Look for `selftest:PASS` in the output. Use the `Program Files` path if Edge is installed there instead, or Chrome's `chrome.exe` with the same flags. Also take at least one screenshot (`--screenshot=<file> --window-size=1280,900`, with a `#<viewId>` suffix to pick a view) and look at it: the self-test cannot see overlapping boxes or clipped text.

If no headless browser is available, say so and report that the page was only validated by `build.mjs`.

Finally tell the user the file path, the views included, what is unverified, and mention Ctrl+K (search) and the deep links (`#<viewId>/<itemId>`). Do not publish the page to any external service: it is a local file and often contains internal details.

## Regeneration in another language

When the user says "regenerate in <language>":

1. Ask nothing if the language is stated; otherwise ask it (Step 0).
2. Load the existing `<name>.data.json`.
3. Translate every prose string (titles, descriptions, summaries, notes, step texts, row notes, labels). Do not translate ids, paths, code symbols, status names, `meta.source` or numbers; keep the structure and ids identical so links stay valid. Set `meta.lang`.
4. Save as `<name>.<lang>.data.json` and build `<name>.<lang>.html`. Do not overwrite the original unless the user asks.
5. Verify as in Step 4.

## Rules

- The output must stay a single offline file: no CDN, no web fonts, no network calls. The template already complies; do not add external references through the data.
- Never edit `template.html` to put system data in it. Fix the dataset instead. Change the template only to add a generic capability, and then run `node --test tests/*.test.mjs` and the self-test again.
- The self-test must keep failing when something is broken: if a fix needs the test relaxed, that is a sign the fix is wrong.
- Artifacts (JSON keys, code) are in English; prose follows the language chosen in Step 0.
