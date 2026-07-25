import { describe, it, expect } from 'vitest';
import { createXScale, chooseNiceStep, MS_PER_DAY } from './x-scale';

// The valid JS Date range is +/- 8.64e15ms from the epoch.
const MAX_VALID_DATE_MS = 8.64e15;

describe('time scale', () => {
  it('passes ISO date strings through to epoch ms', () => {
    const scale = createXScale('time', ['2026-01-01']);
    expect(scale.toInternal('2026-01-01')).toBe(Date.parse('2026-01-01'));
  });

  it('accepts Date objects', () => {
    const scale = createXScale('time', []);
    const d = new Date('2026-03-05T00:00:00Z');
    expect(scale.toInternal(d)).toBe(d.getTime());
  });

  it('treats plain numbers as epoch milliseconds', () => {
    const scale = createXScale('time', [0]);
    expect(scale.toInternal(1700000000000)).toBe(1700000000000);
  });

  it('does not override axis labels and forces no timezone', () => {
    const scale = createXScale('time', ['2026-01-01']);
    expect(scale.overridesLabels).toBe(false);
    const hints = scale.axisHints();
    expect(hints).toEqual({});
    expect('moment' in hints).toBe(false);
  });

  it('throws for an unparseable date', () => {
    const scale = createXScale('time', []);
    expect(() => scale.toInternal('not a date')).toThrow('not a valid date');
  });
});

describe('chooseNiceStep', () => {
  it('returns exact 1/2/5/10 boundary steps at the ones magnitude', () => {
    expect(chooseNiceStep(10)).toBe(1);
    expect(chooseNiceStep(20)).toBe(2);
    expect(chooseNiceStep(50)).toBe(5);
  });

  it('returns exact 1/2/5 boundary steps at the tens magnitude', () => {
    expect(chooseNiceStep(100)).toBe(10);
    expect(chooseNiceStep(200)).toBe(20);
    expect(chooseNiceStep(500)).toBe(50);
    expect(chooseNiceStep(1000)).toBe(100);
  });

  it('returns 1 for a zero or negative span', () => {
    expect(chooseNiceStep(0)).toBe(1);
    expect(chooseNiceStep(-5)).toBe(1);
  });

  it('returns 1 for a non-finite span', () => {
    expect(chooseNiceStep(Infinity)).toBe(1);
    expect(chooseNiceStep(NaN)).toBe(1);
  });
});

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
});

describe('createXScale', () => {
  it('throws for an unknown mode', () => {
    // @ts-expect-error deliberately invalid mode
    expect(() => createXScale('polar', [])).toThrow('Unknown xAxis mode "polar"');
  });
});
