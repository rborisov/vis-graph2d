// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { parseBlock } from './parser';
import { normalize } from './normalizer';
import { renderGraph2d } from './renderer';
import type { Graph2dHandle } from './renderer';
import { stubLayout, stubCreateEl, stubClassMethods } from './test-dom';
import type { MomentLike } from './x-scale';
import type { NormalizedChart } from './types';
import { resolveData } from './data-source';

// stubCreateEl: not in the brief's given test file. renderer.ts and main.ts
// call Obsidian's `el.createEl(...)`, which has no runtime implementation
// under happy-dom (the `obsidian` package here is types-only). See test-dom.ts.
beforeAll(() => {
  stubCreateEl();
  stubLayout();
  stubClassMethods();
});

/**
 * Creates a detached-then-attached host element for a chart to render into.
 * Centralizing the `document.createElement`/`document.body.appendChild` pair
 * here (instead of repeating it at every call site) keeps `obsidianmd/
 * prefer-active-doc` warnings to a single definition rather than one per
 * test -- this is a test harness with no popout-window concept, so the rule
 * doesn't meaningfully apply, but there is no reason to multiply the warning
 * count either.
 */
function createHost(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function render(source: string): HTMLElement {
  const el = createHost();
  const chart = normalize(parseBlock(source));
  renderGraph2d(el, chart);
  return el;
}

describe('renderGraph2d', () => {
  it('creates the plugin container', () => {
    const el = render('items:\n  - { x: "2026-01-01", y: 10 }');
    expect(el.querySelector('.graph2d-plugin')).not.toBeNull();
  });

  it('renders vis panels into the container', () => {
    const el = render('items:\n  - { x: "2026-01-01", y: 10 }');
    expect(el.querySelector('.vis-panel')).not.toBeNull();
  });

  it('applies an explicit height to the container', () => {
    const el = render(
      'options: { height: 250px }\nitems:\n  - { x: "2026-01-01", y: 1 }'
    );
    const container = el.querySelector<HTMLElement>('.graph2d-plugin');
    expect(container?.style.height).toBe('250px');
  });

  it('renders a bar chart without throwing', () => {
    const el = render(
      'groups:\n  - id: a\n    type: bar\nitems:\n  - { x: "2026-01-01", y: 5, group: a }'
    );
    expect(el.querySelector('.vis-panel')).not.toBeNull();
  });

  it('destroy() tears the chart down', () => {
    const el = createHost();
    const graph = renderGraph2d(el, normalize(parseBlock('items:\n  - { x: "2026-01-01", y: 1 }')));
    graph.destroy();
    expect(el.querySelector('.vis-panel')).toBeNull();
  });

  it('applies the label formatter without tripping vis option validation', () => {
    // This test's whole point is to prove vis's option validator does NOT
    // write "Errors have been found" to console.log.
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      render('options: { xAxis: numeric }\nitems:\n  - { x: 1, y: 1 }\n  - { x: 50, y: 2 }');
    } finally {
      spy.mockRestore();
    }
    const text = spy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(text).not.toContain('Errors have been found');
  });

  it('leaves no container behind when construction throws', () => {
    const el = createHost();
    // Built directly rather than through normalize(), which now rejects
    // duplicate group ids itself. This test guards renderGraph2d's own
    // cleanup, so it must hand vis input that vis is the one to reject:
    // duplicate ids make the Graph2d constructor throw from setGroups.
    const chart = normalize(parseBlock('items:\n  - { x: "2026-01-01", y: 1, group: a }'));
    chart.groups = [
      { id: 'a', content: 'A' },
      { id: 'a', content: 'A again' },
    ];
    expect(() => renderGraph2d(el, chart)).toThrow();
    expect(el.querySelector('.graph2d-plugin')).toBeNull();
  });
});

/**
 * Task 10's export path: `renderGraph2d(el, chart, true)` is how main.ts
 * renders a chart destined for rasterize() (see rasterize.test.ts and
 * main.test.ts for the rest of that path -- rasterize() itself needs a real
 * canvas and cannot run under happy-dom). These tests are the regression
 * check that matters most here: the export path must only ever change
 * behavior when `exportMode` is explicitly true, never for a normal render.
 */
