import { describe, it, expect } from 'vitest';
import { parseBlock } from './parser';

describe('parseBlock', () => {
  it('parses a bare YAML array as items', () => {
    const source = `
- x: 1
  y: 10
- x: 2
  y: 20
`.trim();
    const result = parseBlock(source);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.y).toBe(10);
    expect(result.options).toEqual({});
    expect(result.groups).toBeUndefined();
  });

  it('parses a bare JSON array as items', () => {
    const source = JSON.stringify([{ x: 1, y: 10 }]);
    const result = parseBlock(source);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.x).toBe(1);
  });

  it('parses object form with options, groups, and items', () => {
    const source = `
options:
  xAxis: numeric
  height: 300px
groups:
  - id: a
    content: Series A
items:
  - { x: 1, y: 10, group: a }
`.trim();
    const result = parseBlock(source);
    expect(result.options.xAxis).toBe('numeric');
    expect(result.options.height).toBe('300px');
    expect(result.groups).toHaveLength(1);
    expect(result.groups![0]!.id).toBe('a');
    expect(result.items).toHaveLength(1);
  });

  it('parses JSON object form', () => {
    const source = JSON.stringify({
      options: { xAxis: 'category' },
      items: [{ x: 'Mon', y: 3 }],
    });
    const result = parseBlock(source);
    expect(result.options.xAxis).toBe('category');
    expect(result.items[0]?.x).toBe('Mon');
  });

  it('accepts a block with no items when a block-level data ref is present', () => {
    const result = parseBlock('data: charts/series.csv');
    expect(result.data).toBe('charts/series.csv');
    expect(result.items).toEqual([]);
  });

  it('accepts a block with no items when a shared x column is present', () => {
    const source = `
x: [1, 2, 3]
groups:
  - id: a
    y: [4, 5, 6]
`.trim();
    const result = parseBlock(source);
    expect(result.x).toEqual([1, 2, 3]);
    expect(result.items).toEqual([]);
  });

  it('accepts a block whose only data lives on a group', () => {
    const source = `
groups:
  - id: a
    data: series.csv
`.trim();
    const result = parseBlock(source);
    expect(result.items).toEqual([]);
    expect(result.groups![0]!.data).toBe('series.csv');
  });

  it('throws for content that is neither valid YAML nor JSON', () => {
    expect(() => parseBlock('{ unclosed bracket [')).toThrow(
      'Could not parse block as YAML or JSON'
    );
  });

  it('throws for an object with no data source at all', () => {
    expect(() => parseBlock('title: My Chart')).toThrow(
      'must have "items", "data", or columnar "x"/"y" arrays'
    );
  });

  it('throws for a bare scalar', () => {
    expect(() => parseBlock('just a string')).toThrow();
  });

  it('throws for an empty block', () => {
    expect(() => parseBlock('   ')).toThrow('Block is empty');
  });

  it('ignores a non-array groups value', () => {
    const source = 'groups: "invalid"\nitems: []';
    const result = parseBlock(source);
    expect(result.groups).toBeUndefined();
  });

  it('filters out null entries in the groups array', () => {
    const source = 'groups:\n  - id: a\n  - null\nitems: []';
    const result = parseBlock(source);
    expect(result.groups).toHaveLength(1);
    expect(result.groups![0]!.id).toBe('a');
  });

  it('drops null entries from the items array', () => {
    const source = 'items:\n  - { x: 1, y: 2 }\n  - null';
    const result = parseBlock(source);
    expect(result.items).toHaveLength(1);
  });
});
