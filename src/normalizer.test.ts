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

  // CONVERTED for FIX 6: unifies the predicate voice with the rest of the
  // codebase's "must be X" wrong-type messages, and (per the same fix)
  // distinguishes a present-but-wrong-type "y" from one that is simply
  // absent, rather than quoting back the literal string "undefined".
  it('throws for a non-numeric y value naming the row', () => {
    expect(() =>
      chartFrom('items:\n  - { x: "2026-01-01", y: "abc" }')
    ).toThrow('Item 0\'s "y" must be a number (got "abc")');
  });

  it('throws for a missing y value naming the row, without quoting "undefined"', () => {
    expect(() => chartFrom('items:\n  - { x: "2026-01-01" }')).toThrow(
      'Item 0 is missing "y".'
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
    ).toThrow('Block has an invalid "xAxis" value: "polar"');
  });

  it('reports the failing row index for a bad x value', () => {
    expect(() =>
      chartFrom('options: { xAxis: numeric }\nitems:\n  - { x: "abc", y: 1 }')
    ).toThrow('Item 0 has an invalid "x" value');
  });

  // The numeric scale derives its step and anchor from the full data range, so
  // it must see columnar x values as well as inline ones. Feeding it only
  // `block.items` mis-scales the chart silently — no error, just wrong axis.
  it('builds the numeric scale from inline and columnar x values together', () => {
    const chart = chartFrom(
      'options: { xAxis: numeric }\n' +
        'items:\n  - { x: 0, y: 1 }\n' +
        'x: [500, 1000]\ngroups:\n  - id: a\n    y: [2, 3]'
    );
    // The scale maps one chosen step onto one internal day, targeting roughly
    // ten ticks, so a correctly-built scale spans on the order of ten days.
    // If the columnar values were excluded, the step would be derived from the
    // zero-width range of the single inline point and every unit would become
    // a whole day — stretching this chart to 1000 days and a ruined axis.
    const positions = chart.items.map((item) => item.x.getTime());
    const spanDays = (Math.max(...positions) - Math.min(...positions)) / 86400000;
    expect(spanDays).toBeGreaterThan(1);
    expect(spanDays).toBeLessThanOrEqual(20);
  });

  // Left to vis, this throws from inside the Graph2d constructor after it has
  // already registered a resize listener, leaking it with no instance to
  // destroy. Rejecting it here is both a cleaner message and a closed leak.
  it('throws for a duplicated group id', () => {
    expect(() =>
      chartFrom('groups:\n  - id: a\n  - id: a\nitems:\n  - { x: "2026-01-01", y: 1 }')
    ).toThrow('Group "a" is declared more than once.');
  });

  it('treats a numeric and string group id as the same declaration', () => {
    expect(() =>
      chartFrom('groups:\n  - id: 1\n  - id: "1"\nitems:\n  - { x: "2026-01-01", y: 1 }')
    ).toThrow('is declared more than once');
  });

  // FIX 1: start/end/min/max are author-unit POSITIONS. Left unmapped, vis
  // reads them as raw epoch milliseconds while the chart itself lives on the
  // warped internal axis (one chosen step == one internal day), collapsing
  // the visible window to a ~10ms sliver. They must be routed through the
  // same scale.toInternal() used for item x/end values.
  describe('start/end/min/max axis-range options (FIX 1)', () => {
    // x: [1,3,5,7,9] -> span 8 -> chooseNiceStep(8) == 1 -> anchor == floor(1/1)*1 == 1.
    const source =
      'options: { xAxis: numeric, start: 1, end: 5 }\n' +
      'items:\n' +
      '  - { x: 1, y: 1 }\n  - { x: 3, y: 2 }\n  - { x: 5, y: 3 }\n  - { x: 7, y: 4 }\n  - { x: 9, y: 5 }';

    it('maps numeric start/end through the scale instead of forwarding raw', () => {
      const chart = chartFrom(source);
      expect(chart.visOptions.start).toBeInstanceOf(Date);
      expect(chart.visOptions.end).toBeInstanceOf(Date);
      expect((chart.visOptions.start as Date).getTime()).toBe(chart.scale.toInternal(1));
      expect((chart.visOptions.end as Date).getTime()).toBe(chart.scale.toInternal(5));
      // Sanity: this must be a multi-day span, not a ~10ms sliver.
      const spanMs =
        (chart.visOptions.end as Date).getTime() - (chart.visOptions.start as Date).getTime();
      expect(spanMs).toBe(4 * 86400000);
    });

    it('maps numeric min/max through the scale instead of forwarding raw', () => {
      const chart = chartFrom(
        'options: { xAxis: numeric, min: 0, max: 10 }\n' +
          'items:\n  - { x: 1, y: 1 }\n  - { x: 3, y: 2 }\n  - { x: 5, y: 3 }\n  - { x: 7, y: 4 }\n  - { x: 9, y: 5 }'
      );
      expect(chart.visOptions.min).toBeInstanceOf(Date);
      expect(chart.visOptions.max).toBeInstanceOf(Date);
      expect((chart.visOptions.min as Date).getTime()).toBe(chart.scale.toInternal(0));
      expect((chart.visOptions.max as Date).getTime()).toBe(chart.scale.toInternal(10));
    });

    it('maps a category start/end through the scale instead of throwing "Invalid start NaN"', () => {
      const chart = chartFrom(
        'options: { xAxis: category, start: Mon, end: Wed }\n' +
          'items:\n  - { x: Mon, y: 1 }\n  - { x: Tue, y: 2 }\n  - { x: Wed, y: 3 }'
      );
      expect(chart.visOptions.start).toBeInstanceOf(Date);
      expect(chart.visOptions.end).toBeInstanceOf(Date);
      expect((chart.visOptions.start as Date).getTime()).toBe(chart.scale.toInternal('Mon'));
      expect((chart.visOptions.end as Date).getTime()).toBe(chart.scale.toInternal('Wed'));
    });

    it('maps a category min/max through the scale', () => {
      const chart = chartFrom(
        'options: { xAxis: category, min: Mon, max: Wed }\n' +
          'items:\n  - { x: Mon, y: 1 }\n  - { x: Tue, y: 2 }\n  - { x: Wed, y: 3 }'
      );
      expect((chart.visOptions.min as Date).getTime()).toBe(chart.scale.toInternal('Mon'));
      expect((chart.visOptions.max as Date).getTime()).toBe(chart.scale.toInternal('Wed'));
    });

    it('throws a clear, option-naming error for an unmappable category start', () => {
      expect(() =>
        chartFrom(
          'options: { xAxis: category, start: Friday }\n' +
            'items:\n  - { x: Mon, y: 1 }\n  - { x: Tue, y: 2 }'
        )
      ).toThrow(/"start"/);
    });

    it('leaves start/end/min/max untouched on the time axis (unchanged behaviour)', () => {
      const chart = chartFrom(
        'options: { start: "2026-01-01", end: "2026-01-08" }\n' +
          'items:\n  - { x: "2026-01-01", y: 1 }\n  - { x: "2026-01-08", y: 2 }'
      );
      expect(chart.visOptions.start).toBe('2026-01-01');
      expect(chart.visOptions.end).toBe('2026-01-08');
    });

    // zoomMin/zoomMax are DURATIONS in the same warped space (one chosen
    // step == one internal day), not positions -- scaling them requires
    // dividing by the step rather than subtracting the anchor. Conclusion
    // recorded in final-fixes-report.md.
    it('scales numeric zoomMin/zoomMax as durations (divide by step), not positions', () => {
      const chart = chartFrom(
        'options: { xAxis: numeric, zoomMin: 2, zoomMax: 6 }\n' +
          'items:\n  - { x: 1, y: 1 }\n  - { x: 3, y: 2 }\n  - { x: 5, y: 3 }\n  - { x: 7, y: 4 }\n  - { x: 9, y: 5 }'
      );
      // step == 1 for this data (see above), so 2 author-units == 2 internal days.
      expect(chart.visOptions.zoomMin).toBe(2 * 86400000);
      expect(chart.visOptions.zoomMax).toBe(6 * 86400000);
      expect(typeof chart.visOptions.zoomMin).toBe('number');
    });

    it('scales category zoomMin/zoomMax as durations (one category == one internal day)', () => {
      const chart = chartFrom(
        'options: { xAxis: category, zoomMin: 2 }\n' +
          'items:\n  - { x: Mon, y: 1 }\n  - { x: Tue, y: 2 }\n  - { x: Wed, y: 3 }'
      );
      expect(chart.visOptions.zoomMin).toBe(2 * 86400000);
    });
  });

  // Same requirement for category mode: indices are assigned in
  // first-appearance order across every source of points.
  it('assigns category indices across inline and columnar values together', () => {
    const chart = chartFrom(
      'options: { xAxis: category }\n' +
        'items:\n  - { x: Mon, y: 1 }\n' +
        'x: [Tue, Wed]\ngroups:\n  - id: a\n    y: [2, 3]'
    );
    expect(chart.items.map((item) => chart.scale.formatLabel(item.x))).toEqual([
      'Mon',
      'Tue',
      'Wed',
    ]);
  });
});
