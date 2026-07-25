import type { RawBlock, RawPoint } from './types';

/**
 * Expands the columnar authoring form into ordinary point rows.
 *
 * A block may supply a shared `x` array plus a `y` array on each group, or
 * override `x` per group. Inline `items` are preserved and come first, so the
 * two forms can be mixed in one block.
 */
export function expandColumns(block: RawBlock): RawPoint[] {
  const points: RawPoint[] = [...block.items];

  for (const group of block.groups ?? []) {
    if (group.y === undefined) continue;

    // Strict parsing: a "y" (or "x" override) that is present but the wrong
    // type is a user mistake and must render an inline error, never be
    // silently dropped or silently substituted with different data. Absent
    // is fine (a group may exist purely for styling); wrong-type is not.
    if (!Array.isArray(group.y)) {
      throw new Error(`Group "${String(group.id)}"'s "y" must be a list of values.`);
    }
    if (group.x !== undefined && !Array.isArray(group.x)) {
      throw new Error(`Group "${String(group.id)}"'s "x" must be a list of values.`);
    }

    const xs = Array.isArray(group.x) ? group.x : block.x;
    if (xs === undefined) {
      throw new Error(
        `Group "${String(group.id)}" has a "y" column but no "x" column. ` +
          'Add a block-level "x" array or an "x" array on the group.'
      );
    }
    if (xs.length !== group.y.length) {
      throw new Error(
        `Group "${String(group.id)}" has ${group.y.length} y values but ${xs.length} x values.`
      );
    }

    for (let i = 0; i < xs.length; i++) {
      points.push({ x: xs[i], y: group.y[i], group: group.id });
    }
  }

  return points;
}
