# Task 4 correction — numeric and category axis mapping

**Status:** supersedes the `NumericScale` / `CategoryScale` design in Task 4 of
`2026-07-25-vis-graph2d.md`. Written after review found the original design
does not work.

## What was wrong

The original design mapped 1 author-unit to a power-of-ten multiple of one day
(`chooseUnitMs`), anchored at epoch 0, and pinned `timeAxis: { scale: 'day',
step: N }` with N chosen for a readable label count. Two defects, both
confirmed by driving vis's own `TimeStep` directly:

1. **Labels were not round, in any timezone.** With `step > 1`, vis's
   `TimeStep.roundToMinor` aligns to `(current.date() - 1) % step` and `next()`
   resets to the 1st of the month, so ticks snap to day-of-month rather than
   striding uniformly. `TimeStep` also computes in **local time**, displacing
   every tick by the UTC offset. Measured tick sequences for `x: [0, 100]`:

   | Design | TZ=UTC | TZ=America/Los_Angeles |
   | --- | --- | --- |
   | step 20, local (original) | `[0]` — a single tick | `[-106.67, 3.33]` |
   | step 1, local | `[0,10,…,100]` | `[-6.67, 3.33, 13.33, …]` |
   | **step 1, UTC (corrected)** | `[0,10,…,100]` | `[0,10,…,100]` |

2. **Large values overflowed the `Date` range.** Because `chooseUnitMs` keyed
   off span alone and ignored magnitude, `toInternal(v) = v * unitMs` produced
   `Invalid Date` for realistic input such as Unix seconds
   (`x: [1700000000, 1700000010]`), silently rendering a broken chart.

## Corrected design

One coherent change fixes both. Three parts:

1. **Choose a nice step in author units.** `S` is the 1/2/5×10^k value nearest
   `span / 10`, so roughly ten labels appear and every label lands on a round
   number.
2. **Map exactly one step to exactly one day, anchored on a multiple of `S`.**
   `anchor = floor(min / S) * S`, and `toInternal(v) = ((v - anchor) / S) *
   MS_PER_DAY`. Rebasing on the data's own origin keeps internal values small
   regardless of magnitude, which is what removes the overflow.
3. **Pin `step: 1` and force UTC.** `step: 1` avoids the day-of-month snap
   entirely; supplying vis's `moment` option bound to UTC removes the local
   offset. `moment` is re-exported from `vis-timeline/standalone` — the same
   instance vis uses internally, so this adds no dependency.

```ts
import { moment } from 'vis-timeline/standalone';

const UTC_MOMENT = (date: Date) => moment(date).utc();

/** The 1/2/5 x 10^k step nearest span/10, so labels land on round values. */
export function chooseNiceStep(span: number): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / TARGET_LABEL_COUNT;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

class NumericScale implements XScale {
  readonly overridesLabels = true;
  private readonly step: number;   // in author units
  private readonly anchor: number; // author value at internal time 0

  constructor(values: unknown[]) {
    const numbers = values
      .map((v) => toNumber(v))
      .filter((n) => n !== undefined);
    const min = numbers.length > 0 ? Math.min(...numbers) : 0;
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    this.step = chooseNiceStep(max - min);
    // Anchoring on a multiple of the step is what makes every tick land on a
    // round number even when the data does not start at one.
    this.anchor = Math.floor(min / this.step) * this.step;
  }

  toInternal(value: unknown): number {
    const n = toNumber(value);
    if (n === undefined) throw new Error(`"${String(value)}" is not a number.`);
    return ((n - this.anchor) / this.step) * MS_PER_DAY;
  }

  formatLabel(value: MomentLike): string {
    const slots = value.valueOf() / MS_PER_DAY;
    const authorValue = this.anchor + slots * this.step;
    // Float division then multiplication reintroduces tiny errors; 12
    // significant digits is more precision than any axis label needs.
    return String(Number(authorValue.toPrecision(12)));
  }

  axisHints(): Record<string, unknown> {
    return {
      showMajorLabels: false,
      timeAxis: { scale: 'day', step: 1 },
      moment: UTC_MOMENT,
    };
  }
}
```

`CategoryScale` keeps index-per-day mapping but must also emit
`moment: UTC_MOMENT` in `axisHints()`, for the same reason — without it,
category ticks drift by the UTC offset and the last category loses its label in
timezones west of UTC.

`TimeScale` must **not** force UTC. Real dates belong in the reader's own
timezone; its `axisHints()` stays `{}`.

`chooseUnitMs` is deleted — nothing else uses it.

## Verified tick sequences (corrected design)

Identical under `TZ=UTC` and `TZ=America/Los_Angeles`, read from vis's own
`TimeStep`:

| Input | Labels |
| --- | --- |
| `[0, 100]` | 0, 10, 20, … 100 |
| `[0, 1]` | 0, 0.1, 0.2, … 1 |
| `[0, 7]` | 0, 1, 2, … 7 |
| `[0, 12345]` | 0, 2000, 4000, … 12000 |
| `[0, 1000000]` | 0, 100000, … 1000000 |
| `[-100, 100]` | -100, -80, … 100 |
| `[1700000000, 1700000010]` | 1700000000, … 1700000010 |

## Testing requirements

The original tests did not constrain the numerics: 12 of 31 deliberate
mutations to `chooseStep`/`chooseUnitMs` survived the suite. The replacement
tests must fail if the numeric logic is broken.

**Unit tests** (`src/x-scale.test.ts`, no DOM):

- Round-trip `formatLabel(toInternal(v))` for spans 0.001, 0.5, 1, 7, 100,
  12345, 1e6, 1e9, and ranges spanning zero — assert the exact expected string,
  not a regex.
- `toInternal` stays inside the valid `Date` range (`|value| < 8.64e15`) for
  every case above, explicitly including `[1700000000, 1700000010]`.
- `chooseNiceStep` returns exactly 1, 2, 5, 10, 20, 50 … for representative
  spans, including the 1/2/5 boundary values themselves; assert exact numbers so
  a "factor always 1" mutation fails.
- Anchoring: for `[37, 137]`, ticks are multiples of the chosen step, and
  `anchor <= min`.
- Zero-width span and single-point data do not divide by zero or return a
  non-finite value.
- The existing `MomentLike` test stays — `formatLabel` must accept
  `{ valueOf }` and must never call a `Date`-only method.
- Category: first-appearance order, dedup, out-of-range → `''`, and
  `axisHints()` includes a `moment` function.
- Time mode: `axisHints()` is `{}` and contains no `moment` key.

**Integration test** — add to `src/renderer.test.ts` in Task 7, since it needs
happy-dom. Construct a real `Graph2d`, then walk vis's own `TimeStep`
(`graph.timeAxis.step`: `start()`, then `getCurrent()` / `next()` while
`hasNext()`) and assert the label sequence equals the table above exactly. Do
not assert on rendered `.vis-text` nodes: happy-dom has no layout engine, so vis
believes one label fills the axis and emits only a degenerate tick or two.
Driving `TimeStep` tests the real behaviour without depending on measurement.
