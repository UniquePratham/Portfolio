/**
 * Voronoi hover regions for the atlas.
 *
 * The atlas markers are small targets — a 7px circle is hard to hit and leaves
 * most of the map inert. A Voronoi partition makes every pixel of the map belong
 * to its nearest destination, so the whole surface is interactive and the
 * readout can follow the cursor anywhere.
 *
 * `d3-delaunay` is 19 kB and computes the partition; the cells are drawn as SVG
 * paths so they can be styled and hit-tested by the browser.
 */
export interface VoronoiPoint {  id: string;
  label: string;
  x: number;
  y: number;
  hint: string;
}

export interface VoronoiOptions {
  /** The atlas SVG, in its own 1000x640 viewBox. */
  svg: SVGSVGElement;
  points: VoronoiPoint[];
  /** Called with the hovered point, or null when the cursor leaves. */
  onHover: (point: VoronoiPoint | null) => void;
  reducedMotion: boolean;
}

export interface VoronoiHandle {
  destroy: () => void;
}

const VIEW_W = 1000;
const VIEW_H = 640;

export function initVoronoi({
  svg,
  points,
  onHover,
}: VoronoiOptions): VoronoiHandle {
  let destroyed = false;
  let handle: VoronoiHandle | null = null;

  // The atlas is above the fold, so this loads immediately rather than on
  // approach — but it is still a separate chunk.
  void import('d3-delaunay').then((mod) => {
    if (destroyed) return;
    handle = mount(mod, svg, points, onHover);
  });

  return {
    destroy: () => {
      destroyed = true;
      handle?.destroy();
    },
  };
}

function mount(
  { Delaunay }: typeof import('d3-delaunay'),
  svg: SVGSVGElement,
  points: VoronoiPoint[],
  onHover: (point: VoronoiPoint | null) => void,
): VoronoiHandle {
  let destroyed = false;

  const NS = 'http://www.w3.org/2000/svg';

  const delaunay = Delaunay.from(
    points.map((p) => [p.x, p.y] as [number, number]),
  );
  const voronoi = delaunay.voronoi([0, 0, VIEW_W, VIEW_H]);

  // A layer under the markers, so the cells never cover the labels.
  const layer = document.createElementNS(NS, 'g');
  layer.setAttribute('class', 'atlas__voronoi');
  layer.setAttribute('aria-hidden', 'true');
  svg.insertBefore(layer, svg.firstChild);

  const cells: SVGPathElement[] = [];

  points.forEach((point, i) => {
    const d = voronoi.renderCell(i);
    if (!d) return;

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'transparent');
    path.setAttribute('stroke', 'none');
    path.dataset.dest = point.id;

    path.addEventListener('pointerenter', () => {
      path.setAttribute('fill', 'rgba(196, 223, 115, 0.05)');
      onHover(point);
    });
    path.addEventListener('pointerleave', () => {
      path.setAttribute('fill', 'transparent');
      onHover(null);
    });

    layer.append(path);
    cells.push(path);
  });

  return {
    destroy: () => {
      destroyed = true;
      if (destroyed) layer.remove();
    },
  };
}
