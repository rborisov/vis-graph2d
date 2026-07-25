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
    if (!PLUGIN_OPTIONS.has(key)) visOptions[key] = value;
  }

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
    throw new Error(
      `Item ${index} has a non-numeric "y" value: "${String(point.y)}".`
    );
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

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
