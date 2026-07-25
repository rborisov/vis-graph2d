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
