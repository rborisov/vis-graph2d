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

  it('throws when groups is not a list, even though items satisfies content', () => {
    const source = 'groups: "invalid"\nitems: []';
    expect(() => parseBlock(source)).toThrow(
      'Block "groups" must be a list of series.'
    );
  });

  it('filters out null entries in the groups array', () => {
    const source = 'groups:\n  - id: a\n  - null\nitems: []';
    const result = parseBlock(source);
    expect(result.groups).toHaveLength(1);
    expect(result.groups![0]!.id).toBe('a');
  });

  // CONVERTED for FIX 4: a null entry in "items" used to be silently
  // dropped. That's the same silent-drop class STRICT validation exists to
  // prevent elsewhere (e.g. `items: 5` at the block level already throws),
  // so a non-object entry -- including null -- now throws instead, naming
  // its index.
  it('throws, naming the index, for a null entry in the items array', () => {
    const source = 'items:\n  - { x: 1, y: 2 }\n  - null';
    expect(() => parseBlock(source)).toThrow('Item 1 must be an object with "x" and "y".');
  });

  it('throws when groups holds a non-array value and there is no other data source', () => {
    expect(() => parseBlock('groups: "invalid"')).toThrow(
      'Block "groups" must be a list of series.'
    );
  });

  it('throws when items holds a non-array value and there is no other data source', () => {
    expect(() => parseBlock('items: "invalid"')).toThrow(
      'Block "items" must be a list of data points.'
    );
  });

  it('throws when x holds a non-array value and there is no other data source', () => {
    expect(() => parseBlock('x: "invalid"')).toThrow(
      'Block "x" must be a list of values.'
    );
  });

  it('throws when data holds a non-string value and there is no other data source', () => {
    expect(() => parseBlock('data: 123')).toThrow(
      'Block "data" must be a file path string.'
    );
  });

  it('throws when every group carries neither data nor y', () => {
    const source = 'groups:\n  - id: a\n    content: metadata only';
    expect(() => parseBlock(source)).toThrow(
      'must have "items", "data", or columnar "x"/"y" arrays'
    );
  });

  it('filters out non-object entries in the groups array', () => {
    const source =
      'groups:\n  - id: a\n    data: series.csv\n  - just a string\nitems: []';
    const result = parseBlock(source);
    expect(result.groups).toHaveLength(1);
    expect(result.groups![0]!.id).toBe('a');
  });

  // CONVERTED for FIX 4: see the null-entry conversion above -- a bare
  // scalar entry (e.g. a string, or `[1, 2, 3]` at the top level) used to
  // be silently dropped, yielding an empty chart with no error. It now
  // throws, naming its index.
  it('throws, naming the index, for a non-object entry in the items array', () => {
    const source = 'items:\n  - { x: 1, y: 2 }\n  - just a string';
    expect(() => parseBlock(source)).toThrow('Item 1 must be an object with "x" and "y".');
  });

  it('throws, naming the index, for a bare top-level array of scalars (FIX 4)', () => {
    expect(() => parseBlock('[1, 2, 3]')).toThrow('Item 0 must be an object with "x" and "y".');
  });

  describe('strict type validation', () => {
    it('throws when "items" is present but not an array, even with another valid data source', () => {
      expect(() => parseBlock('items: "invalid"\ndata: file.csv')).toThrow(
        'Block "items" must be a list of data points.'
      );
    });

    it('throws when "groups" is present but not an array, even with another valid data source', () => {
      expect(() => parseBlock('groups: "invalid"\ndata: file.csv')).toThrow(
        'Block "groups" must be a list of series.'
      );
    });

    it('throws when "x" is present but not an array, even with another valid data source', () => {
      expect(() => parseBlock('x: "invalid"\ndata: file.csv')).toThrow(
        'Block "x" must be a list of values.'
      );
    });

    it('throws when "data" is present but not a string, even with another valid data source', () => {
      const source = 'data: 123\nitems:\n  - { x: 1, y: 2 }';
      expect(() => parseBlock(source)).toThrow(
        'Block "data" must be a file path string.'
      );
    });

    it('throws when "options" is present but not a non-null object, even with another valid data source', () => {
      expect(() => parseBlock('options: null\ndata: file.csv')).toThrow(
        'Block "options" must be a settings object.'
      );
    });

    it('does not throw when optional keys are simply absent', () => {
      expect(() => parseBlock('data: file.csv')).not.toThrow();
    });
  });

  describe('group-level "data" must be a string (Finding 1)', () => {
    // FIX 3 CONVERTS these two: a malformed group-level "data" used to fall
    // through to the generic "Block must have..." message (the exact
    // silent-drop class STRICT validation exists to prevent) because
    // nested RawGroup fields were never type-checked. It now throws a
    // message naming the group and the field directly, before that generic
    // check is ever reached.
    it('names the group and field for a numeric group "data"', () => {
      const source = 'groups:\n  - id: a\n    data: 123';
      expect(() => parseBlock(source)).toThrow('Group "a"\'s "data" must be a string.');
    });

    it('names the group and field for a null group "data"', () => {
      const source = 'groups:\n  - id: a\n    data: null';
      expect(() => parseBlock(source)).toThrow('Group "a"\'s "data" must be a string.');
    });
  });

  describe('group "id" is required and type-checked (FIX 3)', () => {
    it('throws, naming the position, when a group has no "id" at all', () => {
      const source = 'groups:\n  - { content: A, y: [1, 2] }\nx: [1, 2]';
      expect(() => parseBlock(source)).toThrow('Group 0 is missing an "id".');
    });

    it('throws, naming the position, for a non-string non-number "id"', () => {
      const source = 'groups:\n  - { id: [1, 2], y: [1, 2] }\nx: [1, 2]';
      expect(() => parseBlock(source)).toThrow(
        'Group 0 has an "id" that must be a string or number.'
      );
    });

    it('names the group id (not the position) once it is known to be valid', () => {
      const source = 'groups:\n  - { id: a, visible: "yes", y: [1, 2] }\nx: [1, 2]';
      expect(() => parseBlock(source)).toThrow('Group "a"\'s "visible" must be true or false.');
    });

    it('reports the correct array position among mixed valid/invalid groups', () => {
      const source =
        'groups:\n  - { id: a, y: [1, 2] }\n  - { id: b, content: 5, y: [1, 2] }\nx: [1, 2]';
      expect(() => parseBlock(source)).toThrow('Group "b"\'s "content" must be a string.');
    });

    it('accepts a numeric id', () => {
      const source = 'groups:\n  - { id: 1, y: [1, 2] }\nx: [1, 2]';
      expect(() => parseBlock(source)).not.toThrow();
    });

    it('rejects a non-object "options" on a group', () => {
      const source = 'groups:\n  - { id: a, options: "nope", y: [1, 2] }\nx: [1, 2]';
      expect(() => parseBlock(source)).toThrow('Group "a"\'s "options" must be a settings object.');
    });

    it('rejects an array "options" on a group', () => {
      const source = 'groups:\n  - { id: a, options: [1, 2], y: [1, 2] }\nx: [1, 2]';
      expect(() => parseBlock(source)).toThrow('Group "a"\'s "options" must be a settings object.');
    });

    it('rejects a non-string "content" on a group', () => {
      const source = 'groups:\n  - { id: a, content: 5, y: [1, 2] }\nx: [1, 2]';
      expect(() => parseBlock(source)).toThrow('Group "a"\'s "content" must be a string.');
    });
  });

  it('rejects an array "options" at the block level', () => {
    expect(() => parseBlock('options: [1, 2]\ndata: file.csv')).toThrow(
      'Block "options" must be a settings object.'
    );
  });

  describe('malformed fields are not silently dropped when "items: []" is present (Finding 2)', () => {
    it('throws for a non-string block "data" even though "items" is an explicit empty array', () => {
      const source = 'items: []\ndata: 123';
      expect(() => parseBlock(source)).toThrow(
        'Block "data" must be a file path string.'
      );
    });

    it('throws for a non-array "groups" even though "items" is an explicit empty array', () => {
      const source = 'items: []\ngroups: "invalid"';
      expect(() => parseBlock(source)).toThrow(
        'Block "groups" must be a list of series.'
      );
    });
  });
});
