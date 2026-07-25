# Styling

Every friendly styling field, plus the raw escape hatches that always win
when they're present.

> **The `style` asymmetry.** vis itself overloads the word "style": at the
> **block** level, `options.style` picks the *default graph type* for
> groups that don't set their own (`line`, `bar`, or `points`). On a
> **group**, `style:` is a raw inline CSS string — never a graph type. A
> group's graph type is spelled `type:` instead. This is the single most
> confusing thing in the API, so to be explicit: `type: bar` on a group
> sets its graph type; `style: "stroke:red;"` on a group sets its CSS and
> has no effect on what shape it draws.
>
> Whenever `style`, `options`, or `className` are set directly on a group,
> they always override anything the friendly fields (`color`, `width`,
> `dashes`, `fill`, …) would otherwise compile to.

## color

Sets both stroke and fill for the group's line, bars, or points.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    color: "#e11d48"
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 3, y: 5, group: a }
```

## width

Sets the stroke width, in pixels, of the line or bar outline.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    width: 4
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 3, y: 5, group: a }
```

## dashes

A dash pattern for the line, as an array of on/off pixel lengths.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    dashes: [5, 5]
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 3, y: 5, group: a }
```

## fill: true

Shades the area between the line and zero.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    fill: true
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 3, y: 5, group: a }
```

## fill: below

Shades from the line down to the bottom of the axis. `below`/`above` are
relative to the axis, not an arbitrary threshold — there is no numeric
form (`fill: { below: 500 }` throws; see the note below).

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    fill: below
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 3, y: 5, group: a }
```

## fill: above

Shades from the line up to the top of the axis. The equivalent object form
is `fill: { above: true }`.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    fill:
      above: true
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 3, y: 5, group: a }
```

> **Why no numeric threshold.** vis's underlying `shaded.orientation` only
> supports shading to the zero line, the axis top, or the axis bottom —
> there is no concept of shading down to an arbitrary value like `20`.
> Earlier versions of this plugin accepted `fill: { below: 20 }` and
> silently discarded the `20`, so `below: 0` and `below: 500` rendered
> identically. That form is now rejected with an error explaining why,
> instead of quietly ignoring the number.
>
> **Precedence**, when a `fill` object could match more than one key:
> `to` wins over `below`, which wins over `above`.

## fill: {to: otherGroup}

Shades the band between two groups' lines instead of between one line and
an axis.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: high
    content: High
    type: line
  - id: low
    content: Low
    type: line
    fill:
      to: high
items:
  - { x: 1, y: 10, group: high }
  - { x: 2, y: 14, group: high }
  - { x: 3, y: 9, group: high }
  - { x: 1, y: 4, group: low }
  - { x: 2, y: 6, group: low }
  - { x: 3, y: 3, group: low }
```

## interpolation: centripetal

A smoothed curve through the points, using the centripetal
parametrization (the safest of the three — avoids loops that chordal and
uniform can introduce on uneven spacing).

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    interpolation: centripetal
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 9, group: a }
  - { x: 3, y: 5, group: a }
  - { x: 4, y: 11, group: a }
```

## interpolation: chordal

A smoothed curve using the chordal parametrization.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    interpolation: chordal
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 9, group: a }
  - { x: 3, y: 5, group: a }
  - { x: 4, y: 11, group: a }
```

## interpolation: uniform

A smoothed curve using the uniform parametrization.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    interpolation: uniform
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 9, group: a }
  - { x: 3, y: 5, group: a }
  - { x: 4, y: 11, group: a }
```

## interpolation: false

Straight line segments between points, with smoothing disabled.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    interpolation: false
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 9, group: a }
  - { x: 3, y: 5, group: a }
  - { x: 4, y: 11, group: a }
```

## points: false

Disables the per-point markers a line group draws by default.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    points: false
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 3, y: 5, group: a }
```

## points: {style, size}

Customizes the marker shape (`circle` or `square`) and size in pixels.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    points:
      style: circle
      size: 10
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 3, y: 5, group: a }
```

## className with a matching CSS snippet

`className` adds a CSS class to the group's SVG elements, so a CSS
snippet (or a plugin theme — see `docs/themes/`) can target it directly.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    className: highlight-series
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 3, y: 5, group: a }
```

```css
.graph2d-plugin .highlight-series .vis-line {
  stroke-width: 4px;
  stroke-dasharray: 2 2;
}
```

## Raw style: the escape hatch

`style:` on a group is a raw inline CSS string, applied exactly as
written — never interpreted as a graph type, and never overridden by any
friendly field. Use it when the friendly fields (`color`, `width`,
`dashes`) don't cover what you need.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: a
    content: A
    style: "stroke:#0ea5e9;stroke-width:3;stroke-dasharray:4 2;"
items:
  - { x: 1, y: 4, group: a }
  - { x: 2, y: 7, group: a }
  - { x: 3, y: 5, group: a }
```
