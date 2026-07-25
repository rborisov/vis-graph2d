# Chart types

Every graph type Graph2d supports, and the group combinations that make
them useful: spanning bars, side-by-side bars, stacked bars, scatterplots,
and mixed types in one chart.

Each example below is rendered automatically by `src/examples.test.ts` — if
one of these blocks stops working, the test suite fails.

## Line chart (time axis)

The default chart: a time axis with one line series.

```vis-graph2d
options:
  xAxis: time
groups:
  - id: visits
    content: Visits
    type: line
items:
  - { x: "2026-01-01", y: 120, group: visits }
  - { x: "2026-01-08", y: 145, group: visits }
  - { x: "2026-01-15", y: 132, group: visits }
  - { x: "2026-01-22", y: 168, group: visits }
```

## Bar chart

Set `type: bar` on the group. Each item draws one bar centred on its `x`.

```vis-graph2d
options:
  xAxis: time
groups:
  - id: visits
    content: Visits
    type: bar
items:
  - { x: "2026-01-01", y: 120, group: visits }
  - { x: "2026-01-08", y: 145, group: visits }
  - { x: "2026-01-15", y: 132, group: visits }
```

## Bar chart with end

Bars span from `x` to `end` instead of being centred on `x`.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: tasks
    content: Duration
    type: bar
items:
  - { x: 0, y: 5, end: 3, group: tasks }
  - { x: 4, y: 8, end: 9, group: tasks }
```

## Bars side by side

`barChart: { sideBySide: true }` draws each group's bar next to the
others' instead of overlapping them.

```vis-graph2d
options:
  xAxis: numeric
  barChart:
    sideBySide: true
groups:
  - id: a
    content: A
    type: bar
  - id: b
    content: B
    type: bar
items:
  - { x: 1, y: 10, group: a }
  - { x: 2, y: 14, group: a }
  - { x: 1, y: 8, group: b }
  - { x: 2, y: 12, group: b }
```

## Bars side by side with multiple groups

`sideBySide` scales to any number of groups; each `x` position gets one
slot per group sharing it.

```vis-graph2d
options:
  xAxis: numeric
  barChart:
    sideBySide: true
groups:
  - id: a
    content: A
    type: bar
  - id: b
    content: B
    type: bar
  - id: c
    content: C
    type: bar
items:
  - { x: 1, y: 10, group: a }
  - { x: 1, y: 8, group: b }
  - { x: 1, y: 14, group: c }
  - { x: 2, y: 12, group: a }
  - { x: 2, y: 9, group: b }
  - { x: 2, y: 16, group: c }
```

## Stacked bars

`stack: true` at the block level stacks every bar group at each `x`
position instead of overlapping or sitting side by side.

```vis-graph2d
options:
  xAxis: numeric
  stack: true
groups:
  - id: a
    content: A
    type: bar
  - id: b
    content: B
    type: bar
items:
  - { x: 1, y: 10, group: a }
  - { x: 2, y: 14, group: a }
  - { x: 1, y: 8, group: b }
  - { x: 2, y: 12, group: b }
```

## excludeFromStacking

A group with `excludeFromStacking: true` opts out of the stack — useful
for a trend line drawn over stacked bars.

```vis-graph2d
options:
  xAxis: numeric
  stack: true
groups:
  - id: a
    content: A
    type: bar
  - id: b
    content: B
    type: bar
  - id: trend
    content: Trend
    type: line
    excludeFromStacking: true
items:
  - { x: 1, y: 10, group: a }
  - { x: 2, y: 14, group: a }
  - { x: 1, y: 8, group: b }
  - { x: 2, y: 12, group: b }
  - { x: 1, y: 9, group: trend }
  - { x: 2, y: 13, group: trend }
```

## Scatterplot

`type: points` draws markers with no connecting line at all;
`interpolation: false` makes that explicit even if `type` later changes.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: samples
    content: Samples
    type: points
    interpolation: false
items:
  - { x: 1, y: 5, group: samples }
  - { x: 2, y: 9, group: samples }
  - { x: 3, y: 4, group: samples }
  - { x: 4, y: 11, group: samples }
```

## Points with custom style and size

`points: { style, size }` controls the marker shape (`circle` or
`square`) and its size in pixels.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: samples
    content: Samples
    type: points
    points:
      style: square
      size: 8
items:
  - { x: 1, y: 5, group: samples }
  - { x: 2, y: 9, group: samples }
  - { x: 3, y: 4, group: samples }
```

## Point labels

`label: { content, xOffset, yOffset, className }` attaches a text label to
one point. Offsets are in pixels; `className` lets a CSS snippet target
this one label without affecting the rest of the series.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: sales
    content: Sales
items:
  - { x: 1, y: 10, group: sales }
  - { x: 2, y: 18, group: sales, label: { content: "Peak", xOffset: 4, yOffset: -16, className: peak-label } }
  - { x: 3, y: 12, group: sales }
```

```css
.graph2d-plugin .peak-label {
  font-weight: bold;
  fill: #e11d48;
}
```

## sampling and sort on a large series

`sampling: true` downsamples a dense line series so it stays smooth to
pan and zoom; `sort: true` sorts items by `x` before drawing even when
they arrive out of order, as this hand-authored 30-point series
deliberately does (both are block-level options).

```vis-graph2d
options:
  xAxis: numeric
  sampling: true
  sort: true
groups:
  - id: readings
    content: Readings
items:
  - { x: 22, y: 52, group: readings }
  - { x: 6, y: 42, group: readings }
  - { x: 16, y: 51, group: readings }
  - { x: 30, y: 48, group: readings }
  - { x: 8, y: 55, group: readings }
  - { x: 29, y: 51, group: readings }
  - { x: 10, y: 49, group: readings }
  - { x: 1, y: 57, group: readings }
  - { x: 14, y: 57, group: readings }
  - { x: 9, y: 52, group: readings }
  - { x: 28, y: 54, group: readings }
  - { x: 23, y: 49, group: readings }
  - { x: 27, y: 57, group: readings }
  - { x: 15, y: 54, group: readings }
  - { x: 24, y: 46, group: readings }
  - { x: 25, y: 43, group: readings }
  - { x: 20, y: 58, group: readings }
  - { x: 7, y: 58, group: readings }
  - { x: 17, y: 48, group: readings }
  - { x: 26, y: 40, group: readings }
  - { x: 19, y: 42, group: readings }
  - { x: 12, y: 43, group: readings }
  - { x: 4, y: 48, group: readings }
  - { x: 18, y: 45, group: readings }
  - { x: 3, y: 51, group: readings }
  - { x: 2, y: 54, group: readings }
  - { x: 21, y: 55, group: readings }
  - { x: 13, y: 40, group: readings }
  - { x: 5, y: 45, group: readings }
  - { x: 11, y: 46, group: readings }
```

## Mixed types in one chart

A bar group and a line group can share one chart, for example actuals
against a target line.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: revenue
    content: Revenue
    type: bar
  - id: target
    content: Target
    type: line
items:
  - { x: 1, y: 10, group: revenue }
  - { x: 2, y: 14, group: revenue }
  - { x: 3, y: 9, group: revenue }
  - { x: 1, y: 12, group: target }
  - { x: 2, y: 12, group: target }
  - { x: 3, y: 12, group: target }
```
