import type { XScale } from './x-scale';

export type XAxisMode = 'time' | 'numeric' | 'category';

export type GraphType = 'line' | 'bar' | 'points';

export interface PointLabel {
  content?: string;
  xOffset?: number;
  yOffset?: number;
  className?: string;
}

/** A data point exactly as written by the user, before any coercion. */
export interface RawPoint {
  x?: unknown;
  y?: unknown;
  group?: string | number;
  end?: unknown;
  label?: PointLabel;
  [key: string]: unknown;
}

/**
 * Shading configuration in friendly form. `below`/`above` are relative to
 * the axis, not an arbitrary threshold value -- vis's `shaded.orientation`
 * has no such concept, so a number here is a user mistake, not a value to
 * honor. `below`/`above` are typed `unknown` (not `boolean`) because that
 * mistake is exactly what compileFill's runtime check must catch; a
 * `boolean` type would let a wrongly-typed author value through silently.
 */
export type FillSpec =
  | boolean
  | 'below'
  | 'above'
  | { below?: unknown; above?: unknown; to?: string | number };

/** A series as written by the user. Friendly fields plus raw vis pass-through. */
export interface RawGroup {
  id: string | number;
  content?: string;
  /** Friendly graph type. Compiles to vis's `options.style`. */
  type?: GraphType;
  color?: string;
  fill?: FillSpec;
  width?: number;
  dashes?: number[];
  points?: boolean | { style?: string; size?: number };
  interpolation?: false | 'centripetal' | 'chordal' | 'uniform';
  /** Columnar data for this series. */
  x?: unknown[];
  y?: unknown[];
  /** External data file reference for this series. */
  data?: string;
  /** Raw vis inline CSS. Always wins over friendly fields. */
  style?: string;
  className?: string;
  /** Raw vis group options. Always wins over friendly fields. */
  options?: Record<string, unknown>;
  visible?: boolean;
  [key: string]: unknown;
}

/** Block-level options. `xAxis` and `height` are ours; the rest go to vis. */
export interface BlockOptions {
  xAxis?: XAxisMode;
  height?: string;
  [key: string]: unknown;
}

export interface RawBlock {
  items: RawPoint[];
  groups?: RawGroup[];
  options: BlockOptions;
  /** Shared columnar x values. */
  x?: unknown[];
  /** Block-level external data file reference. */
  data?: string;
}

/** A point in the shape vis Graph2d consumes. */
export interface VisPoint {
  x: Date;
  y: number;
  group?: string | number;
  end?: Date;
  label?: PointLabel;
}

/** A group in the shape vis Graph2d consumes. */
export interface VisGroup {
  id: string | number;
  content: string;
  className?: string;
  style?: string;
  options?: Record<string, unknown>;
  visible?: boolean;
}

export interface NormalizedChart {
  items: VisPoint[];
  groups: VisGroup[];
  visOptions: Record<string, unknown>;
  scale: XScale;
  /** Explicit container height from block options, if the author set one. */
  height?: string;
}

/** Minimal vault surface data-source.ts needs, so it stays unit-testable. */
export interface DataReader {
  /** Returns the file's text, or null when it does not exist. */
  read(path: string): Promise<string | null>;
}
