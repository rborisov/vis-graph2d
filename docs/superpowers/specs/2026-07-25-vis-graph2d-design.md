# Graph2d (vis-graph2d) — Obsidian plugin design

**Date:** 2026-07-25
**Status:** Approved

## Purpose

An Obsidian plugin that renders interactive 2D charts in notes from a
`vis-graph2d` code block, powered by [vis-timeline's Graph2d]
(https://visjs.github.io/vis-timeline/docs/graph2d/). It is a sibling to the
existing `vis-timeline` plugin (`/Volumes/docvol/timeline`) and follows its
conventions: TypeScript in `src/`, esbuild bundle to `main.js`, vitest for pure
logic, YAML-first authoring with JSON fallback.

Goals:

- Support every Graph2d chart type and every styling option the library exposes.
- Accept both YAML and JSON as block input.
- Work with time, numeric, and category x-axes.
- Ship installable via BRAT from a public GitHub repo.

Non-goals for v1: Obsidian Bases view (deferred), note-frontmatter querying.

## Architecture

Pipeline, mirroring the timeline plugin's `parser → normalizer → renderer`
shape with one new concept — an x-scale abstraction:

```
source string
  → parseBlock()        parser.ts       YAML, else JSON → RawBlock
  → loadExternal()      data-source.ts  resolve `data:` vault refs (async)
  → expandColumns()     columns.ts      columnar form → point rows
  → selectScale()       x-scale.ts      TimeScale | NumericScale | CategoryScale
  → compileGroups()     series.ts       friendly style fields → vis style/options
  → normalize()         normalizer.ts   → { items, groups, visOptions }
  → renderGraph2d()     renderer.ts     construct Graph2d, return handle
```

### Module layout

```
src/
  main.ts          Plugin lifecycle: register code block processor + settings tab
  parser.ts        YAML→JSON fallback → RawBlock
  data-source.ts   Resolve `data:` vault-file refs (CSV / JSON / YAML), async
  columns.ts       Expand compact columnar form into point rows
  x-scale.ts       XScale interface + Time / Numeric / Category implementations
  series.ts        Group style compilation (friendly fields → vis style/options)
  normalizer.ts    Raw items + groups → vis-ready datasets
  renderer.ts      Graph2d construction, option merge, redraw/destroy handle
  rasterize.ts     PNG export path (ported from the timeline plugin)
  settings.ts      Settings interface, defaults, settings tab
  types.ts         Shared interfaces
```

Each file stays under ~300 lines per the repo convention inherited from
`AGENTS.md`. `main.ts` holds lifecycle only.

### The XScale abstraction

Graph2d only understands a time range — it inherits vis-timeline's range and
zoom machinery, so internal x values are always epoch milliseconds. Numeric and
category modes are therefore *mappings onto* that time range, hidden behind one
interface:

```ts
interface XScale {
  toInternal(value: unknown): number;        // author x value → epoch ms
  formatLabel(value: MomentLike): string;    // axis position → displayed label
  axisHints(dataRange): Partial<VisOptions>; // timeAxis / label visibility
}
```

`formatLabel` takes `MomentLike` (`{ valueOf(): number }`), **not** `Date`. vis
invokes the label callback with its internal **moment** object, which has no
`getTime()`. `valueOf()` is the one accessor both moment and `Date` share, so
this signature works in production and lets tests pass plain `Date`s.

The renderer consumes an `XScale` and never branches on axis mode.

- **TimeScale** — identity. Dates and date strings pass through to vis
  unchanged; labels use vis's own formatting and `locale`.
- **NumericScale** — 1 x-unit maps to 1 day of internal epoch time (86400000
  ms), anchored at epoch 0. `formatLabel` converts back to the number. Emits
  `showMajorLabels: false` and an explicit `timeAxis: { scale: 'day', step: N }`
  computed from the data range. The explicit step matters: without it vis
  selects month/year scales, which would render as axis labels of 30 and 365.
  Step N is chosen from the 1/2/5/10 decade sequence so roughly 6–12 labels fit
  the range.
- **CategoryScale** — NumericScale plus an index→name lookup. Category strings
  are assigned indices in first-appearance order; `formatLabel` returns the
  name, out-of-range indices return empty string. `timeAxis.step` is 1.

Label rewriting uses vis's `format.minorLabels` function hook. **Risk resolved
during planning** — verified directly against the bundled library:

- `TimeStep.getLabelMinor` honours a function, so the hook works.
- The callback receives a **moment**, not a `Date` (hence `MomentLike` above).
- `Graph2d.setOptions` always runs vis's option validator, whose schema permits
  only an object at `format.minorLabels`. Passing a function renders correctly
  but logs a spurious "Errors have been found in the supplied options object."
  on every redraw. The formatter is therefore applied through
  `Core.prototype.setOptions` — the same code path without the validator,
  reachable because `Graph2d.prototype` is itself a `Core` instance.

## Block schema

Language: `vis-graph2d`. YAML is parsed first; on failure the source is retried
as JSON. A bare top-level array is treated as `items` (matching the timeline
plugin's shorthand).

````markdown
```vis-graph2d
options:
  xAxis: numeric          # time (default) | numeric | category
  style: line             # default graph type for all groups
  height: 400px
  legend: true
  dataAxis:
    left:  { title: { text: "Revenue" }, range: { min: 0 } }
    right: { title: { text: "Units" } }
groups:
  - id: rev
    content: Revenue
    type: line              # friendly name for the graph type
    color: "#e11d48"
    fill: true
    width: 2
    dashes: [5, 5]
    yAxisOrientation: left
    interpolation: centripetal
    points: { style: circle, size: 6 }
  - id: units
    content: Units
    type: bar
    barChart: { sideBySide: true, align: center }
items:
  - { x: 1, y: 20, group: rev }
  - { x: 2, y: 32, group: rev }
```
````

### Accepted input shapes

All three normalize to the same internal point rows:

1. **Rows** — `items: [{ x, y, group?, end?, label? }]`
2. **Columnar** — a shared `x: [1, 2, 3]` plus per-group `y:` arrays, e.g.
   `groups: [{ id: rev, y: [20, 32, 41] }]`. A group may also carry its own `x`
   array, overriding the shared one. Ragged arrays are an error (message names
   the group and both lengths).
3. **External** — `data: [[series.csv]]` or `data: charts/series.json`, either
   at block level or on a single group. CSV requires a header row with `x` and
   `y` columns (`group` optional); JSON and YAML files must contain an array of
   row objects. Loading is asynchronous, showing an inline placeholder while in
   flight. The plugin registers a vault `modify` listener so edits to a
   referenced data file re-render dependent blocks.

### Option pass-through

Every Graph2d option not named by the friendly set passes through to vis
untouched. `sampling`, `sort`, `stack`, `zoomKey`, `zoomMin`/`zoomMax`,
`hiddenDates`, `locale`/`locales`, `showCurrentTime`, `showCustomTime`,
`min`/`max`, `moveable`, `zoomable`, `clickToUse`, `barChart.minWidth`,
`dataAxis.icons`, `dataAxis.alignZeros`, `legend.left.position`, and anything
else the library adds later all work without the plugin knowing about them. The
friendly fields are additive sugar, never a whitelist.

## Styling

### Friendly field compilation (`series.ts`)

**Naming note — the `style` collision.** vis overloads the word: at *block*
level `options.style` selects the default graph type (`'line'`, `'bar'`,
`'points'`), but on a *group* `style` is an inline CSS string and the graph type
lives at `group.options.style`. To keep both meanings reachable without
ambiguity, the plugin reserves group-level `style:` for raw CSS pass-through and
introduces `type:` as the friendly name for a group's graph type. Block-level
`options.style` keeps vis's meaning (default graph type) unchanged. Each
friendly field below has exactly one spelling; the raw vis name for the same
concept is always still reachable via `options:` on the group.

| Friendly field | Compiles to |
| --- | --- |
| `type: line \| bar \| points` | `options.style: <value>` |
| `color: "#e11d48"` | `style: "stroke:#e11d48;fill:#e11d48;"` |
| `width: 2` | `stroke-width:2` in the style string |
| `dashes: [5, 5]` | `stroke-dasharray:5 5` in the style string |
| `fill: true` | `options.shaded: { orientation: 'zero' }` |
| `fill: { below: 0 }` / `{ above: 0 }` | `options.shaded: { orientation: 'bottom' \| 'top' }` |
| `fill: { to: otherGroupId }` | `options.shaded: { groupId: otherGroupId }` |
| `interpolation: centripetal\|chordal\|uniform` | `options.interpolation: { enabled: true, parametrization: <value> }` |
| `interpolation: false` | `options.interpolation: { enabled: false }` |
| `points: false` | `options.drawPoints: false` |
| `points: { style, size }` | `options.drawPoints: { enabled: true, ... }` |

The CSS `fill` emitted by `color` governs point and bar fill. Shaded-area fill
is a separate concern controlled by `fill:` → `options.shaded`; the shaded
region inherits the group's color through its generated class, so a single
`color` value styles stroke, points, and shading consistently.

**Precedence is explicit:** a raw `style:`, `options:`, or `className:` on a
group overrides anything compiled from friendly fields. Nothing the plugin
generates can shadow an explicit vis directive. This is asserted by tests in
`series.test.ts`.

### Default colors and themes

Groups without a `color` fall back to vis's own `.vis-graph-group0`…`9` classes.
`styles.css` restyles those against Obsidian CSS variables so charts read
correctly in both light and dark themes and respect the user's accent color.
Ready-made looks ship as `docs/themes/*.css` files users paste into a CSS
snippet, following the timeline repo's pattern.

### Chart type coverage (acceptance checklist)

Every Graph2d example published by vis maps to a documented block, and each is
verified manually before release:

- line, bar, points / scatterplot
- bars with `end` (spanning bars); bars side-by-side; side-by-side with groups
- stacked bars and `excludeFromStacking`
- shading: to zero, to an axis, and between two groups via `shaded.groupId`
- interpolation: centripetal, chordal, uniform, disabled
- left axis, right axis, both axes, axis titles and title styling, custom axis
  range, `alignZeros`, axis `icons`
- legend on/off, all four positions, `excludeFromLegend`, external legend
  container
- group visibility toggling (`groups.visibility`, per-group `visible`)
- point labels (`label: { content, xOffset, yOffset, className }`)
- localization, custom initial time range, `sampling` and `sort` on large series

## Error handling

Every failure renders an inline error box in the note. No uncaught throws, no
blank blocks. The code block processor wraps the pipeline in try/catch exactly
as the timeline plugin's does. Distinct messages for:

- source parses as neither YAML nor JSON
- block has neither `items` nor `data` nor columnar arrays
- referenced data file not found in the vault
- data file unreadable, or not an array of rows
- CSV missing an `x` or `y` header column
- unknown `xAxis` value
- non-numeric `y` value (message names the offending row index)
- point referencing a group id that is not declared
- ragged columnar arrays

A `MarkdownRenderChild` owns teardown, calling `Graph2d.destroy()` so
re-renders leak neither chart instances nor vault listeners.

## Testing

Vitest, matching the timeline repo's setup. Pure functions only — no DOM
required:

- `parser.test.ts` — YAML, JSON, bare-array shorthand, malformed input, missing
  keys
- `x-scale.test.ts` — value round-tripping through all three scales, label
  formatting, step selection across a spread of data ranges
- `columns.test.ts` — columnar expansion, per-group `x` override, ragged arrays
- `series.test.ts` — friendly→vis compilation for every field in the table
  above; that raw `style`/`options`/`className` win on conflict; and that
  group-level `style:` is never interpreted as a graph type
- `data-source.test.ts` — CSV, JSON, and YAML parsing against a mocked vault,
  including missing-file and malformed-content paths
- `normalizer.test.ts` — end-to-end block source → vis datasets

`renderer.ts` and `rasterize.ts` are verified manually and visually, as in the
timeline plugin.

## Additional v1 features

- **PNG rasterization** — `rasterize.ts` ported from the timeline plugin, so
  charts inside `[data-pubobs-render]` export as static images.
- **Settings tab** — global defaults: default graph style, default height,
  legend on/off, default x-axis mode, and default color palette. Persisted with
  `loadData()` / `saveData()`; block-level `options` always override.

## Identity, repo, and release

- Repo: `rborisov/vis-graph2d`, **public** (BRAT cannot read private repos)
- Plugin id: `vis-graph2d` (stable, never changed after release)
- Name: **Graph2d (vis-graph2d)**
- `minAppVersion`: `1.10.0`; `isDesktopOnly`: `false`
- License: MIT. Initial version `0.1.0`.
- Build config (esbuild, tsconfig, eslint) copied from the timeline repo.
  `main.js` is git-ignored and produced by CI.

`.github/workflows/release.yml` triggers on tags matching
`[0-9]+.[0-9]+.[0-9]+`, runs `npm ci && npm run build`, and attaches `main.js`,
`manifest.json`, and `styles.css` to the GitHub release as individual assets.
Tags carry no leading `v`, per Obsidian's requirements.

Cutting a release is `npm version patch && git push --follow-tags`.

The README documents BRAT installation: install BRAT, run **BRAT: Add a beta
plugin**, enter `rborisov/vis-graph2d`.
