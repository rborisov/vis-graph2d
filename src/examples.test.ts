// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBlock } from './parser';
import { normalize } from './normalizer';
import { renderGraph2d } from './renderer';
import { collectDataPaths, resolveData } from './data-source';
import { stubLayout, stubCreateEl, stubClassMethods } from './test-dom';
import type { DataReader } from './types';

// stubCreateEl/stubClassMethods: renderer.ts calls Obsidian's `el.createEl`
// and `addClass` DOM extensions, which have no runtime implementation under
// happy-dom (the `obsidian` package here is types-only). See test-dom.ts and
// the same setup in renderer.test.ts.
beforeAll(() => {
  stubLayout();
  stubCreateEl();
  stubClassMethods();
});

/** Pulls every ```vis-graph2d fenced block out of a markdown file. */
function extractBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const pattern = /^```vis-graph2d\n([\s\S]*?)^```/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    blocks.push(match[1]!);
  }
  return blocks;
}

/**
 * Fixture content for the external data files docs/examples/data-files.md
 * references. There is no real Obsidian vault under vitest, so this stands
 * in for one: it lets every "data:" example exercise the real
 * resolveData()/parseDataFile() path against matching fixture content
 * instead of being skipped, so a broken data-file example still fails this
 * suite exactly like any other broken example would.
 */
const DATA_FIXTURES: Record<string, string> = {
  'charts/sales.csv': 'x,y\n1,120\n2,150\n3,90\n4,200',
  'charts/sales.json': JSON.stringify([
    { x: 1, y: 120, group: 'north' },
    { x: 2, y: 150, group: 'north' },
    { x: 1, y: 80, group: 'south' },
    { x: 2, y: 95, group: 'south' },
  ]),
  'charts/sales.yaml': '- x: 1\n  y: 120\n- x: 2\n  y: 150\n- x: 3\n  y: 90',
  'charts/north.csv': 'x,y\n1,30\n2,45\n3,50',
  'charts/south.csv': 'x,y\n1,20\n2,25\n3,40',
};

const fixtureReader: DataReader = {
  read: async (path) =>
    Object.prototype.hasOwnProperty.call(DATA_FIXTURES, path) ? DATA_FIXTURES[path]! : null,
};

const repoRoot = join(__dirname, '..');
const docsDir = join(repoRoot, 'docs', 'examples');
const sources: { name: string; markdown: string }[] = [
  { name: 'README.md', markdown: readFileSync(join(repoRoot, 'README.md'), 'utf8') },
  ...readdirSync(docsDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ name, markdown: readFileSync(join(docsDir, name), 'utf8') })),
];

describe('documented examples', () => {
  it('finds example files to check', () => {
    expect(sources.length).toBeGreaterThan(1);
  });

  for (const { name, markdown } of sources) {
    const blocks = extractBlocks(markdown);

    it(`${name} contains at least one example`, () => {
      expect(blocks.length).toBeGreaterThan(0);
    });

    blocks.forEach((source, index) => {
      it(`${name} block ${index + 1} renders`, async () => {
        const el = document.createElement('div');
        document.body.appendChild(el);

        const parsed = parseBlock(source);
        const resolved =
          collectDataPaths(parsed).length > 0
            ? await resolveData(parsed, fixtureReader)
            : parsed;

        // Any throw from here down is a broken documented example.
        const graph = renderGraph2d(el, normalize(resolved));
        expect(el.querySelector('.vis-panel')).not.toBeNull();
        graph.destroy();
      });
    });
  }
});
