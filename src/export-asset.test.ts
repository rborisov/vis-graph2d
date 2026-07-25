import { describe, it, expect, vi } from 'vitest';
import type { App } from 'obsidian';
import { saveExportAsset } from './export-asset';

/**
 * `hashBlockSource` and `getAssetPath` are private helpers inside
 * export-asset.ts (kept that way to stay a faithful port of the sibling
 * timeline plugin's file -- neither is exported there either). Exercised
 * here through the public `saveExportAsset` entry point instead, by
 * capturing the path it hands to `vault.createBinary`.
 */
function fakeApp(): { app: App; createBinary: ReturnType<typeof vi.fn> } {
  const createBinary = vi.fn(async (path: string) => ({ path }));
  const app = {
    vault: {
      getAbstractFileByPath: () => null,
      createBinary,
      modifyBinary: vi.fn(),
      getResourcePath: (file: { path: string }) => `app://local/${file.path}`,
    },
  } as unknown as App;
  return { app, createBinary };
}

const DATA_URL = 'data:image/png;base64,AAAA';

describe('saveExportAsset', () => {
  it('derives a stable hash (and therefore path) for identical block source', async () => {
    const path1 = await saveExportAsset(fakeApp().app, 'note.md', 'items: []', DATA_URL);
    const path2 = await saveExportAsset(fakeApp().app, 'note.md', 'items: []', DATA_URL);
    expect(path1).toBe(path2);
  });

  it('derives a different hash (and therefore path) for different block source', async () => {
    const path1 = await saveExportAsset(fakeApp().app, 'note.md', 'items: []', DATA_URL);
    const path2 = await saveExportAsset(fakeApp().app, 'note.md', 'items: [1]', DATA_URL);
    expect(path1).not.toBe(path2);
  });

  it('derives the asset path from a note at the vault root', async () => {
    const { app, createBinary } = fakeApp();
    await saveExportAsset(app, 'note.md', 'items: []', DATA_URL);
    const [path] = createBinary.mock.calls[0] as [string];
    expect(path).toMatch(/^note-graph2d-[0-9a-f]+\.png$/);
  });

  it('derives the asset path from a note in a nested folder, preserving the folder', async () => {
    const { app, createBinary } = fakeApp();
    await saveExportAsset(app, 'charts/2026/note.md', 'items: []', DATA_URL);
    const [path] = createBinary.mock.calls[0] as [string];
    expect(path).toMatch(/^charts\/2026\/note-graph2d-[0-9a-f]+\.png$/);
  });

  it('uses a graph2d-specific filename infix so exports never collide with the sibling timeline plugin', async () => {
    const { app, createBinary } = fakeApp();
    await saveExportAsset(app, 'note.md', 'items: []', DATA_URL);
    const [path] = createBinary.mock.calls[0] as [string];
    expect(path).toContain('-graph2d-');
    expect(path).not.toContain('-timeline-');
  });
});
