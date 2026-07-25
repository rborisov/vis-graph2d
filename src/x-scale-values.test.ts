import { describe, it, expect } from 'vitest';
import { createXScale, chooseNiceStep, MS_PER_DAY } from './x-scale';

// Numeric- and category-scale value round-tripping. Split out of
// x-scale.test.ts (time scale, chooseNiceStep, createXScale) to keep both
// files under the repo's ~300-line budget.

// The valid JS Date range is +/- 8.64e15ms from the epoch.
const MAX_VALID_DATE_MS = 8.64e15;

describe('numeric scale', () => {
  it('round-trips a span of 100 through toInternal/formatLabel with exact labels', () => {
    const scale = createXScale('numeric', [0, 100]);
    expect(scale.formatLabel(new Date(scale.toInternal(0)))).toBe('0');
    expect(scale.formatLabel(new Date(scale.toInternal(1)))).toBe('1');
    expect(scale.formatLabel(new Date(scale.toInternal(50)))).toBe('50');
    expect(scale.formatLabel(new Date(scale.toInternal(99)))).toBe('99');
    expect(scale.formatLabel(new Date(scale.toInternal(100)))).toBe('100');
  });

  it('round-trips a tiny span of 0.001', () => {
    const scale = createXScale('numeric', [0, 0.001]);
    expect(scale.formatLabel(new Date(scale.toInternal(0)))).toBe('0');
    expect(scale.formatLabel(new Date(scale.toInternal(0.0005)))).toBe('0.0005');
    expect(scale.formatLabel(new Date(scale.toInternal(0.001)))).toBe('0.001');
  });

  it('round-trips a span of 0.5', () => {
    const scale = createXScale('numeric', [0, 0.5]);
    expect(scale.formatLabel(new Date(scale.toInternal(0)))).toBe('0');
    expect(scale.formatLabel(new Date(scale.toInternal(0.25)))).toBe('0.25');
    expect(scale.formatLabel(new Date(scale.toInternal(0.5)))).toBe('0.5');
  });

  it('round-trips a span of 1', () => {
    const scale = createXScale('numeric', [0, 1]);
    expect(scale.formatLabel(new Date(scale.toInternal(0)))).toBe('0');
    expect(scale.formatLabel(new Date(scale.toInternal(0.25)))).toBe('0.25');
    expect(scale.formatLabel(new Date(scale.toInternal(1)))).toBe('1');
  });

  it('round-trips a span of 7', () => {
    const scale = createXScale('numeric', [0, 7]);
    expect(scale.formatLabel(new Date(scale.toInternal(0)))).toBe('0');
    expect(scale.formatLabel(new Date(scale.toInternal(3)))).toBe('3');
    expect(scale.formatLabel(new Date(scale.toInternal(7)))).toBe('7');
  });

  it('round-trips a span of 12345', () => {
    const scale = createXScale('numeric', [0, 12345]);
    expect(scale.formatLabel(new Date(scale.toInternal(0)))).toBe('0');
    expect(scale.formatLabel(new Date(scale.toInternal(2000)))).toBe('2000');
    expect(scale.formatLabel(new Date(scale.toInternal(12345)))).toBe('12345');
  });

  it('round-trips a span of 1e6', () => {
    const scale = createXScale('numeric', [0, 1000000]);
    expect(scale.formatLabel(new Date(scale.toInternal(0)))).toBe('0');
    expect(scale.formatLabel(new Date(scale.toInternal(750000)))).toBe('750000');
    expect(scale.formatLabel(new Date(scale.toInternal(1000000)))).toBe('1000000');
  });

  it('round-trips a span of 1e9', () => {
    const scale = createXScale('numeric', [0, 1e9]);
    expect(scale.formatLabel(new Date(scale.toInternal(0)))).toBe('0');
    expect(scale.formatLabel(new Date(scale.toInternal(5e8)))).toBe('500000000');
    expect(scale.formatLabel(new Date(scale.toInternal(1e9)))).toBe('1000000000');
  });

  it('round-trips a range spanning zero', () => {
    const scale = createXScale('numeric', [-100, 100]);
    expect(scale.formatLabel(new Date(scale.toInternal(-100)))).toBe('-100');
    expect(scale.formatLabel(new Date(scale.toInternal(-40)))).toBe('-40');
    expect(scale.formatLabel(new Date(scale.toInternal(0)))).toBe('0');
    expect(scale.formatLabel(new Date(scale.toInternal(100)))).toBe('100');
  });

  it('round-trips realistic Unix-seconds input without overflowing Date', () => {
    const scale = createXScale('numeric', [1700000000, 1700000010]);
    expect(scale.formatLabel(new Date(scale.toInternal(1700000000)))).toBe('1700000000');
    expect(scale.formatLabel(new Date(scale.toInternal(1700000005)))).toBe('1700000005');
    expect(scale.formatLabel(new Date(scale.toInternal(1700000010)))).toBe('1700000010');
  });

  it('keeps toInternal within the valid Date range for every tested span', () => {
    const cases: Array<[unknown[], number]> = [
      [[0, 100], 100],
      [[0, 0.001], 0.001],
      [[0, 0.5], 0.5],
      [[0, 1], 1],
      [[0, 7], 7],
      [[0, 12345], 12345],
      [[0, 1000000], 1000000],
      [[0, 1e9], 1e9],
      [[-100, 100], 100],
      [[1700000000, 1700000010], 1700000010],
    ];
    for (const [values, probe] of cases) {
      const scale = createXScale('numeric', values);
      for (const v of values as number[]) {
        expect(Math.abs(scale.toInternal(v))).toBeLessThan(MAX_VALID_DATE_MS);
      }
      expect(Math.abs(scale.toInternal(probe))).toBeLessThan(MAX_VALID_DATE_MS);
    }
  });

  it('anchors on a multiple of the chosen step that is <= min', () => {
    const scale = createXScale('numeric', [37, 137]);
    // chooseNiceStep(137 - 37) === chooseNiceStep(100) === 10.
    expect(chooseNiceStep(100)).toBe(10);
    // anchor = floor(37 / 10) * 10 = 30, which is a multiple of 10 and <= 37.
    const anchor = Number(scale.formatLabel(new Date(0)));
    expect(anchor).toBe(30);
    expect(anchor % 10).toBe(0);
    expect(anchor).toBeLessThanOrEqual(37);
    // Every tick (one per internal day) lands on a multiple of the step.
    for (const days of [0, 1, 2, 3, 10]) {
      const tick = Number(scale.formatLabel(new Date(days * MS_PER_DAY)));
      expect(tick % 10).toBe(0);
    }
  });

  it('handles a zero-width span without dividing by zero', () => {
    const scale = createXScale('numeric', [5, 5]);
    expect(Number.isFinite(scale.toInternal(5))).toBe(true);
    expect(scale.toInternal(5)).toBe(0);
    expect(scale.formatLabel(new Date(0))).toBe('5');
  });

  it('handles single-point data without dividing by zero', () => {
    const scale = createXScale('numeric', [42]);
    expect(Number.isFinite(scale.toInternal(42))).toBe(true);
    expect(scale.formatLabel(new Date(scale.toInternal(42)))).toBe('42');
  });

  it('pins a one-day step, forces UTC, and hides major labels', () => {
    const hints = createXScale('numeric', [0, 100]).axisHints();
    expect(hints.showMajorLabels).toBe(false);
    expect(hints.timeAxis).toEqual({ scale: 'day', step: 1 });
    expect(typeof hints.moment).toBe('function');
  });

  it('overrides axis labels', () => {
    expect(createXScale('numeric', [0, 1]).overridesLabels).toBe(true);
  });

  it('formats a moment-like object, not just a Date', () => {
    // vis passes its internal moment here, which has valueOf() but no
    // getTime(). This test fails loudly if formatLabel reaches for a
    // Date-only method.
    const scale = createXScale('numeric', [0, 100]);
    const momentLike = { valueOf: () => scale.toInternal(42) };
    expect(scale.formatLabel(momentLike)).toBe('42');
  });

  it('accepts numeric strings', () => {
    const scale = createXScale('numeric', [0, 10]);
    expect(scale.toInternal('5')).toBe(scale.toInternal(5));
  });

  it('throws for a non-numeric value', () => {
    const scale = createXScale('numeric', [0, 10]);
    expect(() => scale.toInternal('abc')).toThrow('not a number');
  });

  it('throws for non-finite numeric input (Infinity, -Infinity, NaN)', () => {
    const scale = createXScale('numeric', [0, 10]);
    expect(() => scale.toInternal(Infinity)).toThrow('is not a number');
    expect(() => scale.toInternal(-Infinity)).toThrow('is not a number');
    expect(() => scale.toInternal(NaN)).toThrow('is not a number');
  });

  it('pins tick 3 of [0, 1] to exactly "0.3", not float dust', () => {
    const scale = createXScale('numeric', [0, 1]);
    // step = 0.1; tick 3 sits at slots=3 -> 3 * 0.1 = 0.30000000000000004 in
    // raw float math. The precision guard in formatLabel must clean this to
    // exactly '0.3'.
    expect(scale.formatLabel(new Date(3 * MS_PER_DAY))).toBe('0.3');
  });

  it('produces 11 distinct, correct labels for realistic Unix-millisecond input', () => {
    // Unix milliseconds require 13+ significant digits to distinguish
    // adjacent ticks; a precision guard that truncates too aggressively
    // collapses distinct values into duplicate labels.
    const min = 1700000000000;
    const max = 1700000000010;
    const scale = createXScale('numeric', [min, max]);
    const labels: string[] = [];
    for (let v = min; v <= max; v++) {
      labels.push(scale.formatLabel(new Date(scale.toInternal(v))));
    }
    expect(labels).toEqual([
      '1700000000000',
      '1700000000001',
      '1700000000002',
      '1700000000003',
      '1700000000004',
      '1700000000005',
      '1700000000006',
      '1700000000007',
      '1700000000008',
      '1700000000009',
      '1700000000010',
    ]);
    expect(new Set(labels).size).toBe(11);
  });

  it('forces UTC on the axis moment (labels stay timezone-independent)', () => {
    const hints = createXScale('numeric', [0, 100]).axisHints();
    const momentFactory = hints.moment as (d: Date) => { format(fmt: string): string };
    const formatted = momentFactory(new Date('2020-06-15T23:30:00Z')).format('YYYY-MM-DD HH');
    // In any non-UTC zone this would read a different hour/day if .utc()
    // were dropped from UTC_MOMENT.
    expect(formatted).toBe('2020-06-15 23');
  });

  // FIX 1: zoomMin/zoomMax are durations, not positions -- they divide by
  // the step instead of subtracting the anchor.
  it('scales a duration by dividing out the step, with no anchor offset', () => {
    // x: [37, 137] -> step 10, anchor 30 (see "anchors on a multiple..." above).
    const scale = createXScale('numeric', [37, 137]);
    expect(scale.toInternalDuration(20)).toBe(2 * MS_PER_DAY);
    // A duration of 0 is 0 regardless of anchor.
    expect(scale.toInternalDuration(0)).toBe(0);
  });

  it('throws for a non-numeric duration', () => {
    const scale = createXScale('numeric', [0, 10]);
    expect(() => scale.toInternalDuration('abc')).toThrow('not a number');
  });
});

