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
  exportMode = false
): Graph2dHandle {
  const container = el.createEl('div');
  container.className = 'graph2d-plugin';

  // exportMode means this render is destined for rasterize(): no fixed CSS
  // container height (a rasterized PNG has no scrollbar, so there is
  // nothing for a fixed height to protect against overflowing), plus the
  // wider .g2d-export-width layout below. Nothing here "auto"-grows the
  // container -- with no CSS height set, the container simply sizes to
  // whatever height its content draws at, and that drawn height is
  // governed entirely by graphHeight below (deliberately NOT reset for
  // export mode).
  const fixedHeight = exportMode ? undefined : chart.height;
  if (fixedHeight !== undefined) container.style.height = fixedHeight;

  // pubobs renders offscreen at a fixed narrow width; charts need more room
  // so axis labels are not cramped. The exported <img> scales back down
  // (see .g2d-export-width in styles.css).
  if (exportMode) container.addClass('g2d-export-width');

  const visOptions: Record<string, unknown> = {
    // Always honors the chart's own configured (or default) drawing
    // height, on both paths. This used to read `fixedHeight ??
    // DEFAULT_GRAPH_HEIGHT`, which reset the chart's actual drawn height
    // back down to the 400px default whenever exportMode was true -- even
    // if the author had configured a taller chart.height, since
    // fixedHeight is always undefined in export mode (see above). The
    // export silently ignored the author's configured height and always
    // drew at the 400px default, regardless of what the chart was actually
    // configured to draw at. Reading chart.height directly here means the
    // export always draws at the same height the interactive widget uses
    // for this chart -- the 400px default only applies when that's what
    // the author actually configured (or left unset).
    graphHeight: chart.height ?? DEFAULT_GRAPH_HEIGHT,
    // The export path captures once and throws the live chart away, so
    // there is nothing to resize into.
    autoResize: !exportMode,
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

    // vis's own destroy() is not idempotent — a second call throws
    // "Cannot read properties of null (reading 'root')". Callers legitimately
    // cannot always tell whether it already ran: rasterize() destroys the
    // graph on a successful export but leaves it mounted on failure, so the
    // owning render child has no way to know which happened. Guarding here
    // means teardown can always call destroy() without tracking that.
    // Patched on the instance rather than wrapped in a new object: tests and
    // the export path reach through this handle to vis internals such as
    // `timeAxis.step`, which a plain {destroy, redraw} wrapper would hide.
    let destroyed = false;
    const originalDestroy = graph.destroy.bind(graph);
    (graph as { destroy: () => void }).destroy = () => {
      if (destroyed) return;
      destroyed = true;
      originalDestroy();
    };

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
