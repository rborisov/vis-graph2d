import * as yaml from 'js-yaml';
import type { RawBlock, RawGroup, RawPoint, BlockOptions } from './types';

export function parseBlock(source: string): RawBlock {
  if (source.trim() === '') {
    throw new Error('Block is empty. Add chart data — see the plugin README.');
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(source);
  } catch {
    try {
      parsed = JSON.parse(source);
    } catch {
      throw new Error('Could not parse block as YAML or JSON.');
    }
  }

  if (Array.isArray(parsed)) {
    return { items: toPoints(parsed), options: {} };
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;

    // Strict parsing: a key that is present but holds the wrong type is a
    // user mistake and must render an inline error, never be silently
    // dropped. Keys that are absent entirely are fine and skip these checks.
    if (obj.items !== undefined && !Array.isArray(obj.items)) {
      throw new Error('Block "items" must be a list of data points.');
    }
    if (obj.groups !== undefined && !Array.isArray(obj.groups)) {
      throw new Error('Block "groups" must be a list of series.');
    }
    if (obj.x !== undefined && !Array.isArray(obj.x)) {
      throw new Error('Block "x" must be a list of values.');
    }
    if (obj.data !== undefined && typeof obj.data !== 'string') {
      throw new Error('Block "data" must be a file path string.');
    }
    if (
      obj.options !== undefined &&
      !(typeof obj.options === 'object' && obj.options !== null)
    ) {
      throw new Error('Block "options" must be a settings object.');
    }

    const groups = Array.isArray(obj.groups)
      ? (obj.groups as unknown[]).filter(isObject).map((g) => g as RawGroup)
      : undefined;
    // An explicit `items` array is a deliberate declaration of intent, even
    // when it is (or normalizes to) empty, so it alone satisfies validity.
    const itemsProvided = Array.isArray(obj.items);
    const items = itemsProvided ? toPoints(obj.items as unknown[]) : [];
    const x = Array.isArray(obj.x) ? (obj.x as unknown[]) : undefined;
    const data = typeof obj.data === 'string' ? obj.data : undefined;

    // A block is valid only if it has usable content in one of the three
    // supported data shapes: items, a data file reference, columnar x/y, or
    // a group that itself carries data or y values.
    const hasGroupData =
      groups?.some((g) => typeof g.data === 'string' || Array.isArray(g.y)) ??
      false;

    if (!itemsProvided && data === undefined && x === undefined && !hasGroupData) {
      throw new Error(
        'Block must have "items", "data", or columnar "x"/"y" arrays.'
      );
    }

    return {
      items,
      groups,
      options:
        typeof obj.options === 'object' && obj.options !== null
          ? (obj.options as BlockOptions)
          : {},
      x,
      data,
    };
  }

  throw new Error(
    'Block must be a YAML/JSON array, or an object with "items", "data", or "x"/"y" arrays.'
  );
}

function toPoints(value: unknown[]): RawPoint[] {
  return value.filter(isObject).map((v) => v as RawPoint);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
