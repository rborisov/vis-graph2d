import { MarkdownRenderChild, Plugin, TFile, normalizePath } from 'obsidian';
import { parseBlock } from './parser';
import { normalize } from './normalizer';
import { renderGraph2d } from './renderer';
import type { Graph2dHandle } from './renderer';
import { collectDataPaths, resolveData } from './data-source';
import type { DataReader, RawBlock } from './types';

/**
 * All mutable state for one rendered code block, across its initial load
 * and every later reload triggered by a save of a referenced data file.
 *
 * `torndown` is set by `child.onunload`, which is wired up *before* the
 * first `await` in `renderBlock` -- if the note closes while data is still
 * loading, the in-flight load sees the flag on the other side of the await
 * and skips rendering instead of creating a graph nothing will ever destroy.
 *
 * `reloading`/`dirty` serialize reloads: a save that arrives while a reload
 * is already in flight is not lost (it would be, if the watcher were
 * removed and re-added around each reload) and never runs concurrently with
 * the reload already in progress -- it is remembered and picked up as one
 * more pass immediately after.
 */
interface BlockState {
  readonly source: string;
  readonly el: HTMLElement;
  paths: string[];
  graph: Graph2dHandle | null;
  torndown: boolean;
  reloading: boolean;
  dirty: boolean;
}

export default class VisGraph2dPlugin extends Plugin {
  /** Live blocks keyed by the data files they read, for refresh on modify. */
  private readonly watchers = new Set<BlockState>();

  async onload(): Promise<void> {
    this.registerMarkdownCodeBlockProcessor('vis-graph2d', async (source, el, ctx) => {
      const child = new MarkdownRenderChild(el);
      ctx.addChild(child);

      const state: BlockState = {
        source,
        el,
        paths: [],
        graph: null,
        torndown: false,
        reloading: false,
        dirty: false,
      };

      // Assigned before the first await in renderBlock, so a teardown that
      // happens mid-load still runs this (see BlockState's doc comment).
      child.onunload = () => {
        state.torndown = true;
        this.watchers.delete(state);
        state.graph?.destroy();
        state.graph = null;
      };

      await this.renderBlock(state);
    });

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        for (const state of this.watchers) {
          if (state.paths.includes(file.path)) this.reload(state);
        }
      })
    );
  }

  /** Loads data (if any), renders, and (re)installs this block's watcher registration. */
  private async renderBlock(state: BlockState): Promise<void> {
    let block: RawBlock;
    try {
      block = parseBlock(state.source);
    } catch (e) {
      if (!state.torndown) {
        state.el.empty();
        renderError(state.el, e);
      }
      return;
    }

    const paths = collectDataPaths(block);
    if (paths.length > 0 && !state.torndown) {
      state.el.empty();
      state.el.createEl('div', { cls: 'graph2d-loading', text: 'Loading chart data…' });
    }

    try {
      const resolved = await resolveData(block, this.reader());
      const chart = normalize(resolved);

      // The note closed (or this block was removed) while the load above
      // was in flight: skip rendering entirely and register no watcher,
      // rather than attach a live graph and a permanent watcher to cleanup
      // that already ran and will never run again.
      if (state.torndown) return;

      state.el.empty();
      state.graph = renderGraph2d(state.el, chart);
      state.paths = paths;

      if (paths.length > 0) {
        this.watchers.add(state);
      } else {
        this.watchers.delete(state);
      }
    } catch (e) {
      if (!state.torndown) {
        state.el.empty();
        renderError(state.el, e);
      }
    }
  }

  /**
   * Handles a save of a watched data file. Reloads never overlap: a save
   * that arrives while one is already in flight is marked dirty and picked
   * up by one extra pass right after, instead of being dropped (there'd be
   * a window with no watcher registered at all) or running a second render
   * concurrently into the same element.
   */
  private reload(state: BlockState): void {
    if (state.reloading) {
      state.dirty = true;
      return;
    }
    state.reloading = true;
    void this.runReload(state);
  }

  private async runReload(state: BlockState): Promise<void> {
    do {
      state.dirty = false;
      state.graph?.destroy();
      state.graph = null;
      await this.renderBlock(state);
    } while (state.dirty && !state.torndown);
    state.reloading = false;
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
