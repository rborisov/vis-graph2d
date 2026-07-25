import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile } from 'obsidian';
import type { Graph2dHandle } from './renderer';
import type { rasterize } from './rasterize';

/**
 * main.ts is lifecycle-only: parsing, normalizing, and rendering are all
 * delegated to modules covered elsewhere (parser.test.ts, normalizer.test.ts,
 * renderer.test.ts). These tests drive VisGraph2dPlugin itself -- teardown
 * races, watcher bookkeeping, save-triggered reloads -- against a fake vault
 * whose reads can be gated on a promise the test controls. `renderGraph2d`
 * is mocked so these stay fast and focused on lifecycle, not on vis-timeline.
 *
 * Typing note: `tsc -noEmit` (npm run build) resolves `obsidian` to the real
 * (types-only) package, not to src/test-obsidian.ts -- only vitest's module
 * resolver is aliased (see vitest.config.ts). So anywhere this file relies
 * on a runtime member the stub adds but the real .d.ts doesn't declare (a
 * `path` constructor arg on TFile, `codeBlockProcessors` on Plugin), the
 * mismatch is bridged with an explicit `as unknown as ...` cast, never `any`.
 */

type Handler = (source: string, el: HTMLElement, ctx: unknown) => Promise<unknown> | void;

/** Builds a real (stub) TFile at runtime; cast bridges the real .d.ts's zero-arg constructor. */
function makeFile(path: string): TFile {
  const Ctor = TFile as unknown as new (path: string) => TFile;
  return new Ctor(path);
}

interface DeferredRead {
  promise: Promise<string>;
  resolve: (content: string) => void;
}

