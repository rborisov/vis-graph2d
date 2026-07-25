import type { XAxisMode } from './types';

export const MS_PER_DAY = 86400000;

/** Number of axis labels to aim for when choosing a step. */
const TARGET_LABEL_COUNT = 8;

/**
 * Anything carrying an epoch-millisecond value. vis calls label formatters
 * with a moment object, not a Date, so this is the accessor they share.
 */
export interface MomentLike {
  valueOf(): number;
}

/**
 * Maps author-supplied x values onto the epoch-millisecond range that
 * Graph2d works in, and maps positions on that range back to display labels.
 */
export interface XScale {
  /** True when the renderer must install a custom axis label formatter. */
  readonly overridesLabels: boolean;
  /** Author value -> internal epoch milliseconds. */
  toInternal(value: unknown): number;
  /** Internal position -> the text shown on the axis. */
  formatLabel(value: MomentLike): string;
  /** Extra vis options this scale needs (label visibility, fixed step). */
  axisHints(): Record<string, unknown>;
}

export function createXScale(mode: XAxisMode, values: unknown[]): XScale {
  switch (mode) {
    case 'time':
      return new TimeScale();
    case 'numeric':
      return new NumericScale(values);
    case 'category':
      return new CategoryScale(values);
    default:
      throw new Error(
        `Unknown xAxis mode "${String(mode)}". Use "time", "numeric", or "category".`
      );
  }
}

class TimeScale implements XScale {
  readonly overridesLabels = false;

  toInternal(value: unknown): number {
    if (value instanceof Date) return value.getTime();
    // Numbers are epoch milliseconds, matching vis's own convention.
    if (typeof value === 'number') return value;
    const parsed = Date.parse(String(value));
    if (Number.isNaN(parsed)) {
      throw new Error(`"${String(value)}" is not a valid date.`);
    }
    return parsed;
  }

  formatLabel(): string {
    // Never called: overridesLabels is false, so vis formats its own labels.
    return '';
  }

  axisHints(): Record<string, unknown> {
    return {};
  }
}

class NumericScale implements XScale {
  readonly overridesLabels = true;
  private readonly unitMs: number;
  private readonly stepDays: number;

  constructor(values: unknown[]) {
    const numbers = values.map((v) => toNumber(v)).filter((n) => n !== undefined);
    const span = numbers.length > 0 ? Math.max(...numbers) - Math.min(...numbers) : 0;
    this.unitMs = chooseUnitMs(span);
    const internalDays = (span * this.unitMs) / MS_PER_DAY;
    this.stepDays = chooseStep(internalDays);
  }

  toInternal(value: unknown): number {
    const n = toNumber(value);
    if (n === undefined) throw new Error(`"${String(value)}" is not a number.`);
    return n * this.unitMs;
  }

  formatLabel(value_: MomentLike): string {
    const value = value_.valueOf() / this.unitMs;
    // Float multiplication then division reintroduces tiny errors (0.25
    // can come back as 0.2500000000000001). 12 significant digits is far
    // more precision than any axis label needs and removes the noise.
    return String(Number(value.toPrecision(12)));
  }

  axisHints(): Record<string, unknown> {
    return {
      showMajorLabels: false,
      timeAxis: { scale: 'day', step: this.stepDays },
    };
  }
}

class CategoryScale implements XScale {
  readonly overridesLabels = true;
  private readonly names: string[] = [];
  private readonly indices = new Map<string, number>();

  constructor(values: unknown[]) {
    for (const value of values) {
      const name = String(value);
      if (!this.indices.has(name)) {
        this.indices.set(name, this.names.length);
        this.names.push(name);
      }
    }
  }

  toInternal(value: unknown): number {
    const name = String(value);
    const index = this.indices.get(name);
    if (index === undefined) {
      throw new Error(`unknown category "${name}".`);
    }
    return index * MS_PER_DAY;
  }

  formatLabel(value: MomentLike): string {
    const index = Math.round(value.valueOf() / MS_PER_DAY);
    return this.names[index] ?? '';
  }

  axisHints(): Record<string, unknown> {
    return {
      showMajorLabels: false,
      timeAxis: { scale: 'day', step: 1 },
    };
  }
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Picks a power-of-ten multiplier so the data span maps to roughly 10-1000
 * internal days. vis chooses its axis scale from the visible range, and only
 * a day-scale range in that band yields round-numbered step sizes for both
 * x: [0, 1] and x: [0, 1000000].
 */
export function chooseUnitMs(span: number): number {
  if (span <= 0) return MS_PER_DAY;
  const exponent = Math.round(2 - Math.log10(span));
  return MS_PER_DAY * Math.pow(10, exponent);
}

/** Rounds up to the nearest 1/2/5 x 10^k so labels land on round values. */
function chooseStep(internalDays: number): number {
  if (!Number.isFinite(internalDays) || internalDays <= 0) return 1;
  const raw = internalDays / TARGET_LABEL_COUNT;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(1, Math.round(factor * magnitude));
}
