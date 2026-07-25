import { MarkdownRenderChild, Plugin } from 'obsidian';
import { parseBlock } from './parser';
import { normalize } from './normalizer';
import { renderGraph2d } from './renderer';

export default class VisGraph2dPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerMarkdownCodeBlockProcessor('vis-graph2d', (source, el, ctx) => {
      try {
        const chart = normalize(parseBlock(source));
        const graph = renderGraph2d(el, chart);
        const child = new MarkdownRenderChild(el);
        child.onunload = () => graph.destroy();
        ctx.addChild(child);
      } catch (e) {
        renderError(el, e);
      }
    });
  }
}

function renderError(el: HTMLElement, e: unknown): void {
  el.createEl('div', {
    cls: 'graph2d-error',
    text: `vis-graph2d error: ${e instanceof Error ? e.message : String(e)}`,
  });
}
