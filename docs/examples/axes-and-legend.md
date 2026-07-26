# Axes and legend

Left/right data axes, axis titles and ranges, the legend, group
visibility, and the three x-axis modes.

## Left axis

The default: every group without a `yAxisOrientation` draws against the
left axis.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
```

## Right axis

`yAxisOrientation: right` on a group moves it to the right-hand axis.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    yAxisOrientation: right
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
```

## Both axes at once

Groups can be split across both axes, useful when two series have very
different scales.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: revenue
    content: Revenue
  - id: units
    content: Units
    yAxisOrientation: right
items:
  - { x: 1, y: 400, group: revenue }
  - { x: 2, y: 550, group: revenue }
  - { x: 1, y: 12, group: units }
  - { x: 2, y: 18, group: units }
```

## Axis titles

`dataAxis.left.title` (or `.right.title`) sets the axis label text and,
via `style`, its inline CSS.

```vis-graph2d
options:
  xAxis: numeric
  dataAxis:
    left:
      title:
        text: Revenue ($)
        style: "color: #e11d48; font-weight: bold;"
groups:
  - id: revenue
    content: Revenue
items:
  - { x: 1, y: 400, group: revenue }
  - { x: 2, y: 550, group: revenue }
```

## Custom axis range

`dataAxis.left.range` (or `.right.range`) pins the axis to an explicit
`min`/`max` instead of auto-scaling to the data.

```vis-graph2d
options:
  xAxis: numeric
  dataAxis:
    left:
      range:
        min: 0
        max: 1000
groups:
  - id: revenue
    content: Revenue
items:
  - { x: 1, y: 400, group: revenue }
  - { x: 2, y: 550, group: revenue }
```

## alignZeros

`dataAxis.alignZeros` lines up the zero point of the left and right axes,
so a positive/negative series on the right reads against the same
baseline as the left axis.

```vis-graph2d
options:
  xAxis: numeric
  dataAxis:
    alignZeros: true
groups:
  - id: revenue
    content: Revenue
  - id: change
    content: Change
    yAxisOrientation: right
items:
  - { x: 1, y: 400, group: revenue }
  - { x: 2, y: 550, group: revenue }
  - { x: 1, y: -20, group: change }
  - { x: 2, y: 30, group: change }
```

## Axis icons

`dataAxis.icons: true` draws up/down indicator icons next to each group's
axis.

```vis-graph2d
options:
  xAxis: numeric
  dataAxis:
    icons: true
groups:
  - id: revenue
    content: Revenue
items:
  - { x: 1, y: 400, group: revenue }
  - { x: 2, y: 550, group: revenue }
```

## Legend on

`legend: true` at the block level shows a legend listing every group.

```vis-graph2d
options:
  xAxis: numeric
  legend: true
groups:
  - id: a
    content: A
  - id: b
    content: B
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 1, y: 2, group: b }
  - { x: 2, y: 5, group: b }
```

## Legend position: top-left

```vis-graph2d
options:
  xAxis: numeric
  legend:
    left:
      position: top-left
groups:
  - id: a
    content: A
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
```

## Legend position: top-right

```vis-graph2d
options:
  xAxis: numeric
  legend:
    left:
      position: top-right
groups:
  - id: a
    content: A
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
```

## Legend position: bottom-left

```vis-graph2d
options:
  xAxis: numeric
  legend:
    left:
      position: bottom-left
groups:
  - id: a
    content: A
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
```

## Legend position: bottom-right

```vis-graph2d
options:
  xAxis: numeric
  legend:
    left:
      position: bottom-right
groups:
  - id: a
    content: A
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
```

## excludeFromLegend

A group with `excludeFromLegend: true` still renders, but is left out of
the legend list — useful for reference lines or annotations.

```vis-graph2d
options:
  xAxis: numeric
  legend: true
groups:
  - id: a
    content: A
  - id: hidden
    content: Hidden from legend
    excludeFromLegend: true
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 1, y: 2, group: hidden }
  - { x: 2, y: 5, group: hidden }