describe('renderGraph2d export path (autoHeight)', () => {
  function svgHeight(el: HTMLElement): string | undefined {
    return el.querySelector<SVGElement>('.vis-line-graph svg')?.style.height;
  }

  it('adds the export-width class when autoHeight is true', () => {
    const el = createHost();
    const chart = normalize(parseBlock('items:\n  - { x: "2026-01-01", y: 1 }'));
    renderGraph2d(el, chart, true);
    const container = el.querySelector('.graph2d-plugin');
    expect(container?.classList.contains('g2d-export-width')).toBe(true);
  });

  it('does not add the export-width class on a normal render', () => {
    const el = render('items:\n  - { x: "2026-01-01", y: 10 }');
    const container = el.querySelector('.graph2d-plugin');
    expect(container?.classList.contains('g2d-export-width')).toBe(false);
  });

  it('does not apply a fixed container height on the export path, even when the block sets one', () => {
    const el = createHost();
    const chart = normalize(
      parseBlock('options: { height: 900px }\nitems:\n  - { x: "2026-01-01", y: 1 }')
    );
    renderGraph2d(el, chart, true);
    const container = el.querySelector<HTMLElement>('.graph2d-plugin');
    expect(container?.style.height).toBe('');
  });

  it('still applies a fixed container height on a normal render with an explicit height', () => {
    const el = createHost();
    const chart = normalize(
      parseBlock('options: { height: 900px }\nitems:\n  - { x: "2026-01-01", y: 1 }')
    );
    renderGraph2d(el, chart, false);
    const container = el.querySelector<HTMLElement>('.graph2d-plugin');
    expect(container?.style.height).toBe('900px');
  });

  it('draws at the chart\'s configured height on the export path, not the 400px default', () => {
    // Regression test for the known defect this task fixes: previously the
    // export path always reset graphHeight to the 400px default and
    // silently discarded an explicit chart.height, so a taller chart got
    // cropped in the rasterized image instead of actually growing to fit.
    const el = createHost();
    const chart = normalize(
      parseBlock('options: { height: 900px }\nitems:\n  - { x: "2026-01-01", y: 1 }')
    );
    renderGraph2d(el, chart, true);
    expect(svgHeight(el)).toBe('900px');
  });

  it('draws at the 400px default on the export path when no height is configured', () => {
    const el = createHost();
    const chart = normalize(parseBlock('items:\n  - { x: "2026-01-01", y: 1 }'));
    renderGraph2d(el, chart, true);
    expect(svgHeight(el)).toBe('400px');
  });
});

/**
 * happy-dom has no layout engine: even with stubLayout() applied, vis
 * believes a single label fills the whole axis and renders only one or two
 * degenerate ticks, so asserting on rendered `.vis-text` node content is
 * worthless (see test-dom.ts). Instead these tests walk vis's own TimeStep
 * iterator directly -- pure date math, no layout required -- and run each
 * tick through the chart's own `scale.formatLabel`, exactly mirroring what
 * TimeAxis._repaintLabels does internally to produce the labels it renders.
 */
