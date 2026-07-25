import { describe, it, expect } from 'vitest';
import { expandColumns } from './columns';
import type { RawBlock } from './types';

function block(partial: Partial<RawBlock>): RawBlock {
  return { items: [], options: {}, ...partial };
}

describe('expandColumns', () => {
  it('returns inline items unchanged when there are no columns', () => {
    const result = expandColumns(block({ items: [{ x: 1, y: 2 }] }));
    expect(result).toEqual([{ x: 1, y: 2 }]);
  });

  it('pairs a shared x column with a group y column', () => {
    const result = expandColumns(
      block({ x: [1, 2, 3], groups: [{ id: 'a', y: [10, 20, 30] }] })
    );
    expect(result).toEqual([
      { x: 1, y: 10, group: 'a' },
      { x: 2, y: 20, group: 'a' },
      { x: 3, y: 30, group: 'a' },
    ]);
  });

  it('expands multiple groups against one shared x column', () => {
    const result = expandColumns(
      block({
        x: [1, 2],
        groups: [
          { id: 'a', y: [10, 20] },
          { id: 'b', y: [30, 40] },
        ],
      })
    );
    expect(result).toHaveLength(4);
    expect(result[2]).toEqual({ x: 1, y: 30, group: 'b' });
  });

  it('prefers a group-level x column over the shared one', () => {
    const result = expandColumns(
      block({ x: [1, 2], groups: [{ id: 'a', x: [7, 8], y: [10, 20] }] })
    );
    expect(result[0]).toEqual({ x: 7, y: 10, group: 'a' });
  });

  it('appends expanded columns after inline items', () => {
    const result = expandColumns(
      block({ items: [{ x: 0, y: 0 }], x: [1], groups: [{ id: 'a', y: [10] }] })
    );
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 10, group: 'a' },
    ]);
  });

  it('ignores groups that carry no y column', () => {
    const result = expandColumns(
      block({ x: [1, 2], groups: [{ id: 'a', content: 'A' }] })
    );
    expect(result).toEqual([]);
  });

  it('throws when a group y column is longer than its x column', () => {
    expect(() =>
      expandColumns(block({ x: [1, 2], groups: [{ id: 'a', y: [1, 2, 3] }] }))
    ).toThrow('Group "a" has 3 y values but 2 x values.');
  });

  it('throws when a group y column is shorter than its x column', () => {
    expect(() =>
      expandColumns(block({ x: [1, 2, 3], groups: [{ id: 'a', y: [1] }] }))
    ).toThrow('Group "a" has 1 y values but 3 x values.');
  });

  it('throws when a group has a y column but no x column anywhere', () => {
    expect(() =>
      expandColumns(block({ groups: [{ id: 'a', y: [1, 2] }] }))
    ).toThrow('Group "a" has a "y" column but no "x" column.');
  });
});