describe('category scale', () => {
  it('assigns indices in first-appearance order', () => {
    const scale = createXScale('category', ['Mon', 'Tue', 'Wed']);
    expect(scale.toInternal('Mon')).toBe(0);
    expect(scale.toInternal('Tue')).toBe(MS_PER_DAY);
    expect(scale.toInternal('Wed')).toBe(2 * MS_PER_DAY);
  });

  it('deduplicates repeated categories', () => {
    const scale = createXScale('category', ['Mon', 'Tue', 'Mon']);
    expect(scale.toInternal('Mon')).toBe(0);
    expect(scale.toInternal('Tue')).toBe(MS_PER_DAY);
  });

  it('formats an index back to its category name', () => {
    const scale = createXScale('category', ['Mon', 'Tue']);
    expect(scale.formatLabel(new Date(scale.toInternal('Tue')))).toBe('Tue');
  });

  it('returns an empty label for an out-of-range position', () => {
    const scale = createXScale('category', ['Mon']);
    expect(scale.formatLabel(new Date(5 * MS_PER_DAY))).toBe('');
    expect(scale.formatLabel(new Date(-MS_PER_DAY))).toBe('');
  });

  it('coerces non-string categories via String()', () => {
    const scale = createXScale('category', [1, 2]);
    expect(scale.formatLabel(new Date(scale.toInternal(1)))).toBe('1');
  });

  it('throws for a category not present in the data', () => {
    const scale = createXScale('category', ['Mon']);
    expect(() => scale.toInternal('Sun')).toThrow('unknown category "Sun"');
  });

  it('pins a step of one day, forces UTC, and hides major labels', () => {
    const hints = createXScale('category', ['Mon', 'Tue']).axisHints();
    expect(hints.showMajorLabels).toBe(false);
    expect(hints.timeAxis).toEqual({ scale: 'day', step: 1 });
    expect(typeof hints.moment).toBe('function');
  });

  it('overrides axis labels', () => {
    expect(createXScale('category', ['Mon']).overridesLabels).toBe(true);
  });

  it('forces UTC on the axis moment (labels stay timezone-independent)', () => {
    const hints = createXScale('category', ['Mon', 'Tue']).axisHints();
    const momentFactory = hints.moment as (d: Date) => { format(fmt: string): string };
    const formatted = momentFactory(new Date('2020-06-15T23:30:00Z')).format('YYYY-MM-DD HH');
    // In any non-UTC zone this would read a different hour/day if .utc()
    // were dropped from UTC_MOMENT.
    expect(formatted).toBe('2020-06-15 23');
  });

  // FIX 1: a category "duration" has no anchor at all (unlike numeric), so
  // it is simply N days.
  it('scales a duration as N whole days, with no step or anchor involved', () => {
    const scale = createXScale('category', ['Mon', 'Tue', 'Wed']);
    expect(scale.toInternalDuration(2)).toBe(2 * MS_PER_DAY);
  });

  it('throws for a non-numeric duration', () => {
    const scale = createXScale('category', ['Mon']);
    expect(() => scale.toInternalDuration('abc')).toThrow('not a number');
  });
});
