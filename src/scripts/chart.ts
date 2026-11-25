/**
 * A measured-results chart, built with D3.
 *
 * The point of this section is that the numbers are real: each bar is a figure
 * the project actually reported, and the chart exists to make the comparison
 * legible rather than to decorate the page. D3 is used for its scales and
 * transitions only — the DOM is plain SVG, so the chart is accessible and
 * selectable, and there is no framework to fight.
 *
 * Only the four D3 submodules this chart needs are imported. The full `d3`
 * bundle is 283 kB for a linear scale and a handful of rects; `d3-scale`,
 * `d3-selection`, `d3-array` and `d3-transition` together are a fraction of that.
 *
 * The chart is imported dynamically on approach, like the physics engine: this
 * section is far down the page and nothing above it needs a charting library.
 */
import type { ScaleLinear } from 'd3-scale';

export interface ChartDatum {
  label: string;
  /** The measured value. */
  value: number;
  /** The baseline it is compared against, if any. */
  baseline?: number;
  /** Unit suffix for the readout. */
  unit: string;
}

export interface ChartOptions {
  root: HTMLElement;
  svg: SVGSVGElement;
  data: ChartDatum[];
  reducedMotion: boolean;
}

export interface ChartHandle {
  destroy: () => void;
}

const ACCENT = '#c4df73';
const MUTED = 'rgba(241, 240, 232, 0.22)';
const TEXT = '#f1f0e8';
const FAINT = '#7d8a80';

export function initChart({ root, svg, data, reducedMotion }: ChartOptions): ChartHandle {
  let destroyed = false;
  let handle: ChartHandle | null = null;

  const loader = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        loader.disconnect();
        void Promise.all([
          import('d3-scale'),
          import('d3-selection'),
          // Imported for its side effect: it patches `.transition()` onto the
          // selection prototype. Without it the call is undefined at runtime.
          import('d3-transition'),
          import('d3-ease'),
        ]).then(([scale, selection, , ease]) => {
          if (destroyed) return;
          handle = mount({ scale, selection, ease }, svg, data, reducedMotion);
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

interface Modules {
  scale: typeof import('d3-scale');
  selection: typeof import('d3-selection');
  ease: typeof import('d3-ease');
}

function mount(
  { scale, selection, ease }: Modules,
  svg: SVGSVGElement,
  data: ChartDatum[],
  reducedMotion: boolean,
): ChartHandle {
  let destroyed = false;
  let observer: ResizeObserver | null = null;

  function draw(): void {
    if (destroyed) return;

    const rect = svg.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(220, rect.height);

    const margin = { top: 34, right: 16, bottom: 46, left: 16 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const sel = selection.select(svg);
    sel.selectAll('*').remove();
    sel.attr('viewBox', `0 0 ${width} ${height}`);

    const g = sel.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Small multiples, one panel per metric, each with its OWN y-scale.
    //
    // A shared axis is wrong here: the metrics are in different units (seconds
    // and minutes) and differ by an order of magnitude, so a common scale makes
    // the smaller one invisible. Each panel is scaled to its own baseline, which
    // is what makes the comparison within a panel readable.
    const panelW = innerW / data.length;
    const barW = Math.min(52, panelW * 0.22);

    data.forEach((d, i) => {
      const x0 = panelW * i;
      const cx = x0 + panelW / 2;

      const max = Math.max(d.value, d.baseline ?? d.value) * 1.18;
      const y: ScaleLinear<number, number> = scale
        .scaleLinear()
        .domain([0, max])
        .range([innerH, 0]);

      // Panel baseline rule.
      g.append('line')
        .attr('x1', x0 + 8)
        .attr('x2', x0 + panelW - 8)
        .attr('y1', innerH)
        .attr('y2', innerH)
        .attr('stroke', MUTED);

      // Baseline bar (the thing being beaten), muted.
      if (d.baseline !== undefined) {
        g.append('rect')
          .attr('x', cx - barW - 4)
          .attr('y', y(d.baseline))
          .attr('width', barW)
          .attr('height', innerH - y(d.baseline))
          .attr('fill', MUTED);

        g.append('text')
          .attr('x', cx - barW / 2 - 4)
          .attr('y', y(d.baseline) - 7)
          .attr('text-anchor', 'middle')
          .attr('fill', FAINT)
          .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
          .attr('font-size', 11)
          .text(`${d.baseline}${d.unit}`);
      }

      // Measured bar, in the accent.
      const bar = g
        .append('rect')
        .attr('x', d.baseline !== undefined ? cx + 4 : cx - barW / 2)
        .attr('width', barW)
        .attr('fill', ACCENT)
        .attr('y', innerH)
        .attr('height', 0);

      const targetY = y(d.value);
      const targetH = innerH - targetY;

      if (reducedMotion) {
        bar.attr('y', targetY).attr('height', targetH);
      } else {
        bar
          .transition()
          .duration(700)
          .delay(i * 120)
          .ease(ease.easeCubicOut)
          .attr('y', targetY)
          .attr('height', targetH);
      }

      // Value readout above the measured bar.
      g.append('text')
        .attr('x', d.baseline !== undefined ? cx + barW / 2 + 4 : cx)
        .attr('y', targetY - 7)
        .attr('text-anchor', 'middle')
        .attr('fill', TEXT)
        .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
        .attr('font-size', 12)
        .text(`${d.value}${d.unit}`);

      // Metric label under the panel.
      g.append('text')
        .attr('x', cx)
        .attr('y', innerH + 20)
        .attr('text-anchor', 'middle')
        .attr('fill', FAINT)
        .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
        .attr('font-size', 10)
        .attr('letter-spacing', '0.08em')
        .text(d.label.toUpperCase());

      // The improvement, stated rather than left to the reader to compute.
      if (d.baseline !== undefined) {
        const pct = Math.round((1 - d.value / d.baseline) * 100);
        g.append('text')
          .attr('x', cx)
          .attr('y', innerH + 34)
          .attr('text-anchor', 'middle')
          .attr('fill', ACCENT)
          .attr('font-family', '"IBM Plex Mono", ui-monospace, monospace')
          .attr('font-size', 9)
          .text(`${pct}% lower`);
      }
    });
  }

  draw();

  observer = new ResizeObserver(() => draw());
  observer.observe(svg);

  return {
    destroy: () => {
      destroyed = true;
      observer?.disconnect();
      selection.select(svg).selectAll('*').remove();
    },
  };
}
