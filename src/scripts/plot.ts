/**
 * A dot plot of project years and disciplines, with Observable Plot.
 *
 * Observable Plot is a grammar-of-graphics layer: you describe the marks and it
 * builds the SVG. It is 488 kB, which is why it is loaded only when this section
 * approaches, and why it is used for the one chart where its defaults genuinely
 * save work — a categorical dot plot with jitter, colour by discipline and
 * automatic legends.
 *
 * The D3 chart in Measured is hand-built because it needed exact control. This
 * one is the opposite case: a standard chart where writing the marks by hand
 * would be more code for a worse result.
 */
export interface PlotOptions {
  root: HTMLElement;
  container: HTMLElement;
  data: Array<{ title: string; year: string; discipline: string }>;
  reducedMotion: boolean;
}

export interface PlotHandle {
  destroy: () => void;
}

const DISCIPLINE_COLOR: Record<string, string> = {
  systems: '#c4df73',
  ai: '#8fb8d8',
  product: '#bc8063',
  tools: '#c4bfae',
  security: '#9cb457',
};

export function initPlot({ root, container, data, reducedMotion }: PlotOptions): PlotHandle {
  let destroyed = false;
  let handle: PlotHandle | null = null;

  const loader = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        loader.disconnect();
        void import('@observablehq/plot').then((mod) => {
          if (destroyed) return;
          handle = mount(mod, container, data, reducedMotion);
        });
      }
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
  Plot: typeof import('@observablehq/plot'),
  container: HTMLElement,
  data: Array<{ title: string; year: string; discipline: string }>,
  reducedMotion: boolean,
): PlotHandle {
  let destroyed = false;

  function render(): void {
    if (destroyed) return;

    const width = Math.max(320, container.getBoundingClientRect().width);

    const chart = Plot.plot({
      width,
      height: 220,
      marginLeft: 70,
      marginBottom: 34,
      style: {
        background: 'transparent',
        color: '#7d8a80',
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
        fontSize: '10px',
      },
      x: {
        label: null,
        // Years are integers. Without an explicit tick format Plot interpolates
        // and labels the axis 2024.2, 2024.4 — which is not a year.
        ticks: 4,
        tickFormat: (d: number) => String(Math.round(d)),
        grid: false,
        domain: [2024, 2027],
      },
      y: {
        label: null,
        domain: ['systems', 'ai', 'product', 'tools', 'security'],
        tickFormat: (d: string) => d.toUpperCase(),
        grid: true,
      },
      color: {
        domain: Object.keys(DISCIPLINE_COLOR),
        range: Object.values(DISCIPLINE_COLOR),
      },
      marks: [
        Plot.gridY({ stroke: 'rgba(241,240,232,0.06)' }),
        Plot.dot(data, {
          x: (d) => Number(d.year),
          y: 'discipline',
          fill: 'discipline',
          r: 6,
          // Jitter vertically so projects in the same year and discipline do not
          // sit on top of each other.
          dy: (Math.random() - 0.5) * 22,
          title: (d) => `${d.title} (${d.year})`,
        }),
        Plot.ruleY([], { stroke: 'rgba(241,240,232,0.12)' }),
      ],
    });

    container.replaceChildren(chart);
  }

  render();

  const observer = new ResizeObserver(() => render());
  observer.observe(container);

  if (reducedMotion) {
    // Plot renders synchronously; nothing to disable.
  }

  return {
    destroy: () => {
      destroyed = true;
      observer.disconnect();
      container.replaceChildren();
    },
  };
}
