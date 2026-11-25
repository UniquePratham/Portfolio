/**
 * Ambient declarations for packages that ship no types.
 *
 * Each of these is a small, stable API surface, so a hand-written declaration is
 * cheaper and more accurate than `any` at every call site. Only the members this
 * project actually uses are declared — a fuller declaration would be a
 * maintenance burden for no benefit.
 */

declare module 'atrament' {
  export interface AtramentOptions {
    width?: number;
    height?: number;
    color?: string;
    weight?: number;
    smoothing?: number;
    adaptiveStroke?: boolean;
    mode?: 'draw' | 'erase' | 'fill';
    fill?: string;
  }

  export default class Atrament {
    constructor(canvas: HTMLCanvasElement | string, options?: AtramentOptions);
    canvas: HTMLCanvasElement;
    weight: number;
    color: string;
    mode: 'draw' | 'erase' | 'fill';
    clear(): void;
    destroy(): void;
    toImage(): string;
  }
}

declare module 'uplot' {
  export interface Options {
    width: number;
    height: number;
    padding?: number[];
    cursor?: Record<string, unknown>;
    legend?: Record<string, unknown>;
    scales?: Record<string, unknown>;
    axes?: Array<Record<string, unknown>>;
    series: Array<Record<string, unknown>>;
  }

  export default class uPlot {
    constructor(opts: Options, data: Array<number[] | null>, target: HTMLElement);
    setSize(size: { width: number; height: number }): void;
    destroy(): void;
  }
}

declare module 'uplot/dist/uPlot.min.css';

declare module 'driver.js/dist/driver.css';

declare module 'driver.js' {
  export interface DriveStep {
    element?: string | Element;
    popover?: {
      title?: string;
      description?: string;
      side?: string;
      align?: string;
    };
  }

  export interface DriverConfig {
    showProgress?: boolean;
    progressText?: string;
    animate?: boolean;
    allowClose?: boolean;
    overlayColor?: string;
    stagePadding?: number;
    stageRadius?: number;
    popoverClass?: string;
    nextBtnText?: string;
    prevBtnText?: string;
    doneBtnText?: string;
    steps: DriveStep[];
  }

  export interface DriverInstance {
    drive(): void;
    destroy(): void;
  }

  export function driver(config?: DriverConfig): DriverInstance;
}
