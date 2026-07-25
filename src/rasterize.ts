import type { App } from 'obsidian';
import { toPng } from 'html-to-image';
import { saveExportAsset } from './export-asset';
import type { Graph2dHandle } from './renderer';

export interface Capture {
  dataUrl: string;
  width: number;
  height: number;
}

// Waits for layout to settle, then captures el as a PNG. Exported as its
// own function (not inlined into rasterize, below) because it's ported
// from the sibling vis-timeline plugin, where it's also shared by a manual
// "save snapshot" command that vis-graph2d does not have -- only
// rasterize() calls it here today, but keeping the same wait-then-capture
// sequence factored out this way costs nothing and matches the source it
// was ported from.
export async function capturePng(el: HTMLElement): Promise<Capture> {
  // vis-timeline's bundled CSS animates group rows via CSS transitions
  // (height/top, up to 0.4s ease-in-out) when they resize/reposition. A CSS
  // transition triggers exactly one DOM mutation when it starts — the
  // browser then interpolates it visually via the compositor with no
  // further mutations — so waitForStable() below would see things go quiet
  // almost immediately while the transition is still visually running,
  // capturing mid-animation. Disabling transitions/animations first forces
  // every style change to apply instantly instead.
  el.addClass('g2d-capture-no-transitions');
  try {
    // vis-timeline's layout (especially with autoHeight, which needs to
    // measure content, resize, then remeasure) can take more than a single
    // requestAnimationFrame to settle — waiting a fixed frame count was not
    // reliable. Instead, wait for the DOM to actually stop changing, the
    // same technique pubobs's own renderNoteToHTML uses for this exact
    // problem (see waitForStable below).
    await waitForStable(el);
    await waitForImages(el);
    // Cap at 2x even on higher-DPI devices — beyond that adds little
    // visible clarity for a diagram of flat colors and bold text, but
    // roughly quadruples+ the exported PNG's pixel count and file size.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    // toPng() sizes its capture canvas from the element's own reported
    // height (offsetHeight/getBoundingClientRect), not the true extent of
    // its content — .tl-auto-height's overflow:visible (renderer.ts) makes
    // overflowing content paint on screen without changing that reported
    // height, so a capture based on it could still crop the last row even
    // though nothing looks clipped in a live view. el.scrollHeight was
    // tried first but wasn't reliable either — vis-timeline positions
    // group rows absolutely within nested inner panels
    // (.vis-panel.vis-center/-left/-right), and scrollHeight measured on
    // our outer container doesn't necessarily see through those nested
    // positioning contexts. Measuring every descendant's actual bottom
    // edge directly is slower but can't be fooled by any of that.
    const captureHeight = measureDeepestBottomEdge(el);
    const dataUrl = await capturePngWithoutLeakingFontStyles(el, {
      pixelRatio,
      cacheBust: true,
      height: captureHeight,
    });
    const naturalHeight = await getImageNaturalHeight(dataUrl);
    const width = el.clientWidth;
    const height = Math.round(naturalHeight / pixelRatio);
    return { dataUrl, width, height };
  } finally {
    el.removeClass('g2d-capture-no-transitions');
  }
}

export async function rasterize(
  el: HTMLElement,
  graph: Graph2dHandle,
  app: App,
  sourcePath: string,
  blockSource: string
): Promise<void> {
  try {
    // Capture the graph's own container, not `el` itself. renderGraph2d()
    // widens the container beyond el's ambient (pubobs-constrained) width for
    // the export path — capturing el would clip that overflow instead of
    // actually rendering it wider.
    const container = el.querySelector<HTMLElement>('.graph2d-plugin');
    if (!container) throw new Error('graph2d container not found');

    // vis-timeline's own auto-height computation reads its center panel's
    // current offsetHeight to size the root (see
    // node_modules/vis-timeline/.../vis-timeline-graph2d.js — search
    // "props.center.height = dom.center.offsetHeight") — but offsetHeight
    // only reflects layout from before this same redraw pass, so it can
    // read one redraw cycle stale, especially with many groups. Forcing a
    // few more redraw+layout-flush cycles here (beyond renderTimeline()'s
    // single scheduled one) lets the height actually converge before
    // capturing.
    await settleHeight(container, graph);

    const { dataUrl, width, height } = await capturePng(container);
    // Written as a real vault file (not embedded inline) so pubobs uploads
    // it as a normal asset instead of bloating its sync request body — see
    // export-asset.ts.
    const resourcePath = await saveExportAsset(app, sourcePath, blockSource, dataUrl);

    graph.destroy();
    el.empty();
    el.createEl('img', {
      cls: 'g2d-export-img',
      attr: { src: resourcePath, width, height },
    });

    // Each rasterize() call allocates a full DOM clone, an SVG wrapping it,
    // a canvas, and PNG/base64 data — pubobs syncs run through many of
    // these in quick succession (one per timeline block), which can
    // outpace V8's garbage collector and exhaust the renderer's heap
    // (confirmed: an actual OOM crash of Obsidian's own process during a
    // sync with many blocks). Yielding to a macrotask after each capture
    // gives the GC a chance to reclaim memory between blocks.
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  } catch (e) {
    // Rasterization is a nicety on top of an already-working interactive
    // widget — never let a failure here break the note. Leave `graph`
    // mounted and `el` untouched.
    console.error('vis-graph2d: PNG rasterization failed, leaving interactive widget', e);
  }
}

