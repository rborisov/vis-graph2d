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

  /** Backing store for loadData()/saveData(), standing in for Obsidian's data.json. */
  private storedData: unknown = null;

  constructor(app: unknown, manifest: unknown) {
    super();
    this.app = app;
    this.manifest = manifest;
  }

  registerMarkdownCodeBlockProcessor(language: string, handler: CodeBlockHandler): void {
    this.codeBlockProcessors.set(language, handler);
  }

  async loadData(): Promise<unknown> {
    return this.storedData;
  }

  async saveData(data: unknown): Promise<void> {
    this.storedData = data;
  }

  addSettingTab(_tab: PluginSettingTab): void {
    /* no-op: tests drive the plugin directly and never open the settings UI */
  }
}

/** Minimal reimplementation of Obsidian's App: an opaque handle passed through, never inspected. */
export class App {}

/**
 * Minimal reimplementation of the Setting row builder. Each `add*` method
 * hands the callback a chainable stub component so `display()` methods
 * written against the real API run without a real settings pane.
 */
class SettingComponentStub<T> {
  private value: T | undefined;
  private changeCb: ((value: T) => unknown) | undefined;

  setValue(value: T): this {
    this.value = value;
    return this;
  }

  onChange(cb: (value: T) => unknown): this {
    this.changeCb = cb;
    return this;
  }

  setPlaceholder(_placeholder: string): this {
    return this;
  }

  addOptions(_options: Record<string, string>): this {
    return this;
  }
}

export class Setting {
  containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  setName(_name: string): this {
    return this;
  }

  setDesc(_desc: string): this {
    return this;
  }

  addDropdown(cb: (component: SettingComponentStub<string>) => unknown): this {
    cb(new SettingComponentStub<string>());
    return this;
  }

  addText(cb: (component: SettingComponentStub<string>) => unknown): this {
    cb(new SettingComponentStub<string>());
    return this;
  }

  addToggle(cb: (component: SettingComponentStub<boolean>) => unknown): this {
    cb(new SettingComponentStub<boolean>());
    return this;
  }
}

export abstract class PluginSettingTab {
  app: App;
  containerEl: HTMLElement;

  constructor(app: App, _plugin: Plugin) {
    this.app = app;
    // Real Obsidian gives this a live DOM element; under vitest's default
    // (node) environment there is no `document`, and none of these tests
    // open the settings UI, so a plain stand-in is enough.
    this.containerEl =
      typeof document !== 'undefined'
        ? document.createElement('div')
        : ({ empty: () => {}, createEl: () => ({}) as HTMLElement } as unknown as HTMLElement);
  }

  abstract display(): void;
}
