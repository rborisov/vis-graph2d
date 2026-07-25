# Data files

Data can live inline in the block, as columnar `x`/`y` arrays, or in an
external CSV/JSON/YAML file in the vault. `data:` references a file either
at the block level (rows become plain items) or on an individual group
(rows are tagged with that group's id, unless a row already sets its
own `group`). CSV files need `x` and `y` header columns; `group` is
optional. JSON and YAML files must contain an array of row objects.

The examples below reference files that don't exist in this repository —
`src/examples.test.ts` resolves them through a stub reader with matching
fixture content instead of a real vault, so they still render as part of
the automated check.

## Block-level CSV

```vis-graph2d
options:
  xAxis: numeric
data: charts/sales.csv
```

Where `charts/sales.csv` looks like:

```csv
x,y
1,120
2,150
3,90
4,200
```

## Block-level JSON

A JSON data file is an array of row objects; a `group` field on each row
assigns it to a group without one having to be declared in the block.

```vis-graph2d
options:
  xAxis: numeric
data: charts/sales.json
```

Where `charts/sales.json` looks like:

```json
[
  { "x": 1, "y": 120, "group": "north" },
  { "x": 2, "y": 150, "group": "north" },
  { "x": 1, "y": 80, "group": "south" },
  { "x": 2, "y": 95, "group": "south" }
]
```

## Block-level YAML

```vis-graph2d
options:
  xAxis: numeric
data: charts/sales.yaml
```

Where `charts/sales.yaml` looks like:

```yaml
- x: 1
  y: 120
- x: 2
  y: 150
- x: 3
  y: 90
```

## Group-level data

Each group can reference its own file. Rows loaded this way are
automatically tagged with the owning group's id.

```vis-graph2d
options:
  xAxis: numeric
groups:
  - id: north
    content: North
    data: charts/north.csv
  - id: south
    content: South
    data: charts/south.csv
```

## Wikilink vs. plain-path references

`data:` accepts a plain vault-relative path (as in the examples above) or
an Obsidian wikilink, with or without a display alias — both resolve to
the same file.

```vis-graph2d
options:
  xAxis: numeric
data: "[[charts/sales.csv]]"
```

## Columnar x/y form

Instead of a file, a block can share one `x` array across groups that
each supply only their `y` values — handy for pasting a spreadsheet's
columns directly.

```vis-graph2d
options:
  xAxis: numeric
x: [1, 2, 3, 4]
groups:
  - id: a
    content: A
    y: [10, 20, 15, 25]
  - id: b
    content: B
    y: [5, 8, 12, 9]
```