// html-to-image's toPng() embeds fonts for faithful capture by injecting a
// <style> element (with the font's data as base64) into the real
// document.head — not into a detached clone, despite this repo's earlier
// static read of its source suggesting otherwise. It's never removed, so
// repeated calls within the same session (one per rasterized timeline
// block) each leave their own copy behind. Confirmed in production: pubobs
// sync of a vault with 181 timeline blocks inflated the shared CSS asset
// its extractStyles() ships to readers from 1.3MB to 11.4MB (181 duplicate
// @font-face embeds of an unrelated vault font), which was large enough to
// OOM-kill pubobs's backend. Snapshotting document.head's <style> elements
// before the call and removing whatever's new afterward cleans this up —
// the embedded font data only needs to exist for this one capture.
// Finds the lowest bottom edge among every descendant of el, relative to
// el's own top — a direct, can't-be-fooled-by-nested-overflow measurement
// of the true rendered content height, used as the export capture height
// instead of trusting scrollHeight or vis-timeline's own size calculation.
function measureDeepestBottomEdge(el: HTMLElement): number {
  const containerTop = el.getBoundingClientRect().top;
  let maxBottom = el.scrollHeight;
  for (const child of Array.from(el.querySelectorAll('*'))) {
    const bottom = child.getBoundingClientRect().bottom - containerTop;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return Math.ceil(maxBottom);
}

async function capturePngWithoutLeakingFontStyles(
  el: HTMLElement,
  options: Parameters<typeof toPng>[1]
): Promise<string> {
  const stylesBefore = new Set(Array.from(activeDocument.head.querySelectorAll('style')));
  try {
    return await toPng(el, options);
  } finally {
    for (const style of Array.from(activeDocument.head.querySelectorAll('style'))) {
      if (!stylesBefore.has(style)) style.remove();
    }
  }
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

// Repeatedly redraws and waits a frame until el's height stops changing
// between iterations (or maxIterations is hit) — see the comment at the
// call site in rasterize() for why a single redraw isn't always enough.
async function settleHeight(
  el: HTMLElement,
  graph: { redraw(): void },
  maxIterations = 6
): Promise<void> {
  let lastHeight = -1;
  for (let i = 0; i < maxIterations; i++) {
    graph.redraw();
    await waitForNextFrame();
    const currentHeight = measureDeepestBottomEdge(el);
    if (currentHeight === lastHeight) return;
    lastHeight = currentHeight;
  }
}

// Waits until el's subtree stops mutating for quietForMs, up to maxWaitMs
// total. Starts with one animation-frame wait so renderTimeline()'s own
// scheduled redraw (see renderer.ts) has a chance to fire and produce at
// least one mutation before the quiet-period timer starts — otherwise an
// observer started before anything has changed yet could see "quiet"
// immediately and resolve before vis-timeline has laid out at all.
async function waitForStable(el: HTMLElement, quietForMs = 150, maxWaitMs = 2000): Promise<void> {
  await waitForNextFrame();
  return new Promise((resolve) => {
    let quietTimer: number;
    const done = () => {
      observer.disconnect();
      window.clearTimeout(maxTimer);
      window.clearTimeout(quietTimer);
      resolve();
    };
    const observer = new MutationObserver(() => {
      window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(done, quietForMs);
    });
    observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: true });
    const maxTimer: number = window.setTimeout(done, maxWaitMs);
    quietTimer = window.setTimeout(done, quietForMs);
  });
}

async function waitForImages(el: HTMLElement): Promise<void> {
  const images = Array.from(el.querySelectorAll('img'));
  await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
}

function getImageNaturalHeight(dataUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalHeight);
    img.onerror = () => reject(new Error('Failed to load captured PNG for measurement'));
    img.src = dataUrl;
  });
}
