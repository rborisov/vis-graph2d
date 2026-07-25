import * as yaml from 'js-yaml';
import type { DataReader, RawBlock, RawPoint } from './types';

/** Lists every vault file this block reads, for cache invalidation. */
export function collectDataPaths(block: RawBlock): string[] {
  const paths: string[] = [];
  if (block.data !== undefined) paths.push(stripWikilink(block.data));
  for (const group of block.groups ?? []) {
    if (group.data !== undefined) paths.push(stripWikilink(group.data));
  }
  return paths;
}

/**
 * Loads every referenced data file and folds its rows into the block's
 * items. Rows from a group-level file are tagged with that group's id
 * unless the file names a group itself.
 */
export async function resolveData(
  block: RawBlock,
  reader: DataReader
): Promise<RawBlock> {
  if (collectDataPaths(block).length === 0) return block;

  const items: RawPoint[] = [...block.items];

  if (block.data !== undefined) {
    items.push(...(await loadRows(block.data, reader)));
  }

  for (const group of block.groups ?? []) {
    if (group.data === undefined) continue;
    const rows = await loadRows(group.data, reader);
    for (const row of rows) {
      items.push(row.group === undefined ? { ...row, group: group.id } : row);
    }
  }

  return { ...block, items };
}

async function loadRows(ref: string, reader: DataReader): Promise<RawPoint[]> {
  const path = stripWikilink(ref);
  const content = await reader.read(path);
  if (content === null) {
    throw new Error(`Data file "${path}" was not found in the vault.`);
  }
  return parseDataFile(path, content);
}

export function parseDataFile(path: string, content: string): RawPoint[] {
  if (content.trim() === '') {
    throw new Error(`Data file "${path}" is empty.`);
  }

  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  switch (extension) {
    case 'csv':
      return parseCsv(path, content);
    case 'json':
      return asRowArray(path, JSON.parse(content));
    case 'yaml':
    case 'yml':
      return asRowArray(path, yaml.load(content));
    default:
      throw new Error(`Data file "${path}" must be .csv, .json, .yaml, or .yml.`);
  }
}

function asRowArray(path: string, parsed: unknown): RawPoint[] {
  if (!Array.isArray(parsed)) {
    throw new Error(`Data file "${path}" must contain an array of rows.`);
  }
  return parsed.filter(Boolean) as RawPoint[];
}

function parseCsv(path: string, content: string): RawPoint[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const header = splitCsvLine(lines[0]!, path).map((cell) => cell.toLowerCase());
  const xIndex = header.indexOf('x');
  const yIndex = header.indexOf('y');
  const groupIndex = header.indexOf('group');
  if (xIndex === -1 || yIndex === -1) {
    throw new Error(`Data file "${path}" needs "x" and "y" header columns.`);
  }

  const rows: RawPoint[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, path);
    const row: RawPoint = {
      x: coerce(cells[xIndex]),
      y: coerce(cells[yIndex]),
    };
    if (groupIndex !== -1 && cells[groupIndex] !== undefined && cells[groupIndex] !== '') {
      row.group = cells[groupIndex];
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Splits one CSV line into fields. Not a full RFC 4180 parser: a
 * double-quoted field may contain commas, and a doubled `""` inside one is a
 * literal quote, but newlines inside quoted fields are not supported (lines
 * are already split on newlines before this runs). An unterminated quote
 * throws rather than silently mis-parsing the rest of the line.
 */
function splitCsvLine(line: string, path: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field.trim() === '') {
      inQuotes = true;
      field = '';
      i++;
      continue;
    }
    if (ch === ',') {
      fields.push(field.trim());
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (inQuotes) {
    throw new Error(`Data file "${path}" has an unterminated quote.`);
  }
  fields.push(field.trim());
  return fields;
}

/** Numbers become numbers; anything else stays a string for category axes. */
function coerce(cell: string | undefined): unknown {
  if (cell === undefined || cell === '') return undefined;
  const n = Number(cell);
  return Number.isFinite(n) ? n : cell;
}

function stripWikilink(ref: string): string {
  const trimmed = ref.trim();
  const unwrapped = trimmed.startsWith('[[') && trimmed.endsWith(']]')
    ? trimmed.slice(2, -2).trim()
    : trimmed;
  const pipeIndex = unwrapped.indexOf('|');
  return pipeIndex === -1 ? unwrapped : unwrapped.slice(0, pipeIndex).trim();
}
