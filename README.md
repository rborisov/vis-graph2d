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
here is passed straight through to vis Graph2d untouched — `zoomMin`,
`hiddenDates`, `locales`, and every other Graph2d option not named below
all work without the plugin knowing about them.

| Option | Type | Description |
| --- | --- | --- |
| `xAxis` | `time \| numeric \| category` | X-axis interpretation. Default `time`. |
| `height` | CSS length, e.g. `"400px"` | Fixed height of the chart container. |
| `legend` | `boolean \| object` | Show a legend; see `docs/examples/axes-and-legend.md` for positioning. |
| `stack` | `boolean` | Stack bar groups at each `x` instead of overlapping them. |
| `sort` | `boolean` | Sort items by `x` before drawing. |
| `sampling` | `boolean` | Downsample dense line series for performance. |
| `zoomable` | `boolean` | Allow the user to zoom the chart. |
| `moveable` | `boolean` | Allow the user to pan the chart. |
| `zoomKey` | `string` | Modifier key (e.g. `"ctrlKey"`) required to zoom with the scroll wheel. |
| `start` / `end` | axis value | Initial visible range. |
| `min` / `max` | axis value | Bounds beyond which the user cannot pan or zoom. |
| `dataAxis` | object | Left/right axis titles, ranges, `alignZeros`, `icons`. |
| `barChart` | object | `sideBySide`, `align`, `minWidth` for bar groups. |
| `drawPoints` | `boolean \| object` | Default point-drawing behaviour for all groups. |
| `showCurrentTime` | `boolean` | Draw a marker at the current time (time axis only). |
| `locale` | `string` | Locale for vis's built-in date formatting. |

## Item reference

Fields on each entry in `items:`.

| Field | Description |
| --- | --- |
| `x` | Position on the x-axis; shape depends on `xAxis` mode. |
| `y` | Numeric value. Required. |
| `group` | Id of the group this point belongs to. |
| `end` | End position for a spanning bar (draws from `x` to `end`). |
| `label` | `{ content, xOffset, yOffset, className }` — a text label attached to the point. |

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
| `fill` | `true`, `{ below }`, `{ above }`, or `{ to: otherGroupId }` — shaded area. |
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

## Examples

Every example below renders as part of this repository's automated test
suite (`src/examples.test.ts`) — a broken example fails the build.

- [`docs/examples/chart-types.md`](docs/examples/chart-types.md) — line,
  bar, spanning bars, side-by-side bars, stacked bars, scatterplots, mixed
  types.
- [`docs/examples/styling.md`](docs/examples/styling.md) — color, width,
  dashes, shading, interpolation, points, `className`, and raw `style`.
- [`docs/examples/axes-and-legend.md`](docs/examples/axes-and-legend.md) —
  left/right axes, titles, ranges, legend positions, group visibility, and
  the three x-axis modes.
- [`docs/examples/data-files.md`](docs/examples/data-files.md) — CSV,
  JSON, and YAML data files, and the columnar form.

## Changelog

| Version | Notes |
| --- | --- |
| 0.1.0 | Initial release: line/bar/points charts, time/numeric/category axes, inline/columnar/external data, full styling passthrough, PNG export. |

## License

[MIT](LICENSE)
