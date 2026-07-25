import { Graph2d } from 'vis-timeline/standalone';
import type { NormalizedChart } from './types';
import type { MomentLike } from './x-scale';

export interface Graph2dHandle {
  destroy(): void;
  redraw(): void;
}

const DEFAULT_GRAPH_HEIGHT = '400px';

export function renderGraph2d(
  el: HTMLElement,
  chart: NormalizedChart,
  autoHeight = false
): Graph2dHandle {
  const container = el.createEl('div');
  container.className = 'graph2d-plugin';

  // A rasterized PNG has no scrollbar, so the export path skips the fixed
  // CSS height entirely and lets the container grow to whatever height the
  // chart actually draws at (see graphHeight below, which is what actually
  // governs that drawn height and is deliberately NOT reset for the export
  // path).
  const fixedHeight = autoHeight ? undefined : chart.height;
  if (fixedHeight !== undefined) container.style.height = fixedHeight;

  // pubobs renders offscreen at a fixed narrow width; charts need more room
  // so axis labels are not cramped. The exported <img> scales back down
  // (see .g2d-export-width in styles.css).
  if (autoHeight) container.addClass('g2d-export-width');

  const visOptions: Record<string, unknown> = {
    // Always honors the chart's own configured (or default) drawing
    // height, on both paths. This used to read `fixedHeight ??
    // DEFAULT_GRAPH_HEIGHT`, which reset the chart's actual drawn height
    // back down to the 400px default whenever autoHeight was true -- even
    // if the author had configured a taller chart.height. That defeated
    // the "grows to fit the whole chart" comment above: the export always
    // drew (and therefore captured) at 400px regardless of the chart's
    // real content, and since a static PNG has no scrollbar to reveal the
    // rest, anything past that height was silently cropped in the
    // exported image. Reading chart.height directly here means the export
    // always draws at the same height the interactive widget uses for
    // this chart -- never less.
    graphHeight: chart.height ?? DEFAULT_GRAPH_HEIGHT,
    // The export path captures once and throws the live chart away, so
    // there is nothing to resize into.
    autoResize: !autoHeight,
    ...chart.visOptions,
  };

  const Graph2dConstructor = Graph2d as unknown as new (
    ...args: unknown[]
  ) => Graph2dHandle;

  // Guards against a throw during/after construction (e.g. duplicate group
  // ids) leaving a broken half-built `.vis-timeline` in the note with
  // main.ts's error box rendered below it. If `graph` never gets assigned,
  // the throw happened inside the constructor itself and there is no
  // instance to destroy() -- but the container is still removed either way.
  let graph: Graph2dHandle | undefined;
  try {
    graph =
      chart.groups.length > 0
        ? new Graph2dConstructor(container, chart.items, chart.groups, visOptions)
        : new Graph2dConstructor(container, chart.items, visOptions);

    if (chart.scale.overridesLabels) {
      applyLabelFormatter(graph, (value: MomentLike) => chart.scale.formatLabel(value));
    }

    // Without this, iOS renders into a zero-size box.
    window.requestAnimationFrame(() => graph!.redraw());

    return graph;
  } catch (e) {
    graph?.destroy();
    container.remove();
    throw e;
  }
}

/**
 * Installs a custom axis label formatter.
 *
 * TimeStep honours a function for `format.minorLabels` at runtime, but
 * Graph2d.setOptions always runs vis's option validator, whose schema only
 * permits an object there — passing the function normally would log a
 * spurious "Errors have been found" warning on every render. Core.setOptions
 * is the same code path without the validator, one step up the prototype
 * chain (Graph2d.prototype is itself a Core instance).
 *
 * vis invokes `format` with a moment, never a Date — see MomentLike.
 */
function applyLabelFormatter(
  graph: Graph2dHandle,
  format: (value: MomentLike) => string
): void {
  const options = { format: { minorLabels: format } };
  const graph2dProto = Object.getPrototypeOf(graph) as object | null;
  const coreProto = graph2dProto
    ? (Object.getPrototypeOf(graph2dProto) as { setOptions?: (o: unknown) => void } | null)
    : null;

  if (typeof coreProto?.setOptions === 'function') {
    coreProto.setOptions.call(graph, options);
    return;
  }

  // Fall back to the public API if vis ever changes its prototype shape.
  // Labels still render correctly; the console just gains a warning.
  (graph as unknown as { setOptions(o: unknown): void }).setOptions(options);
}
