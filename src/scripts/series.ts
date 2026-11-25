/**
 * A time-series chart of a day of bus travel times, with uPlot.
 *
 * uPlot is 142 kB but it is the only charting library here that stays smooth at
 * tens of thousands of points. The Measured section already has a D3 bar chart
 * for the summary; this adds the underlying signal — how segment travel time
 * varies across a day, which is the thing the model actually predicts.
 *
 * The data is synthetic but shaped from the published error figures: a morning
 * and evening peak, a flat midday, and noise proportional to the timetable's own
 * error. It is labelled as illustrative in the caption, because presenting
 * generated data as measured would be dishonest.
 */
export interface SeriesOptions {
  root: HTMLElement;
  container: HTMLElement;
  reducedMotion: boolean;
}

export interface SeriesHandle {
  destroy: () => void;
}

/** Minutes past midnight, sampled every 5 minutes. */
const SAMPLES = 288;

/**
 * Build a plausible day of segment travel times.
 *
 * Deterministic: a fixed seed means the chart looks the same on every load, so
 * it cannot be mistaken for live data that happens to be quiet.
 */
function buildSeries(): { times: number[]; model: number[]; timetable: number[] } {
  const times: number[] = [];
  const model: number[] = [];
  const timetable: number[] = [];

  // A small deterministic PRNG, so the shape is stable across reloads.
  let seed = 20261125;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < SAMPLES; i += 1) {
    const minutes = i * 5;
    times.push(minutes * 60);

    const hour = minutes / 60;
    // Two peaks: ~09:00 and ~18:30.
    const morning = Math.exp(-((hour - 9) ** 2) / 2.2);
    const evening = Math.exp(-((hour - 18.5) ** 2) / 3.0);
    const base = 18 + morning * 16 + evening * 20;

    // The timetable is the baseline: it misses the peaks, which is exactly the
    // failure the model was built to fix.
    const flat = 41.6 + Math.sin(hour / 3) * 2.5;
    timetable.push(Math.max(8, flat + (rand() - 0.5) * 3));

    model.push(Math.max(8, base + (rand() - 0.5) * 4));
  }

  return { times, model, timetable };
}

export function initSeries({ root, container, reducedMotion }: SeriesOptions): SeriesHandle {
  let destroyed = false;
  let handle: SeriesHandle | null = null;

  const loader = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        loader.disconnect();
        void Promise.all([import('uplot'), import('uplot/dist/uPlot.min.css')]).then(([mod]) => {
          if (destroyed) return;
          handle = mount(mod.default, container, reducedMotion);
        });      }
    },
    { rootMargin: '100% 0px' },
  );
  loader.observe(root);

  return {
    destroy: () => {
      destroyed = true;
      loader.disconnect();
      handle?.destroy();
    },
  };
}

function mount(
  uPlot: typeof import('uplot').default,
  container: HTMLElement,
  reducedMotion: boolean,
): SeriesHandle {
  let destroyed = false;
  const { times, model, timetable } = buildSeries();

  const width = Math.max(320, container.getBoundingClientRect().width);
  const height = 260;

  const opts: import('uplot').Options = {
    width,
    height,
    padding: [16, 12, 0, 0],
    cursor: { show: true, points: { size: 5 } },
    legend: { show: true, live: true },
    scales: {
      x: { time: false },
      y: { range: (_u: unknown, _min: number, max: number) => [0, Math.ceil(max * 1.1)] },
    },
    axes: [
      {
        stroke: '#7d8a80',
        font: '10px "IBM Plex Mono", monospace',
        grid: { stroke: 'rgba(241,240,232,0.06)' },
        ticks: { stroke: 'rgba(241,240,232,0.12)' },
        values: (_u: unknown, vals: number[]) =>
          vals.map((v) => `${String(Math.floor(v / 3600)).padStart(2, '0')}:00`),
      },
      {
        stroke: '#7d8a80',
        font: '10px "IBM Plex Mono", monospace',
        grid: { stroke: 'rgba(241,240,232,0.06)' },
        ticks: { stroke: 'rgba(241,240,232,0.12)' },
        values: (_u: unknown, vals: number[]) => vals.map((v) => `${v}s`),
      },
    ],
    series: [
      {},
      {
        label: 'Model',
        stroke: '#c4df73',
        width: 1.6,
        fill: 'rgba(196, 223, 115, 0.10)',
      },
      {
        label: 'Timetable',
        stroke: 'rgba(241, 240, 232, 0.34)',
        width: 1.2,
        dash: [4, 4],
      },
    ],
  };

  const plot = new uPlot(opts, [times, model, timetable], container);

  // uPlot needs an explicit resize; it does not observe its container.
  const observer = new ResizeObserver(() => {
    const w = container.getBoundingClientRect().width;
    if (w > 0) plot.setSize({ width: Math.max(320, w), height });
  });
  observer.observe(container);

  if (reducedMotion) {
    // uPlot draws synchronously, so there is nothing to disable — the chart is
    // simply static, which is what reduced motion asks for.
  }

  return {
    destroy: () => {
      destroyed = true;
      observer.disconnect();
      if (destroyed) plot.destroy();
    },
  };
}
