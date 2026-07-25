import { describe, it, expect } from 'vitest';
import { parseBlock } from './parser';
import { normalize } from './normalizer';

function chartFrom(source: string) {
  return normalize(parseBlock(source));
}

describe('normalize', () => {
  it('converts inline items into vis points with Date x values', () => {
    const chart = chartFrom('items:\n  - { x: "2026-01-01", y: 5 }');
    expect(chart.items).toHaveLength(1);
    expect(chart.items[0]!.x).toBeInstanceOf(Date);
    expect(chart.items[0]!.y).toBe(5);
  });

  it('defaults to the time axis', () => {
    const chart = chartFrom('items:\n  - { x: "2026-01-01", y: 5 }');
    expect(chart.scale.overridesLabels).toBe(false);
  });

  it('uses the numeric scale when xAxis is numeric', () => {
    const chart = chartFrom(
      'options: { xAxis: numeric }\nitems:\n  - { x: 1, y: 5 }\n  - { x: 10, y: 8 }'
    );
    expect(chart.scale.overridesLabels).toBe(true);
    expect(chart.items[0]!.x.getTime()).toBeLessThan(chart.items[1]!.x.getTime());
  });

  it('maps categories in first-appearance order', () => {
    const chart = chartFrom(
      'options: { xAxis: category }\nitems:\n  - { x: Mon, y: 1 }\n  - { x: Tue, y: 2 }'
    );
    expect(chart.scale.formatLabel(chart.items[0]!.x)).toBe('Mon');
    expect(chart.scale.formatLabel(chart.items[1]!.x)).toBe('Tue');
  });

  it('expands columnar data', () => {
    const chart = chartFrom(
      'options: { xAxis: numeric }\nx: [1, 2]\ngroups:\n  - id: a\n    y: [10, 20]'
    );
    expect(chart.items).toHaveLength(2);
    expect(chart.items[1]!.y).toBe(20);
    expect(chart.items[1]!.group).toBe('a');
  });

  it('converts an item end value through the same scale', () => {
    const chart = chartFrom(
      'options: { xAxis: numeric }\nitems:\n  - { x: 1, y: 5, end: 3 }'
    );
    expect(chart.items[0]!.end).toBeInstanceOf(Date);
  });

  it('preserves point labels', () => {
    const chart = chartFrom(
      'items:\n  - { x: "2026-01-01", y: 5, label: { content: "peak" } }'
    );
    expect(chart.items[0]!.label).toEqual({ content: 'peak' });
  });

  it('compiles declared groups', () => {
    const chart = chartFrom(
      'groups:\n  - id: a\n    content: A\n    type: bar\nitems:\n  - { x: "2026-01-01", y: 1, group: a }'
    );
    expect(chart.groups).toHaveLength(1);
    expect(chart.groups[0]!.options?.style).toBe('bar');
  });

  it('returns no groups when the block declares none', () => {
    const chart = chartFrom('items:\n  - { x: "2026-01-01", y: 1 }');
    expect(chart.groups).toEqual([]);
  });

  it('forwards unknown block options straight to vis', () => {
    const chart = chartFrom(
      'options:\n  legend: true\n  sampling: false\n  zoomKey: ctrlKey\nitems:\n  - { x: "2026-01-01", y: 1 }'
    );
    expect(chart.visOptions.legend).toBe(true);
    expect(chart.visOptions.sampling).toBe(false);
    expect(chart.visOptions.zoomKey).toBe('ctrlKey');
  });

  it('does not forward xAxis or height to vis', () => {
    const chart = chartFrom(
      'options: { xAxis: numeric, height: 300px }\nitems:\n  - { x: 1, y: 1 }'
    );
    expect(chart.visOptions).not.toHaveProperty('xAxis');
    expect(chart.visOptions).not.toHaveProperty('height');
    expect(chart.height).toBe('300px');
  });

  it('merges axis hints into vis options', () => {
    const chart = chartFrom(
      'options: { xAxis: numeric }\nitems:\n  - { x: 1, y: 1 }\n  - { x: 100, y: 2 }'
    );
    expect(chart.visOptions.showMajorLabels).toBe(false);
    expect((chart.visOptions.timeAxis as { scale: string }).scale).toBe('day');
  });

  it('lets explicit block options override axis hints', () => {
    const chart = chartFrom(
      'options: { xAxis: numeric, showMajorLabels: true }\nitems:\n  - { x: 1, y: 1 }'
    );
    expect(chart.visOptions.showMajorLabels).toBe(true);
  });

  it('applies supplied defaults below block options', () => {
    const chart = normalize(parseBlock('items:\n  - { x: "2026-01-01", y: 1 }'), {
      legend: true,
      height: '500px',
    });
    expect(chart.visOptions.legend).toBe(true);
    expect(chart.height).toBe('500px');
  });

  it('lets block options beat defaults', () => {
    const chart = normalize(
      parseBlock('options: { legend: false }\nitems:\n  - { x: "2026-01-01", y: 1 }'),
      { legend: true }
    );
    expect(chart.visOptions.legend).toBe(false);
  });

  it('throws for a non-numeric y value naming the row', () => {
    expect(() =>
      chartFrom('items:\n  - { x: "2026-01-01", y: "abc" }')
    ).toThrow('Item 0 has a non-numeric "y" value: "abc"');
  });

  it('throws for a missing y value naming the row', () => {
    expect(() => chartFrom('items:\n  - { x: "2026-01-01" }')).toThrow(
      'Item 0 has a non-numeric "y" value'
    );
  });

  it('throws for an item referencing an undeclared group', () => {
    expect(() =>
      chartFrom(
        'groups:\n  - id: a\nitems:\n  - { x: "2026-01-01", y: 1, group: ghost }'
      )
    ).toThrow('Item 0 references group "ghost", which is not declared.');
  });

  it('allows any group id when the block declares no groups', () => {
    const chart = chartFrom('items:\n  - { x: "2026-01-01", y: 1, group: a }');
    expect(chart.items[0]!.group).toBe('a');
  });

  it('throws for an unknown xAxis mode', () => {
    expect(() =>
      chartFrom('options: { xAxis: polar }\nitems:\n  - { x: 1, y: 1 }')
    ).toThrow('Unknown xAxis mode "polar"');
  });

  it('reports the failing row index for a bad x value', () => {
    expect(() =>
      chartFrom('options: { xAxis: numeric }\nitems:\n  - { x: "abc", y: 1 }')
    ).toThrow('Item 0 has an invalid "x" value');
  });
});
