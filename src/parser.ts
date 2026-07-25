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
    const groups = Array.isArray(obj.groups)
      ? (obj.groups as RawGroup[]).filter(Boolean)
      : undefined;
    const items = Array.isArray(obj.items) ? toPoints(obj.items) : [];
    const x = Array.isArray(obj.x) ? (obj.x as unknown[]) : undefined;
    const data = typeof obj.data === 'string' ? obj.data : undefined;

    // A block is valid if it explicitly has any of the three supported data
    // shapes: items (even if empty), data file reference, columnar x/y, or groups.
    const hasItems = 'items' in obj;
    const hasData = 'data' in obj;
    const hasX = 'x' in obj;
    const hasGroups = 'groups' in obj;

    if (!hasItems && !hasData && !hasX && !hasGroups) {
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
  return value.filter(Boolean) as RawPoint[];
}
