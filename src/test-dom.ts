/**
 * happy-dom implements no layout engine, so every element reports a 0x0 box.
 * vis reads those dimensions to size its panels and to decide how many axis
 * labels fit, and with zeros it renders an empty axis. Stubbing plausible
 * dimensions is what makes Graph2d testable headlessly at all.
 *
 * These are fake measurements, not real layout: assert on structure and on
 * label *content*, never on pixel positions or exact label counts.
 */
export function stubLayout(width = 800, height = 400): void {
  const dims: [string, number][] = [
    ['offsetWidth', width],
    ['offsetHeight', height],
    ['clientWidth', width],
    ['clientHeight', height],
  ];
  for (const [prop, value] of dims) {
    Object.defineProperty(window.HTMLElement.prototype, prop, {
      configurable: true,
      get: () => value,
    });
  }
  Object.defineProperty(window.Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0, y: 0, top: 0, left: 0,
      right: width, bottom: height, width, height,
      toJSON() { /* structuredClone compatibility */ },
    }),
  });
}

/** Minimal shape of Obsidian's `DomElementInfo`, per obsidian.d.ts. */
interface DomElementInfo {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, string | number | boolean | null>;
}

/**
 * NOT part of the task brief's given test-dom.ts contents. Added because
 * `renderer.ts` and `main.ts` call Obsidian's `el.createEl(...)` DOM
 * extension exactly as specified in the brief, but the `obsidian` package in
 * this repo is types-only (see its package.json: `"main": ""`) -- there is
 * no runtime implementation to patch it onto HTMLElement.prototype outside
 * a real Obsidian window. Without this stub, every test that renders
 * anything fails with "el.createEl is not a function" regardless of
 * renderer.ts's own correctness. This reimplements just the subset actually
 * called: tag, optional cls/text/attr, optional callback.
 */
export function stubCreateEl(): void {
  Object.defineProperty(window.HTMLElement.prototype, 'createEl', {
    configurable: true,
    value: function createEl(
      this: HTMLElement,
      tag: string,
      o?: DomElementInfo | string,
      callback?: (el: HTMLElement) => void
    ): HTMLElement {
      const child = document.createElement(tag);
      const info: DomElementInfo | undefined = typeof o === 'string' ? { cls: o } : o;
      if (info?.cls !== undefined) {
        const clsValues = Array.isArray(info.cls) ? info.cls : [info.cls];
        // Real Obsidian accepts a space-separated class string per entry
        // (e.g. cls: 'foo bar'), which classList.add rejects outright.
        const classes = clsValues.flatMap((cls) => cls.split(/\s+/));
        for (const cls of classes) {
          if (cls !== '') child.classList.add(cls);
        }
      }
      if (info?.text !== undefined) child.textContent = info.text;
      if (info?.attr !== undefined) {
        for (const [key, value] of Object.entries(info.attr)) {
          if (value === null) continue;
          child.setAttribute(key, String(value));
        }
      }
      this.appendChild(child);
      callback?.(child);
      return child;
    },
  });
}

/**
 * NOT part of the task brief's given test-dom.ts contents. `main.ts` calls
 * Obsidian's `el.empty()` DOM extension (also types-only here, see
 * stubCreateEl above), to clear the loading placeholder / prior chart /
 * error box before rendering the next state. Only needed by main.test.ts.
 */
export function stubEmpty(): void {
  Object.defineProperty(window.HTMLElement.prototype, 'empty', {
    configurable: true,
    value: function empty(this: HTMLElement): void {
      while (this.firstChild) this.removeChild(this.firstChild);
    },
  });
}

/**
 * NOT part of the task brief's given test-dom.ts contents. Ported for
 * Task 10: `renderer.ts` (the `g2d-export-width` class) and `rasterize.ts`
 * (the capture-no-transitions class) both call Obsidian's `addClass`/
 * `removeClass` DOM extensions, which -- like `createEl`/`empty` above --
 * are only real at runtime inside actual Obsidian, not under happy-dom.
 * Thin wrappers over the standard `classList` API, which happy-dom does
 * implement natively.
 */
export function stubClassMethods(): void {
  Object.defineProperty(window.HTMLElement.prototype, 'addClass', {
    configurable: true,
    value: function addClass(this: HTMLElement, ...classes: string[]): void {
      for (const cls of classes) this.classList.add(cls);
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, 'removeClass', {
    configurable: true,
    value: function removeClass(this: HTMLElement, ...classes: string[]): void {
      for (const cls of classes) this.classList.remove(cls);
    },
  });
}
