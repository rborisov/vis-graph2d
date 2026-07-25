/**
 * TEST-ONLY runtime stand-in for the `obsidian` package.
 *
 * The `obsidian` package in node_modules ships type definitions with no
 * runtime implementation (see node_modules/obsidian/package.json: the
 * `"main"` field is `""`) -- inside a real vault, Obsidian itself supplies
 * the module. `vitest.config.ts` aliases `obsidian` to this file so
 * `main.test.ts` can import and drive `VisGraph2dPlugin` directly, the way
 * Obsidian's own runtime would. It is never used by the production build:
 * `esbuild.config.mjs` marks `obsidian` external there, so the real module
 * resolves at plugin load time inside the app.
 *
 * Implements only the subset of the API surface `main.ts` actually calls.
 * Do not import this file from production code.
 */

/** Minimal reimplementation of Obsidian's Component lifecycle. */
export class Component {
  private loaded = false;
  private children: Component[] = [];

  onload(): void {
    /* overridden by subclasses */
  }

  onunload(): void {
    /* overridden by subclasses */
  }

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.onload();
    for (const child of this.children) child.load();
  }

  unload(): void {
    if (!this.loaded) return;
    this.loaded = false;
    this.onunload();
    for (const child of this.children) child.unload();
  }

  addChild<T extends Component>(component: T): T {
    this.children.push(component);
    if (this.loaded) component.load();
    return component;
  }

  removeChild<T extends Component>(component: T): T {
    this.children = this.children.filter((child) => child !== component);
    component.unload();
    return component;
  }

  register(_cb: () => void): void {
    /* no-op: nothing in main.ts relies on register() replay */
  }

  registerEvent(_eventRef: unknown): void {
    /* no-op: tests drive vault events directly via the fake vault */
  }
}

export class MarkdownRenderChild extends Component {
  containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    super();
    this.containerEl = containerEl;
  }
}

export class TFile {
  path: string;
  basename: string;
  extension: string;

  constructor(path: string) {
    this.path = path;
    const name = path.slice(path.lastIndexOf('/') + 1);
    const dot = name.lastIndexOf('.');
    this.basename = dot === -1 ? name : name.slice(0, dot);
    this.extension = dot === -1 ? '' : name.slice(dot + 1);
  }
}

export function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

type CodeBlockHandler = (
  source: string,
  el: HTMLElement,
  ctx: unknown
) => Promise<unknown> | void;

export abstract class Plugin extends Component {
  app: unknown;
  manifest: unknown;

  /** Handlers registered via registerMarkdownCodeBlockProcessor, exposed for tests to invoke directly. */
  readonly codeBlockProcessors = new Map<string, CodeBlockHandler>();

  constructor(app: unknown, manifest: unknown) {
    super();
    this.app = app;
    this.manifest = manifest;
  }

  registerMarkdownCodeBlockProcessor(language: string, handler: CodeBlockHandler): void {
    this.codeBlockProcessors.set(language, handler);
  }
}
