import type { FillSpec, RawGroup, VisGroup } from './types';

/**
 * Fields the plugin consumes itself. Everything else on a group is a raw vis
 * option and is forwarded untouched, so options added by future vis versions
 * keep working without a plugin change.
 */
const AUTHORING_FIELDS = new Set([
  'id',
  'content',
  'type',
  'color',
  'fill',
  'width',
  'dashes',
  'points',
  'interpolation',
  'x',
  'y',
  'data',
  'style',
  'className',
  'options',
  'visible',
]);

const VALID_TYPES = new Set(['line', 'bar', 'points']);

/** Compiles one authored group into the shape vis Graph2d consumes. */
export function compileGroup(raw: RawGroup): VisGroup {
  const options: Record<string, unknown> = {};

  // Forward every unrecognised field as a raw vis group option.
  for (const [key, value] of Object.entries(raw)) {
    if (!AUTHORING_FIELDS.has(key)) options[key] = value;
  }

  if (raw.type !== undefined) {
    if (!VALID_TYPES.has(raw.type)) {
      throw new Error(
        `Group "${String(raw.id)}" has an invalid "type" value: "${String(raw.type)}". ` +
          'Valid values are "line", "bar", and "points".'
      );
    }
    options.style = raw.type;
  }
  if (raw.fill !== undefined) options.shaded = compileFill(raw.fill, raw.id);
  if (raw.interpolation !== undefined) {
    options.interpolation =
      raw.interpolation === false
        ? { enabled: false }
        : { enabled: true, parametrization: raw.interpolation };
  }
  if (raw.points !== undefined) {
    options.drawPoints =
      typeof raw.points === 'object' ? { enabled: true, ...raw.points } : raw.points;
  }

  // Raw vis options always win over anything compiled above.
  Object.assign(options, raw.options ?? {});

  const style = raw.style ?? compileStyle(raw);

  const group: VisGroup = {
    id: raw.id,
    content: raw.content ?? String(raw.id),
  };
  if (style !== undefined) group.style = style;
  if (raw.className !== undefined) group.className = raw.className;
  if (raw.visible !== undefined) group.visible = raw.visible;
  if (Object.keys(options).length > 0) group.options = options;
  return group;
}

function compileFill(fill: FillSpec, id: string | number): Record<string, unknown> {
  if (fill === true) return { orientation: 'zero' };
  if (fill === false) return { enabled: false };
  if (fill.to !== undefined) return { groupId: fill.to };
  if (fill.below !== undefined) return { orientation: 'bottom' };
  if (fill.above !== undefined) return { orientation: 'top' };
  throw new Error(
    `Group "${String(id)}" has a "fill" object with no recognized key. ` +
      'Use "to", "below", or "above".'
  );
}

/** Builds the inline SVG CSS string from the friendly colour fields. */
function compileStyle(raw: RawGroup): string | undefined {
  const declarations: string[] = [];
  if (raw.color !== undefined) {
    declarations.push(`stroke:${raw.color}`, `fill:${raw.color}`);
  }
  if (raw.width !== undefined) {
    if (typeof raw.width !== 'number' || !Number.isFinite(raw.width)) {
      throw new Error(`Group "${String(raw.id)}" has a "width" value that is not a number.`);
    }
    declarations.push(`stroke-width:${raw.width}`);
  }
  if (raw.dashes !== undefined) {
    if (!Array.isArray(raw.dashes)) {
      throw new Error(
        `Group "${String(raw.id)}" has a "dashes" value that is not a list of numbers.`
      );
    }
    if (raw.dashes.some((d) => typeof d !== 'number' || !Number.isFinite(d))) {
      throw new Error(
        `Group "${String(raw.id)}" has a "dashes" value with a non-numeric entry.`
      );
    }
    declarations.push(`stroke-dasharray:${raw.dashes.join(' ')}`);
  }
  return declarations.length > 0 ? `${declarations.join(';')};` : undefined;
}
