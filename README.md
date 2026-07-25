# Graph2d (vis-graph2d)

An Obsidian plugin that renders interactive 2D charts — lines, bars, and
scatterplots — directly in your notes from a `vis-graph2d` code block. It
is powered by [vis-timeline's Graph2d](https://visjs.github.io/vis-timeline/docs/graph2d/),
and supports every graph type and styling option the library exposes: any
Graph2d option not covered by the friendly fields below still works,
passed straight through untouched.

## Installation

### BRAT (recommended, while the plugin is in beta)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from the
   Community plugins browser.
2. Run the command **BRAT: Add a beta plugin**.
3. Enter `rborisov/vis-graph2d` and confirm.

BRAT installs the latest release and keeps it updated as new versions ship.

### Manual install

1. Download `main.js`, `manifest.json`, and `styles.css` from the
   [latest release](https://github.com/rborisov/vis-graph2d/releases).
2. Copy them into `<Vault>/.obsidian/plugins/vis-graph2d/`.
3. Reload Obsidian and enable **Graph2d (vis-graph2d)** under
   **Settings → Community plugins**.

## Usage

Add a `vis-graph2d` code block with a list of data points:

```vis-graph2d
items:
  - { x: "2026-01-01", y: 10 }
  - { x: "2026-01-08", y: 14 }
  - { x: "2026-01-15", y: 9 }
```

That's the smallest working example: no groups, no options — just a time
axis and one line. Everything else in this document layers on top of it.

## Axis modes

The `options.xAxis` setting controls how `x` values are interpreted.
Defaults to `time`.

| Mode | Example `x` value | Use it for |
| --- | --- | --- |
| `time` (default) | `"2026-01-01"` | Dates and timestamps |
| `numeric` | `42` | Measurements, counts, anything numeric that isn't a date |
| `category` | `"Mon"` | Named, unordered categories like weekdays or labels |

See `docs/examples/axes-and-legend.md` for a runnable block of each mode.

## Block reference

Options set under `options:` at the top of a block. Anything not listed
here is passed straight through to vis Graph2d untouched — `hiddenDates`,
`locales`, and every other Graph2d option not named below all work
without the plugin knowing about them.

| Option | Type | Description |
| --- | --- | --- |
| `xAxis` | `time \| numeric \| category` | X-axis interpretation. Default `time`. |
| `height` | CSS length, e.g. `"400px"` | Fixed height of the chart container. |
| `legend` | `boolean \| object` | Show a legend; see `docs/examples/axes-and-legend.md` for positioning. |
| `stack` | `boolean` | Stack bar groups at each `x` instead of overlapping them. |
| `sort` | `boolean` | Sort items by `x` before drawing. See `docs/examples/chart-types.md` for a large-series example. |
| `sampling` | `boolean` | Downsample dense line series for performance. See `docs/examples/chart-types.md`. |
| `zoomable` | `boolean` | Allow the user to zoom the chart. |
| `moveable` | `boolean` | Allow the user to pan the chart. |
| `zoomKey` | `string` | Modifier key (e.g. `"ctrlKey"`) required to zoom with the scroll wheel. |
| `start` / `end` | axis value | Initial visible range, in your data's own units on every axis mode (numeric/category values are mapped onto Graph2d's internal range for you). See `docs/examples/axes-and-legend.md`. |
| `min` / `max` | axis value | Bounds beyond which the user cannot pan or zoom. Same unit handling as `start`/`end`. |
| `zoomMin` / `zoomMax` | number | Tightest/widest allowed zoom, as a **duration** rather than a position. On `numeric`/`category` axes this is also in your own data's units (e.g. `zoomMin: 2` means "never zoom in past a 2-unit-wide window"), converted internally the same way `start`/`end` are. |
| `dataAxis` | object | Left/right axis titles, ranges, `alignZeros`, `icons`. |
| `barChart` | object | `sideBySide`, `align`, `minWidth` for bar groups. |
| `drawPoints` | `boolean \| object` | Default point-drawing behaviour for all groups. |
| `showCurrentTime` | `boolean` | Draw a marker at the current time (time axis only). |
| `locale` | `string` | Locale for vis's built-in date formatting (time axis only — numeric/category labels are formatted by this plugin, not by locale). See `docs/examples/axes-and-legend.md`. |
| `groups` | object | Raw vis group settings, e.g. `groups.visibility` (initial shown/hidden state per group id) — **not** the same thing as the block's own top-level `groups:` key documented below, despite the shared name. See `docs/examples/axes-and-legend.md`. |
| `moment` | function | **Footgun:** setting this yourself overrides the UTC pin that `numeric` and `category` axis labels depend on internally, which will visibly shift or break those labels. Leave it unset on those two modes; it's safe (and has its ordinary vis meaning) on `time`. |

## Item reference

Fields on each entry in `items:`.

| Field | Description |
| --- | --- |
| `x` | Position on the x-axis; shape depends on `xAxis` mode. |
| `y` | Numeric value. Required. |
| `group` | Id of the group this point belongs to. |
| `end` | End position for a spanning bar (draws from `x` to `end`). |
| `label` | `{ content, xOffset, yOffset, className }` — a text label attached to the point. See `docs/examples/chart-types.md` for a runnable example. |

## Group reference

Fields on each entry in `groups:`. Friendly fields are sugar the plugin
compiles for you; raw fields are forwarded to vis untouched.

**The `style` asymmetry:** at the *block* level, `options.style` sets the
default graph type for groups that don't declare their own. On a
*group*, `style:` is raw inline CSS — never a graph type. A group's
graph type is spelled `type:` instead.

Friendly fields:

| Field | Compiles to |
| --- | --- |
| `type: line \| bar \| points` | The group's graph type. |
| `color` | Stroke and fill colour. |
| `fill` | `true`, `"below"`, `"above"`, `{ below: true }`, `{ above: true }`, or `{ to: otherGroupId }` — shaded area. Precedence when more than one could match: `to` > `below` > `above`. A numeric `below`/`above` (e.g. `{ below: 20 }`) throws: shading is relative to the axis, not an arbitrary value — see `docs/examples/styling.md`. |
| `width` | Stroke width in pixels. |
| `dashes` | Dash pattern, e.g. `[5, 5]`. |
| `points` | `false`, or `{ style: circle \| square, size }` — point markers. |
| `interpolation` | `false`, `centripetal`, `chordal`, or `uniform` — line smoothing. |
| `content` | Legend / label text. Defaults to the group's `id`. |
| `visible` | `false` hides the group without deleting its data. |

Raw pass-through fields (forwarded to vis exactly as written, and always
win over anything a friendly field above would compile to):

| Field | Description |
| --- | --- |
| `style` | Raw inline CSS string. Never interpreted as a graph type. |
| `className` | CSS class added to the group's SVG elements. |
| `options` | Raw vis group options object, merged in last. |
| `yAxisOrientation` | `left` (default) or `right`. |
| `excludeFromLegend` | Hide from the legend while still rendering. |
| `excludeFromStacking` | Opt out of `stack: true`. |
| `barChart` | Per-group bar layout overrides. |

## Data files

Data can be inline `items:`, a shared columnar `x:`/`y:` form, or loaded
from an external CSV/JSON/YAML file in the vault. See
`docs/examples/data-files.md` for the full set of runnable examples,
including block-level vs. group-level `data:`, wikilink references, and
the columnar form.

## Styling

Default series colours follow Obsidian's theme so charts read correctly
in light and dark mode. Ready-made looks ship as CSS snippets in
`docs/themes/` — copy one into **Settings → Appearance → CSS snippets**
to change every chart's default colours and line styles at once.

For per-chart styling, `className` targets one group directly:

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: revenue
    content: Revenue
    className: revenue-series
items:
  - { x: 1, y: 20, group: revenue }
  - { x: 2, y: 32, group: revenue }
  - { x: 3, y: 41, group: revenue }
```

```css
.graph2d-plugin .revenue-series .vis-line {
  stroke-width: 3px;
}
```

## PNG export during a pubobs sync

Charts render as interactive widgets in Obsidian itself. When a note is
rendered by **pubobs** (a separate note-publishing plugin) for publishing
— detected via its `[data-pubobs-render]` wrapper — this plugin instead
rasterizes each chart to a static PNG at that point, since a published
page has no vis-timeline runtime to be interactive with.

That PNG is **written as a real file into your vault**, not embedded
inline, named `<note-basename>-graph2d-<hash>.png` next to the note (the
hash is derived from the block's own source, so re-syncing an unchanged
block overwrites the same file instead of piling up new ones). This is a
side effect worth knowing about if you inspect your vault's file list
after a sync: those PNGs are pubobs's export artifacts, not something you
authored, and are safe to delete (they regenerate on the next sync).

No network calls are made during export or at any other time — rendering,
rasterization, and the resulting file write are all local to your vault.

## Examples

Every example below renders as part of this repository's automated test
suite (`src/examples.test.ts`) — a broken example fails the build.

- [`docs/examples/chart-types.md`](docs/examples/chart-types.md) — line,
  bar, spanning bars, side-by-side bars, stacked bars, scatterplots, mixed
  types, point labels, and `sampling`/`sort` on a large series.
- [`docs/examples/styling.md`](docs/examples/styling.md) — color, width,
  dashes, shading, interpolation, points, `className`, and raw `style`.
- [`docs/examples/axes-and-legend.md`](docs/examples/axes-and-legend.md) —
  left/right axes, titles, ranges, legend positions, `options.groups.visibility`
  and per-group `visible`, `locale`, custom initial range (`start`/`end`),
  and the three x-axis modes.
- [`docs/examples/data-files.md`](docs/examples/data-files.md) — CSV,
  JSON, and YAML data files, and the columnar form.

## Changelog

| Version | Notes |
| --- | --- |
| 0.1.1 | `start`/`end`/`min`/`max`/`zoomMin`/`zoomMax` now work on numeric and category axes; data-file errors name the file; stricter validation of groups and items; unified error wording. |
| 0.1.0 | Initial release: line/bar/points charts, time/numeric/category axes, inline/columnar/external data, full styling passthrough, PNG export. |

## License

[MIT](LICENSE)