```

## options.groups.visibility

`options.groups.visibility` sets each group's initial shown/hidden state
from one combined lookup, keyed by group id — the same effect as each
group's own `visible:` field below, just expressed differently. **Do not
confuse this with the block's own top-level `groups:` key** (the list of
series definitions used throughout this document): `options.groups` is a
raw vis setting nested *inside* `options:`, unrelated to the block's
`groups:` array even though they share the same name.

```vis-graph2d
options:
  xAxis: numeric
  groups:
    visibility:
      a: true
      b: false
groups:
  - id: a
    content: A
  - id: b
    content: B
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 1, y: 2, group: b }
  - { x: 2, y: 5, group: b }
```

## Per-group visible: false

`visible: false` on a group hides it entirely (and removes it from the
legend), without deleting its data — flip it back to `true` to bring it
back.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
  - id: b
    content: B
    visible: false
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 1, y: 2, group: b }
  - { x: 2, y: 5, group: b }
```

## xAxis: time

The default mode. `x` values are dates or date strings.

```vis-graph2d
options:
  xAxis: time
items:
  - { x: "2026-01-01", y: 10 }
  - { x: "2026-01-08", y: 14 }
```

## xAxis: numeric

`x` values are plain numbers, shown on a round-number axis. Use this for
anything that isn't a date — measurements, iteration counts, and so on.

```vis-graph2d
options:
  xAxis: numeric
items:
  - { x: 1, y: 10 }
  - { x: 2, y: 14 }
```

## xAxis: category

`x` values are arbitrary strings, shown in first-appearance order. Use
this for named, unordered-by-value categories like weekdays or labels.

```vis-graph2d
options:
  xAxis: category
items:
  - { x: Mon, y: 10 }
  - { x: Tue, y: 14 }
```

## locale

`locale` picks the language vis's own built-in date formatting uses on
the time axis (e.g. month/weekday names). It has no effect on numeric or
category axes — their labels are formatted entirely by this plugin's own
`XScale`, not by vis's locale-aware formatter.
> **Footgun:** a block-level `moment` option, if you ever set one
> directly, overrides the UTC pin that numeric and category axis labels
> depend on (see `docs/superpowers/specs/2026-07-25-vis-graph2d-design.md`
> and the README) — don't set `moment` yourself on those two modes.

```vis-graph2d
options:
  xAxis: time
  locale: en
items:
  - { x: "2026-01-01", y: 10 }
  - { x: "2026-02-01", y: 14 }
  - { x: "2026-03-01", y: 9 }
```

## Custom initial range: numeric

`start`/`end` set the initially visible window (the user can still pan or
zoom away from it); `min`/`max` bound how far they can go. On a numeric
or category axis these are given in your own data's units — the plugin
maps them onto Graph2d's internal time-based range for you.

```vis-graph2d
options:
  xAxis: numeric
  start: 2
  end: 8
groups:
  - id: a
    content: A
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 5, y: 9, group: a }
  - { x: 8, y: 6, group: a }
  - { x: 10, y: 11, group: a }
```

## Custom initial range: only one bound

Either bound may be given on its own. The other is filled in from the data,
so `start: 5` means "from 5 to the end of the data".

```vis-graph2d
options:
  xAxis: numeric
  start: 5
groups:
  - id: a
    content: A
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 5, y: 9, group: a }
  - { x: 8, y: 6, group: a }
  - { x: 10, y: 11, group: a }
```

The same holds on a time axis with only `end`.

```vis-graph2d
options:
  end: "2026-02-15"
items:
  - { x: "2026-01-01", y: 10 }
  - { x: "2026-02-01", y: 14 }
  - { x: "2026-03-01", y: 9 }
```

## Custom initial range: category

```vis-graph2d
options:
  xAxis: category
  start: Tue
  end: Thu
groups:
  - id: a
    content: A
items:
  - { x: Mon, y: 4, group: a }
  - { x: Tue, y: 7, group: a }
  - { x: Wed, y: 9, group: a }
  - { x: Thu, y: 6, group: a }
  - { x: Fri, y: 11, group: a }
```