function deferredRead(): DeferredRead {
  let resolve!: (content: string) => void;
  const promise = new Promise<string>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const { renderGraph2dMock, rasterizeMock } = vi.hoisted(() => ({
  renderGraph2dMock: vi.fn(),
  rasterizeMock: vi.fn<typeof rasterize>(),
}));

vi.mock('./renderer', () => ({
  renderGraph2d: renderGraph2dMock,
}));

vi.mock('./rasterize', () => ({
  rasterize: rasterizeMock,
}));

/** Fake host element: only the two Obsidian DOM extensions main.ts calls. */
function fakeEl(): HTMLElement {
  return {
    empty: () => {},
    createEl: () => ({}) as HTMLElement,
  } as unknown as HTMLElement;
}

interface FakeCtx {
  sourcePath: string;
  addChild: (c: unknown) => void;
}

/** Fake MarkdownPostProcessorContext. `capture` mirrors what real Obsidian
 * does on addChild: since the section is already part of a loaded render
 * tree, the child is loaded immediately, which is what makes its onunload
 * callback live and callable via a later `unload()`. */
function fakeCtx(sourcePath: string, capture?: (child: { load(): void; unload(): void }) => void): FakeCtx {
  return {
    sourcePath,
    addChild: (c) => {
      const child = c as { load(): void; unload(): void };
      child.load();
      capture?.(child);
    },
  };
}

interface FakeVault {
  read: ReturnType<typeof vi.fn>;
  getAbstractFileByPath: (path: string) => TFile | null;
  on: (name: string, cb: (file: TFile) => void) => unknown;
  emitModify: (path: string) => void;
}

function fakeVault(defaultContent: string): FakeVault {
  const listeners: Array<(file: TFile) => void> = [];
  const read = vi.fn(() => Promise.resolve(defaultContent));
  return {
    read,
    getAbstractFileByPath: (path) => (path.endsWith('.csv') ? makeFile(path) : null),
    on: (_name, cb) => {
      listeners.push(cb);
      return {};
    },
    emitModify: (path) => {
      const file = makeFile(path);
      for (const cb of listeners) cb(file);
    },
  };
}

async function loadPlugin(vault: FakeVault): Promise<Handler> {
  // Dynamically imported so each test's `vi.mock('./renderer', ...)` (set up
  // once at module scope, above) is in effect before main.ts is evaluated.
  const { default: VisGraph2dPluginClass } = await import('./main');
  type Ctor = typeof VisGraph2dPluginClass;
  const app = { vault } as unknown as ConstructorParameters<Ctor>[0];
  const manifest = {} as unknown as ConstructorParameters<Ctor>[1];
  const plugin = new VisGraph2dPluginClass(app, manifest);
  await plugin.onload();
  const withProcessors = plugin as unknown as { codeBlockProcessors: Map<string, Handler> };
  const handler = withProcessors.codeBlockProcessors.get('vis-graph2d');
  if (!handler) throw new Error('vis-graph2d code block processor was not registered');
  return handler;
}

function graphHandles(): Array<{ destroy: ReturnType<typeof vi.fn> }> {
  return renderGraph2dMock.mock.results.map((r) => r.value as { destroy: ReturnType<typeof vi.fn> });
}

beforeEach(() => {
  renderGraph2dMock.mockReset();
  renderGraph2dMock.mockImplementation(
    () => ({ destroy: vi.fn(), redraw: vi.fn() }) satisfies Graph2dHandle
  );
  rasterizeMock.mockReset();
  rasterizeMock.mockResolvedValue(undefined);
});

describe('VisGraph2dPlugin lifecycle', () => {
  it('does not leak a graph or a watcher when the note closes during the initial load', async () => {
    const vault = fakeVault('x,y\n1,10');
    const gate = deferredRead();
    vault.read.mockReturnValueOnce(gate.promise);

    const handler = await loadPlugin(vault);

    let capturedChild: { load(): void; unload(): void } | undefined;
    const ctx = fakeCtx('note.md', (c) => {
      capturedChild = c;
    });

    const pending = handler('data: a.csv', fakeEl(), ctx);

    // The note is closed (or the code block edited away) while the read is
    // still in flight: the framework tears the render child down now.
    expect(capturedChild).toBeDefined();
    capturedChild!.unload();

    // The in-flight load now completes.
    gate.resolve('x,y\n1,10');
    await pending;

    // Buggy behavior: renderGraph2d still gets called (a live, undestroyed
    // Graph2d) and a permanent watcher gets registered. Fixed behavior: no
    // graph is created at all once teardown has already happened.
    expect(renderGraph2dMock).not.toHaveBeenCalled();

    // A leaked watcher would re-render on the next save of the referenced
    // file. Prove none was registered: a save produces no further render.
    vault.emitModify('a.csv');
    await Promise.resolve();
    await Promise.resolve();
    expect(renderGraph2dMock).not.toHaveBeenCalled();
  });

  it('destroys the graph and stops watching on normal teardown', async () => {
    const vault = fakeVault('x,y\n1,10');
    const handler = await loadPlugin(vault);

    let capturedChild: { load(): void; unload(): void } | undefined;
    const ctx = fakeCtx('note.md', (c) => {
      capturedChild = c;
    });

    await handler('data: a.csv', fakeEl(), ctx);
    expect(renderGraph2dMock).toHaveBeenCalledTimes(1);
    const [handle] = graphHandles();

    capturedChild!.unload();
    expect(handle!.destroy).toHaveBeenCalledTimes(1);

    vault.emitModify('a.csv');
    await Promise.resolve();
    await Promise.resolve();
    expect(renderGraph2dMock).toHaveBeenCalledTimes(1); // no re-render after teardown
  });

  it('does not drop a save that arrives while a reload is already in flight', async () => {
    const vault = fakeVault('x,y\n1,10');
    const handler = await loadPlugin(vault);

    await handler('data: a.csv', fakeEl(), fakeCtx('note.md'));
    expect(renderGraph2dMock).toHaveBeenCalledTimes(1);

    const gate = deferredRead();
    vault.read.mockReturnValueOnce(gate.promise);

    // First save starts a reload; its read is gated and stays pending.
    vault.emitModify('a.csv');
    expect(vault.read).toHaveBeenCalledTimes(2);

    // Second save arrives before the first reload's read has resolved.
    vault.emitModify('a.csv');

    // Let the first reload's read resolve. If the second save was not
    // dropped, exactly one more reload must follow automatically.
    gate.resolve('x,y\n2,20');

    await vi.waitFor(() => {
      if (renderGraph2dMock.mock.calls.length < 3) {
        throw new Error(`expected 3 renders, got ${renderGraph2dMock.mock.calls.length}`);
      }
    });

    expect(renderGraph2dMock).toHaveBeenCalledTimes(3); // initial + 2 reloads
    expect(vault.read).toHaveBeenCalledTimes(3);

    const handles = graphHandles();
    expect(handles[0]!.destroy).toHaveBeenCalledTimes(1); // replaced by reload 1
    expect(handles[1]!.destroy).toHaveBeenCalledTimes(1); // replaced by reload 2
    expect(handles[2]!.destroy).not.toHaveBeenCalled(); // still current
  });
});

/**
 * Task 10's export path: main.ts routes to rasterize() instead of
 * registering a watcher whenever the code block is rendered inside a
 * pubobs `[data-pubobs-render]` wrapper. `./rasterize` is mocked (see
 * `rasterizeMock` above) so these tests can assert it was actually called,
 * rather than relying only on side effects of the real implementation
 * (rasterize's real capture needs a real canvas that happy-dom cannot
 * provide -- that part is covered manually, see task-10-report.md).
 * `fakeExportEl` gives main.ts just enough surface to run its own routing
 * logic (`closest`, `empty`, `createEl`); `querySelector` is included only
 * because rasterize.ts's real container lookup would otherwise crash if a
 * test ever exercised the unmocked path.
 */
function fakeExportEl(): HTMLElement {
  return {
    empty: () => {},
    createEl: () => ({}) as HTMLElement,
    querySelector: () => null,
    closest: (selector: string) => (selector === '[data-pubobs-render]' ? ({} as Element) : null),
  } as unknown as HTMLElement;
}

describe('VisGraph2dPlugin pubobs export routing', () => {
  it('routes to rasterize and registers no watcher inside a [data-pubobs-render] container', async () => {
    const vault = fakeVault('x,y\n1,10');
    const handler = await loadPlugin(vault);

    await handler('data: a.csv', fakeExportEl(), fakeCtx('note.md'));

    // renderGraph2d was still called (with exportMode=true, the third arg)
    // -- the export path renders the chart before handing it to rasterize.
    expect(renderGraph2dMock).toHaveBeenCalledTimes(1);
    expect(renderGraph2dMock.mock.calls[0]?.[2]).toBe(true);

    // rasterize() was actually invoked. This is the assertion with teeth:
    // deleting the entire `if (isPubobsExport) { await rasterize(...);
    // return; }` block from main.ts must make this fail (verified --
    // see task-10-report.md).
    expect(rasterizeMock).toHaveBeenCalledTimes(1);

    // No watcher was registered: a save of the referenced data file must
    // not trigger a re-render of a block that is now a static image. A
    // real macrotask wait is used here (not a fixed number of microtask
    // ticks): `vault.emitModify` kicks off `reload` -> `runReload` as a
    // fire-and-forget async chain (resolveData -> normalize ->
    // renderBlock's continuation), and a couple of `await
    // Promise.resolve()` ticks is not reliably enough hops for that chain
    // to reach renderGraph2d again -- which is exactly what let this test
    // pass even with the routing removed entirely before this fix. A
    // `setTimeout(0)` yields a full macrotask turn, which drains every
    // pending microtask first regardless of chain depth.
    vault.emitModify('a.csv');
    // This file runs under vitest's default (Node) environment, not
    // happy-dom -- there is no `window` global here to route through, so
    // this is the one legitimate use of the bare timer the obsidianmd rule
    // otherwise (correctly) guards against in real plugin code.
    // eslint-disable-next-line obsidianmd/prefer-window-timers
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(renderGraph2dMock).toHaveBeenCalledTimes(1);
  });

  it('does not throw on unload after a successful export (no double-destroy)', async () => {
    // rasterize() destroys the graph itself on a successful export, but
    // (before Task 10's fix) main.ts never cleared `state.graph`
    // afterward, so `child.onunload`'s own `state.graph?.destroy()` called
    // destroy() a second time on an already-destroyed graph. The real
    // Graph2d.destroy() is not idempotent and throws on that second call
    // (confirmed: `TypeError: Cannot read properties of null (reading
    // 'root')`) -- mirrored here so this test fails the same way if the
    // fix regresses, instead of passing vacuously against a `vi.fn()` that
    // tolerates being called twice.
    const vault = fakeVault('x,y\n1,10');
    let destroyCalls = 0;
    renderGraph2dMock.mockImplementation(
      () =>
        ({
          destroy: () => {
            destroyCalls += 1;
            if (destroyCalls > 1) {
              throw new TypeError("Cannot read properties of null (reading 'root')");
            }
          },
          redraw: vi.fn(),
        }) satisfies Graph2dHandle
    );
    // Simulate a successful export: rasterize() destroys the graph itself
    // and returns normally, exactly as the real implementation does on the
    // success path.
    rasterizeMock.mockImplementation(async (_el, graph) => {
      graph.destroy();
    });

    const handler = await loadPlugin(vault);
    let capturedChild: { load(): void; unload(): void } | undefined;
    const ctx = fakeCtx('note.md', (c) => {
      capturedChild = c;
    });

    await handler('data: a.csv', fakeExportEl(), ctx);
    expect(destroyCalls).toBe(1); // rasterize's own destroy, on success

    expect(() => capturedChild!.unload()).not.toThrow();
    expect(destroyCalls).toBe(1); // onunload must not have destroyed again
  });
});
