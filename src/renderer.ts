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

  // The container is deliberately NOT given a CSS height. `chart.height`
  // drives graphHeight below, which sizes the PLOT AREA only; vis then sizes
  // its own root to top + plot + bottom + borders, where "bottom" is the
  // x-axis strip. Pinning the container to the same value double-counted it:
  // the plot alone filled the container, so the axis was laid out past its
  // bottom edge and disappeared on every chart. Letting the container size to
  // its content means the axis always has room.

  // pubobs renders offscreen at a fixed narrow width; charts need more room
  // so axis labels are not cramped. The exported <img> scales back down
  // (see .g2d-export-width in styles.css).
  if (exportMode) container.addClass('g2d-export-width');

  const visOptions: Record<string, unknown> = {
    // `height` sizes the PLOT AREA, not the whole widget: vis draws the
    // x-axis in a strip below it, so the rendered widget is this tall plus
    // roughly 30px of axis. Identical on both paths, so an exported PNG
    // matches the interactive chart.
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
