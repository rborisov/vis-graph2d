import { TFile, type App } from 'obsidian';
import { dataUrlToArrayBuffer } from './data-url';

// Writes the rasterized PNG to a real vault file instead of embedding it
// inline as a data: URL. pubobs's own collectAssets() already has a
// fallback for any <img src="app://..."> matching a real vault file by
// name, so it picks this up and uploads it as a normal, separate asset.
// Embedding large PNGs inline instead blew up the size of pubobs's sync
// request body (JSON.stringify({ files, assets, ... })) past whatever
// limit its server/proxy enforces, breaking the entire sync with a
// truncated, invalid JSON response.
//
// The filename is a stable hash of the block's source (not the note's
// full content) plus the note's own basename, so re-syncing the same
// unchanged block overwrites the same file rather than piling up new
// ones on every sync.
export async function saveExportAsset(
  app: App,
  sourcePath: string,
  blockSource: string,
  dataUrl: string
): Promise<string> {
  const path = getAssetPath(sourcePath, hashBlockSource(blockSource));
  const data = dataUrlToArrayBuffer(dataUrl);
  const file = await writeBinary(app, path, data);
  return app.vault.getResourcePath(file);
}

function hashBlockSource(source: string): string {
  let hash = 5381;
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) + hash + source.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

function getAssetPath(sourcePath: string, hash: string): string {
  const lastSlash = sourcePath.lastIndexOf('/');
  const folder = lastSlash >= 0 ? sourcePath.slice(0, lastSlash) : '';
  const noteBase = (lastSlash >= 0 ? sourcePath.slice(lastSlash + 1) : sourcePath).replace(/\.md$/, '');
  const filename = `${noteBase}-graph2d-${hash}.png`;
  return folder ? `${folder}/${filename}` : filename;
}

async function writeBinary(app: App, path: string, data: ArrayBuffer): Promise<TFile> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modifyBinary(existing, data);
    return existing;
  }
  return app.vault.createBinary(path, data);
}