describe('axis label sequences (via TimeStep, layout-independent)', () => {
  /**
   * vis does not export TimeStep/TimeAxis types, so this narrows the cast to
   * exactly the surface used here: `timeAxis.step`, populated by TimeAxis's
   * own redraw pass, which the initial `renderGraph2d` construction already
   * triggers synchronously.
   */
  interface TimeStepLike {
    start(): void;
    hasNext(): boolean;
    next(): void;
    getCurrent(): MomentLike;
  }
  interface Graph2dWithTimeAxis {
    timeAxis: { step: TimeStepLike };
  }

  const MAX_TICKS = 1000;

  function walkTicks(graph: Graph2dHandle): MomentLike[] {
    const step = (graph as unknown as Graph2dWithTimeAxis).timeAxis.step;
    const ticks: MomentLike[] = [];
    step.start();
    let iterations = 0;
    while (step.hasNext() && iterations < MAX_TICKS) {
      ticks.push(step.getCurrent());
      step.next();
      iterations++;
    }
    return ticks;
  }

  function tickLabels(chart: NormalizedChart, graph: Graph2dHandle): string[] {
    return walkTicks(graph).map((tick) => chart.scale.formatLabel(tick));
  }

  /**
   * Builds a chart with an explicit start/end at the data bounds, expressed
   * through the scale's own `toInternal` so the displayed range matches the
   * data exactly. Block-level `start`/`end` options are forwarded to vis
   * as-is (see normalizer.ts's PLUGIN_OPTIONS), without going through the
   * scale, so setting them here directly on `visOptions` -- post-normalize,
   * pre-render -- is the only way to pin the range in the scale's own
   * internal domain rather than vis's raw interpretation of author values.
   */
  function renderWithBounds(
    source: string,
    minValue: unknown,
    maxValue: unknown
  ): { chart: NormalizedChart; graph: Graph2dHandle } {
    const chart = normalize(parseBlock(source));
    chart.visOptions.start = new Date(chart.scale.toInternal(minValue));
    chart.visOptions.end = new Date(chart.scale.toInternal(maxValue));
    const el = createHost();
    const graph = renderGraph2d(el, chart);
    return { chart, graph };
  }

  it('numeric axis: [0, 100] -> 0..100 step 10', () => {
    const { chart, graph } = renderWithBounds(
      'options: { xAxis: numeric }\nitems:\n  - { x: 0, y: 0 }\n  - { x: 100, y: 1 }',
      0,
      100
    );
    expect(tickLabels(chart, graph)).toEqual([
      '0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100',
    ]);
  });

  it('numeric axis: [0, 1] -> 0..1 step 0.1', () => {
    const { chart, graph } = renderWithBounds(
      'options: { xAxis: numeric }\nitems:\n  - { x: 0, y: 0 }\n  - { x: 1, y: 1 }',
      0,
      1
    );
    expect(tickLabels(chart, graph)).toEqual([
      '0', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1',
    ]);
  });

  it('numeric axis: [0, 7] -> 0..7 step 1', () => {
    const { chart, graph } = renderWithBounds(
      'options: { xAxis: numeric }\nitems:\n  - { x: 0, y: 0 }\n  - { x: 7, y: 1 }',
      0,
      7
    );
    expect(tickLabels(chart, graph)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
  });

  it('numeric axis: [-100, 100] -> -100..100 step 20', () => {
    const { chart, graph } = renderWithBounds(
      'options: { xAxis: numeric }\nitems:\n  - { x: -100, y: 0 }\n  - { x: 100, y: 1 }',
      -100,
      100
    );
    expect(tickLabels(chart, graph)).toEqual([
      '-100', '-80', '-60', '-40', '-20', '0', '20', '40', '60', '80', '100',
    ]);
  });

  it('numeric axis: [1700000000, 1700000010] -> step 1, 11 ticks', () => {
    const { chart, graph } = renderWithBounds(
      'options: { xAxis: numeric }\nitems:\n  - { x: 1700000000, y: 0 }\n  - { x: 1700000010, y: 1 }',
      1700000000,
      1700000010
    );
    const expected = Array.from({ length: 11 }, (_, i) => String(1700000000 + i));
    expect(tickLabels(chart, graph)).toEqual(expected);
  });

  it('category axis: names in first-seen order', () => {
    const { chart, graph } = renderWithBounds(
      'options: { xAxis: category }\nitems:\n' +
        '  - { x: Mon, y: 1 }\n  - { x: Tue, y: 2 }\n  - { x: Wed, y: 3 }\n' +
        '  - { x: Thu, y: 4 }\n  - { x: Fri, y: 5 }',
      'Mon',
      'Fri'
    );
    expect(tickLabels(chart, graph)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  });

  it('installs no formatter for the time axis', () => {
    const chart = normalize(parseBlock(
      'items:\n  - { x: "2026-01-01", y: 1 }\n  - { x: "2026-01-05", y: 2 }'
    ));
    chart.visOptions.start = new Date(Date.parse('2026-01-01'));
    chart.visOptions.end = new Date(Date.parse('2026-01-05'));
    const el = createHost();
    const graph = renderGraph2d(el, chart);
    const step = (graph as unknown as { timeAxis: { step: { start(): void; getLabelMinor(): string } } }).timeAxis.step;
    step.start();
    // TimeScale.formatLabel() returns '' by design; a non-empty label proves
    // vis's own date formatting is still in charge.
    expect(step.getLabelMinor()).not.toBe('');
  });

  it('does not force UTC on the time axis', () => {
    const chart = normalize(parseBlock('items:\n  - { x: "2026-01-01", y: 1 }'));
    expect(chart.visOptions).not.toHaveProperty('moment');
  });
});

describe('file-backed charts', () => {
  it('renders a chart whose data came from a CSV file', async () => {
    const el = createHost();
    const reader = {
      read: async (path: string) =>
        path === 'charts/series.csv' ? 'x,y,group\n1,10,a\n2,25,a\n3,18,a' : null,
    };
    const block = await resolveData(
      parseBlock('options: { xAxis: numeric }\ndata: charts/series.csv\ngroups:\n  - id: a'),
      reader
    );
    renderGraph2d(el, normalize(block));
    expect(el.querySelector('.vis-panel')).not.toBeNull();
  });
});
