import { describe, it, expect } from 'vitest';
import { compileGroup } from './series';

describe('compileGroup', () => {
  it('defaults content to the group id', () => {
    expect(compileGroup({ id: 'a' }).content).toBe('a');
  });

  it('keeps an explicit content string', () => {
    expect(compileGroup({ id: 'a', content: 'Series A' }).content).toBe('Series A');
  });

  it('compiles type to vis options.style', () => {
    expect(compileGroup({ id: 'a', type: 'bar' }).options?.style).toBe('bar');
  });

  it('compiles color to stroke and fill', () => {
    const style = compileGroup({ id: 'a', color: '#e11d48' }).style;
    expect(style).toContain('stroke:#e11d48');
    expect(style).toContain('fill:#e11d48');
  });

  it('compiles width to stroke-width', () => {
    expect(compileGroup({ id: 'a', width: 2 }).style).toContain('stroke-width:2');
  });

  it('compiles dashes to stroke-dasharray', () => {
    expect(compileGroup({ id: 'a', dashes: [5, 5] }).style).toContain(
      'stroke-dasharray:5 5'
    );
  });

  it('omits the style property entirely when nothing styles it', () => {
    expect(compileGroup({ id: 'a' }).style).toBeUndefined();
  });

  it('compiles fill: true to zero-oriented shading', () => {
    expect(compileGroup({ id: 'a', fill: true }).options?.shaded).toEqual({
      orientation: 'zero',
    });
  });

  it('compiles fill: false to disabled shading', () => {
    expect(compileGroup({ id: 'a', fill: false }).options?.shaded).toEqual({
      enabled: false,
    });
  });

  it('compiles fill.below to bottom orientation', () => {
    expect(compileGroup({ id: 'a', fill: { below: 0 } }).options?.shaded).toEqual({
      orientation: 'bottom',
    });
  });

  it('compiles fill.above to top orientation', () => {
    expect(compileGroup({ id: 'a', fill: { above: 0 } }).options?.shaded).toEqual({
      orientation: 'top',
    });
  });

  it('compiles fill.to to a groupId reference', () => {
    expect(compileGroup({ id: 'a', fill: { to: 'b' } }).options?.shaded).toEqual({
      groupId: 'b',
    });
  });

  it('compiles a named interpolation to an enabled parametrization', () => {
    expect(
      compileGroup({ id: 'a', interpolation: 'centripetal' }).options?.interpolation
    ).toEqual({ enabled: true, parametrization: 'centripetal' });
  });

  it('compiles interpolation: false to disabled', () => {
    expect(
      compileGroup({ id: 'a', interpolation: false }).options?.interpolation
    ).toEqual({ enabled: false });
  });

  it('compiles points: false to disabled drawPoints', () => {
    expect(compileGroup({ id: 'a', points: false }).options?.drawPoints).toBe(false);
  });

  it('compiles a points object to enabled drawPoints', () => {
    expect(
      compileGroup({ id: 'a', points: { style: 'circle', size: 6 } }).options?.drawPoints
    ).toEqual({ enabled: true, style: 'circle', size: 6 });
  });

  it('passes className straight through', () => {
    expect(compileGroup({ id: 'a', className: 'revenue' }).className).toBe('revenue');
  });

  it('passes visible straight through', () => {
    expect(compileGroup({ id: 'a', visible: false }).visible).toBe(false);
  });

  it('passes unknown vis fields through into options', () => {
    const options = compileGroup({
      id: 'a',
      yAxisOrientation: 'right',
      excludeFromLegend: true,
      excludeFromStacking: true,
      barChart: { sideBySide: true },
      sampling: false,
      sort: false,
    }).options;
    expect(options?.yAxisOrientation).toBe('right');
    expect(options?.excludeFromLegend).toBe(true);
    expect(options?.excludeFromStacking).toBe(true);
    expect(options?.barChart).toEqual({ sideBySide: true });
    expect(options?.sampling).toBe(false);
    expect(options?.sort).toBe(false);
  });

  it('never leaks authoring-only fields into vis options', () => {
    const options = compileGroup({
      id: 'a',
      content: 'A',
      type: 'line',
      color: 'red',
      width: 1,
      dashes: [2],
      fill: true,
      points: false,
      interpolation: false,
      x: [1],
      y: [2],
      data: 'f.csv',
      className: 'c',
      visible: true,
    }).options!;
    for (const key of ['content', 'id', 'type', 'color', 'width', 'dashes', 'fill', 'points', 'x', 'y', 'data', 'className', 'visible']) {
      expect(options).not.toHaveProperty(key);
    }
  });

  it('lets a raw style string override compiled friendly styles', () => {
    const group = compileGroup({ id: 'a', color: 'red', style: 'stroke:blue;' });
    expect(group.style).toBe('stroke:blue;');
  });

  it('never treats a raw style string as a graph type', () => {
    const group = compileGroup({ id: 'a', style: 'stroke:blue;' });
    expect(group.style).toBe('stroke:blue;');
    expect(group.options?.style).toBeUndefined();
  });

  it('lets raw options override compiled friendly options', () => {
    const group = compileGroup({
      id: 'a',
      type: 'line',
      fill: true,
      options: { style: 'bar', shaded: { orientation: 'top' } },
    });
    expect(group.options?.style).toBe('bar');
    expect(group.options?.shaded).toEqual({ orientation: 'top' });
  });

  it('merges raw options without discarding untouched compiled ones', () => {
    const group = compileGroup({
      id: 'a',
      type: 'line',
      fill: true,
      options: { style: 'bar' },
    });
    expect(group.options?.style).toBe('bar');
    expect(group.options?.shaded).toEqual({ orientation: 'zero' });
  });

  it('omits options entirely when the group needs none', () => {
    expect(compileGroup({ id: 'a', content: 'A' }).options).toBeUndefined();
  });

  it('accepts every valid "type" value', () => {
    expect(compileGroup({ id: 'a', type: 'line' }).options?.style).toBe('line');
    expect(compileGroup({ id: 'a', type: 'bar' }).options?.style).toBe('bar');
    expect(compileGroup({ id: 'a', type: 'points' }).options?.style).toBe('points');
  });

  it('throws a plain-language error for an invalid "type" value', () => {
    expect(() =>
      compileGroup({ id: 'a', type: 'scatter' as unknown as 'line' })
    ).toThrow(
      'Group "a" has an invalid "type" value: "scatter". Valid values are "line", "bar", and "points".'
    );
  });

  it('accepts a fill object with a recognized key', () => {
    expect(compileGroup({ id: 'a', fill: { below: 0 } }).options?.shaded).toEqual({
      orientation: 'bottom',
    });
  });

  it('throws a plain-language error for a fill object with no recognized key', () => {
    expect(() =>
      compileGroup({ id: 'a', fill: { blow: 0 } as unknown as { below: number } })
    ).toThrow(
      'Group "a" has a "fill" object with no recognized key. Use "to", "below", or "above".'
    );
  });

  it('accepts a numeric width', () => {
    expect(compileGroup({ id: 'a', width: 3 }).style).toContain('stroke-width:3');
  });

  it('throws a plain-language error for a non-numeric width', () => {
    expect(() =>
      compileGroup({ id: 'a', width: 'thick' as unknown as number })
    ).toThrow('Group "a" has a "width" value that is not a number.');
  });

  it('accepts a dashes array of numbers', () => {
    expect(compileGroup({ id: 'a', dashes: [5, 5] }).style).toContain(
      'stroke-dasharray:5 5'
    );
  });

  it('throws a plain-language error for a non-array dashes value', () => {
    expect(() =>
      compileGroup({ id: 'a', dashes: '5,5' as unknown as number[] })
    ).toThrow('Group "a" has a "dashes" value that is not a list of numbers.');
  });

  it('throws a plain-language error for a dashes array with a non-numeric entry', () => {
    expect(() =>
      compileGroup({ id: 'a', dashes: ['a', 'b'] as unknown as number[] })
    ).toThrow('Group "a" has a "dashes" value with a non-numeric entry.');
  });
});
