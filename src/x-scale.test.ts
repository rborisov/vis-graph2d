import { describe, it, expect } from 'vitest';
import { createXScale, MS_PER_DAY } from './x-scale';

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

  it('does not override axis labels', () => {
    const scale = createXScale('time', ['2026-01-01']);
    expect(scale.overridesLabels).toBe(false);
    expect(scale.axisHints()).toEqual({});
  });

  it('throws for an unparseable date', () => {
    const scale = createXScale('time', []);
    expect(() => scale.toInternal('not a date')).toThrow('not a valid date');
  });
});

describe('numeric scale', () => {
  it('round-trips whole numbers', () => {
    const scale = createXScale('numeric', [0, 50, 100]);
    for (const n of [0, 1, 50, 99, 100]) {
      expect(scale.formatLabel(new Date(scale.toInternal(n)))).toBe(String(n));
    }
  });

  it('round-trips fractional values in a sub-unit range', () => {
    const scale = createXScale('numeric', [0, 0.5, 1]);
    expect(scale.formatLabel(new Date(scale.toInternal(0.25)))).toBe('0.25');
    expect(scale.formatLabel(new Date(scale.toInternal(1)))).toBe('1');
  });

  it('round-trips very large values', () => {
    const scale = createXScale('numeric', [0, 1000000]);
    expect(scale.formatLabel(new Date(scale.toInternal(750000)))).toBe('750000');
  });

  it('round-trips negative values', () => {
    const scale = createXScale('numeric', [-100, 100]);
    expect(scale.formatLabel(new Date(scale.toInternal(-40)))).toBe('-40');
  });

  it('accepts numeric strings', () => {
    const scale = createXScale('numeric', [0, 10]);
    expect(scale.toInternal('5')).toBe(scale.toInternal(5));
  });

  it('maps the data span onto 10-1000 internal days for any magnitude', () => {
    for (const span of [0.01, 1, 100, 12345, 1e6]) {
      const scale = createXScale('numeric', [0, span]);
      const days = (scale.toInternal(span) - scale.toInternal(0)) / MS_PER_DAY;
      expect(days).toBeGreaterThanOrEqual(10);
      expect(days).toBeLessThanOrEqual(1000);
    }
  });

  it('pins a day-scale step and hides major labels', () => {
    const hints = createXScale('numeric', [0, 100]).axisHints();
    expect(hints.showMajorLabels).toBe(false);
    expect((hints.timeAxis as { scale: string }).scale).toBe('day');
    expect((hints.timeAxis as { step: number }).step).toBeGreaterThanOrEqual(1);
  });

  it('chooses a step that yields a readable number of labels', () => {
    const hints = createXScale('numeric', [0, 100]).axisHints();
    const step = (hints.timeAxis as { step: number }).step;
    const scale = createXScale('numeric', [0, 100]);
    const totalDays = (scale.toInternal(100) - scale.toInternal(0)) / MS_PER_DAY;
    const labelCount = totalDays / step;
    expect(labelCount).toBeGreaterThanOrEqual(4);
    expect(labelCount).toBeLessThanOrEqual(20);
  });

  it('handles a zero-width span without dividing by zero', () => {
    const scale = createXScale('numeric', [5, 5]);
    expect(Number.isFinite(scale.toInternal(5))).toBe(true);
    expect((scale.axisHints().timeAxis as { step: number }).step).toBe(1);
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

  it('pins a step of one day and hides major labels', () => {
    const hints = createXScale('category', ['Mon', 'Tue']).axisHints();
    expect(hints.showMajorLabels).toBe(false);
    expect(hints.timeAxis).toEqual({ scale: 'day', step: 1 });
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
