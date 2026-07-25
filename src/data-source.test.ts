import { describe, it, expect } from 'vitest';
import { parseDataFile, resolveData, collectDataPaths } from './data-source';
import type { DataReader, RawBlock } from './types';

function reader(files: Record<string, string>): DataReader {
  return { read: async (path) => files[path] ?? null };
}

function block(partial: Partial<RawBlock>): RawBlock {
  return { items: [], options: {}, ...partial };
}

describe('parseDataFile', () => {
  it('parses CSV with x and y columns', () => {
    const rows = parseDataFile('a.csv', 'x,y\n1,10\n2,20');
    expect(rows).toEqual([
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ]);
  });

  it('parses CSV with an optional group column', () => {
    const rows = parseDataFile('a.csv', 'x,y,group\n1,10,a\n2,20,b');
    expect(rows[0]).toEqual({ x: 1, y: 10, group: 'a' });
    expect(rows[1]!.group).toBe('b');
  });

  it('keeps non-numeric CSV x values as strings for category charts', () => {
    const rows = parseDataFile('a.csv', 'x,y\nMon,10');
    expect(rows[0]!.x).toBe('Mon');
  });

  it('tolerates surrounding whitespace and blank lines in CSV', () => {
    const rows = parseDataFile('a.csv', ' x , y \n\n 1 , 10 \n\n');
    expect(rows).toEqual([{ x: 1, y: 10 }]);
  });

  it('ignores unknown CSV columns', () => {
    const rows = parseDataFile('a.csv', 'x,y,note\n1,10,hello');
    expect(rows[0]).toEqual({ x: 1, y: 10 });
  });

  it('throws for CSV missing an x column', () => {
    expect(() => parseDataFile('a.csv', 'time,y\n1,10')).toThrow(
      'Data file "a.csv" needs "x" and "y" header columns.'
    );
  });

  it('throws for CSV missing a y column', () => {
    expect(() => parseDataFile('a.csv', 'x,value\n1,10')).toThrow(
      'Data file "a.csv" needs "x" and "y" header columns.'
    );
  });

  it('throws for an empty CSV file', () => {
    expect(() => parseDataFile('a.csv', '   ')).toThrow('Data file "a.csv" is empty.');
  });

  it('parses a JSON array of rows', () => {
    const rows = parseDataFile('a.json', '[{"x":1,"y":10}]');
    expect(rows).toEqual([{ x: 1, y: 10 }]);
  });

  it('parses a YAML array of rows', () => {
    const rows = parseDataFile('a.yaml', '- x: 1\n  y: 10');
    expect(rows).toEqual([{ x: 1, y: 10 }]);
  });

  it('throws when a JSON data file is not an array', () => {
    expect(() => parseDataFile('a.json', '{"x":1}')).toThrow(
      'Data file "a.json" must contain an array of rows.'
    );
  });

  it('throws for an unsupported extension', () => {
    expect(() => parseDataFile('a.txt', 'x,y\n1,2')).toThrow(
      'Data file "a.txt" must be .csv, .json, .yaml, or .yml.'
    );
  });

  it('keeps a comma inside a quoted CSV field as part of the value', () => {
    const rows = parseDataFile('a.csv', 'x,y\n"Jan, 2026",10');
    expect(rows).toEqual([{ x: 'Jan, 2026', y: 10 }]);
  });

  it('unescapes a doubled quote inside a quoted CSV field', () => {
    const rows = parseDataFile('a.csv', 'x,y\n"Say ""hi""",10');
    expect(rows).toEqual([{ x: 'Say "hi"', y: 10 }]);
  });

  it('throws a plain-language error for an unterminated quote in a CSV field', () => {
    expect(() => parseDataFile('a.csv', 'x,y\n"Jan,10')).toThrow(
      'Data file "a.csv" has an unterminated quote.'
    );
  });
});

describe('collectDataPaths', () => {
  it('collects a block-level path', () => {
    expect(collectDataPaths(block({ data: 'a.csv' }))).toEqual(['a.csv']);
  });

  it('collects group-level paths', () => {
    const paths = collectDataPaths(
      block({ data: 'a.csv', groups: [{ id: 'g', data: 'b.csv' }] })
    );
    expect(paths).toEqual(['a.csv', 'b.csv']);
  });

  it('strips wikilink brackets', () => {
    expect(collectDataPaths(block({ data: '[[a.csv]]' }))).toEqual(['a.csv']);
  });

  it('strips a pipe alias from a wikilink reference', () => {
    expect(collectDataPaths(block({ data: '[[a.csv|My Data]]' }))).toEqual(['a.csv']);
  });

  it('returns an empty list when nothing references a file', () => {
    expect(collectDataPaths(block({ items: [{ x: 1, y: 2 }] }))).toEqual([]);
  });
});

describe('resolveData', () => {
  it('returns the block untouched when nothing references a file', async () => {
    const input = block({ items: [{ x: 1, y: 2 }] });
    expect(await resolveData(input, reader({}))).toEqual(input);
  });

  it('appends rows from a block-level data file', async () => {
    const result = await resolveData(
      block({ data: 'a.csv' }),
      reader({ 'a.csv': 'x,y\n1,10' })
    );
    expect(result.items).toEqual([{ x: 1, y: 10 }]);
  });

  it('keeps inline items ahead of loaded rows', async () => {
    const result = await resolveData(
      block({ items: [{ x: 0, y: 0 }], data: 'a.csv' }),
      reader({ 'a.csv': 'x,y\n1,10' })
    );
    expect(result.items).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 10 },
    ]);
  });

  it('tags rows from a group-level data file with that group id', async () => {
    const result = await resolveData(
      block({ groups: [{ id: 'a', data: 'a.csv' }] }),
      reader({ 'a.csv': 'x,y\n1,10' })
    );
    expect(result.items).toEqual([{ x: 1, y: 10, group: 'a' }]);
  });

  it('does not override an explicit group in a group-level data file', async () => {
    const result = await resolveData(
      block({ groups: [{ id: 'a', data: 'a.csv' }] }),
      reader({ 'a.csv': 'x,y,group\n1,10,b' })
    );
    expect(result.items[0]!.group).toBe('b');
  });

  it('resolves a wikilink reference', async () => {
    const result = await resolveData(
      block({ data: '[[a.csv]]' }),
      reader({ 'a.csv': 'x,y\n1,10' })
    );
    expect(result.items).toHaveLength(1);
  });

  it('resolves a wikilink reference with a pipe alias', async () => {
    const result = await resolveData(
      block({ data: '[[a.csv|My Data]]' }),
      reader({ 'a.csv': 'x,y\n1,10' })
    );
    expect(result.items).toEqual([{ x: 1, y: 10 }]);
  });

  it('throws a clear error for a missing file', async () => {
    await expect(resolveData(block({ data: 'gone.csv' }), reader({}))).rejects.toThrow(
      'Data file "gone.csv" was not found in the vault.'
    );
  });

  it('propagates a parse error from the data file', async () => {
    await expect(
      resolveData(block({ data: 'a.csv' }), reader({ 'a.csv': 'time,y\n1,2' }))
    ).rejects.toThrow('needs "x" and "y" header columns');
  });
});
