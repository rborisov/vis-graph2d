import { describe, it, expect } from 'vitest';
import { createXScale, chooseNiceStep } from './x-scale';

// Numeric- and category-scale coverage lives in x-scale-values.test.ts,
// split out to keep this file under the repo's ~300-line budget.

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

  it('passes a duration through as milliseconds (never actually used: overridesLabels is false)', () => {
    const scale = createXScale('time', []);
    expect(scale.toInternalDuration(86400000)).toBe(86400000);
  });

  it('throws for a non-numeric duration', () => {
    const scale = createXScale('time', []);
    expect(() => scale.toInternalDuration('abc')).toThrow('not a number of milliseconds');
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

describe('createXScale', () => {
  it('throws for an unknown mode', () => {
    // @ts-expect-error deliberately invalid mode
    expect(() => createXScale('polar', [])).toThrow(
      'Block has an invalid "xAxis" value: "polar"'
    );
  });
});
