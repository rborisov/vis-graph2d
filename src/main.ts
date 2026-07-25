import { MarkdownRenderChild, Plugin, TFile, normalizePath } from 'obsidian';
import { parseBlock } from './parser';
import { normalize } from './normalizer';
import { renderGraph2d } from './renderer';
import { collectDataPaths, resolveData } from './data-source';
import type { DataReader, RawBlock } from './types';

export default class VisGraph2dPlugin extends Plugin {
  /** Live blocks keyed by the data files they read, for refresh on modify. */
  private readonly watchers = new Set<{ paths: string[]; rerender: () => void }>();

  async onload(): Promise<void> {
    this.registerMarkdownCodeBlockProcessor('vis-graph2d', async (source, el, ctx) => {
      const child = new MarkdownRenderChild(el);
      ctx.addChild(child);
      await this.renderBlock(source, el, child, ctx.sourcePath);
    });

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        for (const watcher of this.watchers) {
          if (watcher.paths.includes(file.path)) watcher.rerender();
        }
      })
    );
  }

  private async renderBlock(
    source: string,
    el: HTMLElement,
    child: MarkdownRenderChild,
    sourcePath: string
  ): Promise<void> {
    let block: RawBlock;
    try {
      block = parseBlock(source);
    } catch (e) {
      el.empty();
      renderError(el, e);
      return;
    }

    const paths = collectDataPaths(block);
    if (paths.length > 0) {
      el.empty();
      el.createEl('div', { cls: 'graph2d-loading', text: 'Loading chart data…' });
    }

    try {
      const resolved = await resolveData(block, this.reader());
      const chart = normalize(resolved);
      el.empty();
      const graph = renderGraph2d(el, chart);

      // rerender() removes this watcher before re-entering renderBlock,
      // which registers a fresh one. Without the removal, every save of a
      // data file would leave the old watcher behind and compound the
      // number of re-renders on the next save.
      const watcher = {
        paths,
        rerender: () => {
          this.watchers.delete(watcher);
          graph.destroy();
          void this.renderBlock(source, el, child, sourcePath);
        },
      };
      if (paths.length > 0) this.watchers.add(watcher);

      child.onunload = () => {
        this.watchers.delete(watcher);
        graph.destroy();
      };
    } catch (e) {
      el.empty();
      renderError(el, e);
    }
  }

  private reader(): DataReader {
    return {
      read: async (path) => {
        const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
        return file instanceof TFile ? this.app.vault.read(file) : null;
      },
    };
  }
}

function renderError(el: HTMLElement, e: unknown): void {
  el.createEl('div', {
    cls: 'graph2d-error',
    text: `vis-graph2d error: ${e instanceof Error ? e.message : String(e)}`,
  });
}
