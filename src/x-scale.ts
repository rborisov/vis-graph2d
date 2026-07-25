import type { XAxisMode } from './types';
import { moment } from 'vis-timeline/standalone';

export const MS_PER_DAY = 86400000;

/** Number of axis labels to aim for when choosing a step. */
const TARGET_LABEL_COUNT = 10;

/**
 * vis's own moment instance, pinned to UTC. Passed as the `moment` axis
 * option so vis's TimeStep computes ticks in UTC instead of the reader's
 * local timezone, which would otherwise displace every numeric/category
 * label by the UTC offset.
 */
const UTC_MOMENT = (date: Date) => moment(date).utc();

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

/** The 1/2/5 x 10^k step nearest span/10, so labels land on round values. */
export function chooseNiceStep(span: number): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / TARGET_LABEL_COUNT;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

class NumericScale implements XScale {
  readonly overridesLabels = true;
  private readonly step: number; // in author units
  private readonly anchor: number; // author value at internal time 0

  constructor(values: unknown[]) {
    const numbers = values
      .map((v) => toNumber(v))
      .filter((n) => n !== undefined);
    const min = numbers.length > 0 ? Math.min(...numbers) : 0;
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    this.step = chooseNiceStep(max - min);
    // Anchoring on a multiple of the step is what makes every tick land on a
    // round number even when the data does not start at one.
    this.anchor = Math.floor(min / this.step) * this.step;
  }

  toInternal(value: unknown): number {
    const n = toNumber(value);
    if (n === undefined) throw new Error(`"${String(value)}" is not a number.`);
    return ((n - this.anchor) / this.step) * MS_PER_DAY;
  }

  formatLabel(value: MomentLike): string {
    const slots = value.valueOf() / MS_PER_DAY;
    const authorValue = this.anchor + slots * this.step;
    // Float division then multiplication reintroduces tiny errors; 12
    // significant digits is more precision than any axis label needs.
    return String(Number(authorValue.toPrecision(12)));
  }

  axisHints(): Record<string, unknown> {
    return {
      showMajorLabels: false,
      timeAxis: { scale: 'day', step: 1 },
      moment: UTC_MOMENT,
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
      moment: UTC_MOMENT,
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
