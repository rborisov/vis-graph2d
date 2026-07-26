import { expandColumns } from './columns';
import { compileGroup } from './series';
import { createXScale } from './x-scale';
import type { XScale } from './x-scale';
import type {
  BlockOptions,
  NormalizedChart,
  RawBlock,
  RawPoint,
  VisGroup,
  VisPoint,
} from './types';

/** Block options the plugin consumes itself rather than forwarding to vis. */
const PLUGIN_OPTIONS = new Set(['xAxis', 'height']);

/**
 * Author-unit POSITIONS on the x-axis. On a numeric/category axis these must
 * be routed through scale.toInternal() just like item x/end values -- left
 * raw, vis reads them as epoch milliseconds on an axis that is actually
 * warped (one chosen step == one internal day), collapsing the visible
 * window to a sub-second sliver. Time axis is unaffected: overridesLabels is
 * false there, so these fall through to the raw pass-through below unchanged.
 */
const POSITION_OPTION_KEYS = new Set(['start', 'end', 'min', 'max']);

/**
 * Author-unit DURATIONS (a span length, not a position) in that same warped
 * space. These need scale.toInternalDuration() instead of toInternal(): a
 * duration has no anchor to subtract, only a step to divide out.
 */
const DURATION_OPTION_KEYS = new Set(['zoomMin', 'zoomMax']);

export function normalize(
  block: RawBlock,
  defaults: Partial<BlockOptions> = {}
): NormalizedChart {
  const options: BlockOptions = { ...defaults, ...block.options };
  const mode = options.xAxis ?? 'time';

  const points = expandColumns(block);
  const scale = createXScale(mode, points.map((p) => p.x));

  const groups: VisGroup[] = (block.groups ?? []).map(compileGroup);
  const declaredIds = new Set(groups.map((g) => String(g.id)));

  // vis rejects duplicate ids from inside its own constructor, after it has
  // already registered a window resize listener and an interval — so the
  // throw escapes with no instance to destroy and the listener leaks. Catching
  // it here also turns a cryptic internal message into an actionable one.
  if (declaredIds.size !== groups.length) {
    const seen = new Set<string>();
    const duplicate = groups
      .map((g) => String(g.id))
      .find((id) => (seen.has(id) ? true : (seen.add(id), false)));
    throw new Error(`Group "${String(duplicate)}" is declared more than once.`);
  }

  const items = points.map((point, index) =>
    toVisPoint(point, index, scale, declaredIds, groups.length > 0)
  );

  const visOptions: Record<string, unknown> = {
    ...scale.axisHints(),
  };
  for (const [key, value] of Object.entries(options)) {
    if (PLUGIN_OPTIONS.has(key)) continue;
    if (scale.overridesLabels && POSITION_OPTION_KEYS.has(key)) {
      visOptions[key] = toScaledPosition(value, scale, key);
    } else if (scale.overridesLabels && DURATION_OPTION_KEYS.has(key)) {
      visOptions[key] = toScaledDuration(value, scale, key);
    } else {
      visOptions[key] = value;
    }
  }

  completeWindow(visOptions, items);

  const chart: NormalizedChart = { items, groups, visOptions, scale };
  if (options.height !== undefined) chart.height = options.height;
  return chart;
}

function toVisPoint(
  point: RawPoint,
  index: number,
  scale: XScale,
  declaredIds: Set<string>,
  hasDeclaredGroups: boolean
): VisPoint {
  const y = toFiniteNumber(point.y);
  if (y === undefined) {
    // A present-but-wrong-type value gets the value quoted back so the
    // author can see what went wrong; a value that is simply absent gets
    // "is missing" instead -- quoting "undefined" back at someone who never
    // wrote a "y" at all reads as a bug, not a helpful diagnostic.
    if (point.y === undefined) {
      throw new Error(`Item ${index} is missing "y".`);
    }
    throw new Error(`Item ${index}'s "y" must be a number (got "${String(point.y as unknown)}").`);
  }

  if (
    hasDeclaredGroups &&
    point.group !== undefined &&
    !declaredIds.has(String(point.group))
  ) {
    throw new Error(
      `Item ${index} references group "${String(point.group)}", which is not declared.`
    );
  }

  const visPoint: VisPoint = { x: toDate(point.x, index, scale, 'x'), y };
  if (point.group !== undefined) visPoint.group = point.group;
  if (point.end !== undefined) {
    visPoint.end = toDate(point.end, index, scale, 'end');
  }
  if (point.label !== undefined) visPoint.label = point.label;
  return visPoint;
}

function toDate(
  value: unknown,
  index: number,
  scale: XScale,
  field: string
): Date {
  try {
    return new Date(scale.toInternal(value));
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Item ${index} has an invalid "${field}" value: ${detail}`);
  }
}

/**
 * Fills in whichever of `start`/`end` the author left out.
 *
 * Graph2d's initial-fit path does this itself — but by calling
 * `me.getItemRange()`, which exists only on Timeline, not on Graph2d (Graph2d
 * spells it `getDataRange`). So supplying exactly one bound crashes the widget
 * with `me.getItemRange is not a function`. Supplying both keeps vis out of
 * that branch entirely. The value used matches what vis intended there: the
 * data's own min/max.
 *
 * With no items there is no range to derive, so the option is left alone
 * rather than invented.
 */
function completeWindow(visOptions: Record<string, unknown>, items: VisPoint[]): void {
  const hasStart = visOptions.start !== undefined;
  const hasEnd = visOptions.end !== undefined;
  if (hasStart === hasEnd || items.length === 0) return;

  let min = Infinity;
  let max = -Infinity;
  for (const item of items) {
    const start = item.x.getTime();
    if (start < min) min = start;
    if (start > max) max = start;
    // A spanning bar reaches past its own x, so it widens the range.
    const end = item.end?.getTime();
    if (end !== undefined) {
      if (end < min) min = end;
      if (end > max) max = end;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return;

  if (hasStart) visOptions.end = new Date(max);
  else visOptions.start = new Date(min);
}

/** Maps a `start`/`end`/`min`/`max` block option through the axis scale. */
function toScaledPosition(value: unknown, scale: XScale, key: string): Date {
  try {
    return new Date(scale.toInternal(value));
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Option "${key}" has an invalid value: ${detail}`);
  }
}

/** Maps a `zoomMin`/`zoomMax` block option (a duration) through the axis scale. */
function toScaledDuration(value: unknown, scale: XScale, key: string): number {
  try {
    return scale.toInternalDuration(value);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Option "${key}" has an invalid value: ${detail}`);
  }
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
