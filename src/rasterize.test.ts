import { describe, it, expect, vi } from 'vitest';
import type { App } from 'obsidian';
import type { Graph2dHandle } from './renderer';
import { rasterize } from './rasterize';

/**
 * `rasterize()`'s actual capture (html-to-image's `toPng`) needs a real
 * canvas, which happy-dom cannot provide -- that part is deferred to
 * manual verification (see task-10-report.md). What IS unit-testable, and
 * matters most here, is rasterize()'s own contract: a failure anywhere in
 * the capture pipeline must never throw and must never tear down the
 * still-working interactive graph. This drives that failure by giving
 * rasterize() a host element with no `.graph2d-plugin` container, which
 * makes it fail on its very first line -- before ever touching
 * html-to-image -- so this test needs no DOM/canvas support at all.
 */
function fakeGraph(): Graph2dHandle & {
  destroy: ReturnType<typeof vi.fn<() => void>>;
  redraw: ReturnType<typeof vi.fn<() => void>>;
} {
  return { destroy: vi.fn<() => void>(), redraw: vi.fn<() => void>() };
}

describe('rasterize', () => {
  it('never throws and leaves the interactive graph mounted when capture fails', async () => {
    // Captured as plain locals (not read back off `el`) so the assertions
    // below don't trip @typescript-eslint/unbound-method -- `el`'s type is
    // `HTMLElement`, where `empty`/`createEl` are method signatures, not
    // plain function-valued properties like `graph.destroy` below.
    const emptyMock = vi.fn<() => void>();
    const createElMock = vi.fn<() => HTMLElement>();
    const el = {
      querySelector: () => null,
      empty: emptyMock,
      createEl: createElMock,
    } as unknown as HTMLElement;
    const graph = fakeGraph();
    const app = {} as App;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(
        rasterize(el, graph, app, 'note.md', 'items: []')
      ).resolves.toBeUndefined();

      // The graph is left exactly as it was: not destroyed, and `el` was
      // never touched (no empty()/createEl() for a replacement <img>).
      expect(graph.destroy).not.toHaveBeenCalled();
      expect(emptyMock).not.toHaveBeenCalled();
      expect(createElMock).not.toHaveBeenCalled();

      // The failure is still surfaced to the console, not swallowed silently.
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(String(errorSpy.mock.calls[0]?.[0])).toContain('vis-graph2d');
    } finally {
      errorSpy.mockRestore();
    }
  });
});
