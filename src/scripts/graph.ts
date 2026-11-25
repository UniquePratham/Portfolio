/**
 * A force-directed graph of projects and the technologies they use.
 *
 * This is the one visualisation on the site that shows *structure* rather than
 * a list: which projects share a stack, and which technologies are load-bearing
 * across the work. Hovering a project lights its technologies; hovering a
 * technology lights every project that uses it.
 *
 * `d3-force` is 8 kB and does the layout; the rendering is plain SVG so the
 * nodes are focusable, selectable and readable by a screen reader. The graph is
 * imported dynamically on approach, like the other heavy modules.
 */
import type { Simulation, SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

export interface GraphProject {
  slug: string;
  title: string;
  stack: string[];
}

export interface GraphOptions {
  root: HTMLElement;
  svg: SVGSVGElement;
  projects: GraphProject[];
  reducedMotion: boolean;
}

export interface GraphHandle {
  destroy: () => void;
}

interface Node extends SimulationNodeDatum {
  id: string;
  kind: 'project' | 'tech';
  label: string;
  /** How many projects use this technology. Drives the radius. */
  weight: number;
}

type Link = SimulationLinkDatum<Node>;

const ACCENT = '#c4df73';
const PROJECT_FILL = '#c4df73';
const TECH_FILL = '#182720';
const TECH_STROKE = 'rgba(196, 223, 115, 0.5)';
const TEXT = '#f1f0e8';
const FAINT = '#7d8a80';

export function initGraph({ root, svg, projects, reducedMotion }: GraphOptions): GraphHandle {
  let destroyed = false;
  let handle: GraphHandle | null = null;

  const loader = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        loader.disconnect();
        void import('d3-force').then((mod) => {
          if (destroyed) return;
          handle = mount(mod, svg, projects, reducedMotion);
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
  d3: typeof import('d3-force'),
  svg: SVGSVGElement,
  projects: GraphProject[],
  reducedMotion: boolean,
): GraphHandle {
  let destroyed = false;
  let sim: Simulation<Node, Link> | null = null;
  let observer: ResizeObserver | null = null;

  // --- Build the graph ----------------------------------------------------
  const techCount = new Map<string, number>();
  for (const p of projects) {
    for (const t of p.stack) techCount.set(t, (techCount.get(t) ?? 0) + 1);
  }

  const nodes: Node[] = [
    ...projects.map((p) => ({
      id: `p:${p.slug}`,
      kind: 'project' as const,
      label: p.title,
      weight: 1,
    })),
    ...[...techCount.entries()].map(([name, count]) => ({
      id: `t:${name}`,
      kind: 'tech' as const,
      label: name,
      weight: count,
    })),
  ];

  const links: Link[] = [];
  for (const p of projects) {
    for (const t of p.stack) {
      links.push({ source: `p:${p.slug}`, target: `t:${t}` });
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  // Kept for debugging: lets a console session inspect a node by id.
  void byId;

  // Adjacency, so hover can light up neighbours without scanning every link.
  const neighbours = new Map<string, Set<string>>();
  for (const l of links) {
    const s = l.source as string;
    const t = l.target as string;
    if (!neighbours.has(s)) neighbours.set(s, new Set());
    if (!neighbours.has(t)) neighbours.set(t, new Set());
    neighbours.get(s)!.add(t);
    neighbours.get(t)!.add(s);
  }

  function draw(): void {
    if (destroyed) return;

    const rect = svg.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const height = Math.max(320, rect.height);

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const NS = 'http://www.w3.org/2000/svg';
    const el = <K extends keyof SVGElementTagNameMap>(
      tag: K,
      attrs: Record<string, string | number>,
    ): SVGElementTagNameMap[K] => {
      const node = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
      return node;
    };

    const linkLayer = el('g', {});
    const nodeLayer = el('g', {});
    svg.append(linkLayer, nodeLayer);

    const linkEls = links.map(() => {
      const line = el('line', { stroke: 'rgba(241,240,232,0.14)', 'stroke-width': 1 });
      linkLayer.append(line);
      return line;
    });

    const nodeEls = nodes.map((n) => {
      const g = el('g', { tabindex: 0, role: 'listitem' });
      g.setAttribute('aria-label', `${n.kind === 'project' ? 'Project' : 'Technology'} ${n.label}`);

      const r = n.kind === 'project' ? 7 : 4 + Math.min(6, n.weight * 1.6);
      const circle = el('circle', {
        r,
        fill: n.kind === 'project' ? PROJECT_FILL : TECH_FILL,
        stroke: n.kind === 'project' ? PROJECT_FILL : TECH_STROKE,
        'stroke-width': 1.2,
      });
      g.append(circle);

      const text = el('text', {
        'font-family': '"IBM Plex Mono", ui-monospace, monospace',
        'font-size': n.kind === 'project' ? 10 : 9,
        fill: n.kind === 'project' ? TEXT : FAINT,
        'text-anchor': 'middle',
        dy: r + 11,
      });
      text.textContent = n.label;
      g.append(text);

      nodeLayer.append(g);
      return { g, circle, text, node: n };
    });

    // --- Interaction ------------------------------------------------------
    function highlight(id: string | null): void {
      const lit = id ? new Set([id, ...(neighbours.get(id) ?? [])]) : null;

      for (const { g, circle, text, node } of nodeEls) {
        const on = !lit || lit.has(node.id);
        g.setAttribute('opacity', on ? '1' : '0.18');
        circle.setAttribute('fill', node.kind === 'project' ? PROJECT_FILL : TECH_FILL);
        text.setAttribute('fill', node.kind === 'project' ? TEXT : FAINT);
        if (lit && lit.has(node.id) && node.id !== id) {
          circle.setAttribute('fill', node.kind === 'project' ? PROJECT_FILL : '#23372d');
          text.setAttribute('fill', TEXT);
        }
      }

      linkEls.forEach((line, i) => {
        const s = links[i]!.source as unknown as Node;
        const t = links[i]!.target as unknown as Node;
        const on = !lit || (lit.has(s.id) && lit.has(t.id));
        line.setAttribute('stroke', on && lit ? ACCENT : 'rgba(241,240,232,0.14)');
        line.setAttribute('stroke-opacity', on ? '1' : '0.12');
      });
    }

    for (const { g, node } of nodeEls) {
      g.addEventListener('pointerenter', () => highlight(node.id));
      g.addEventListener('pointerleave', () => highlight(null));
      g.addEventListener('focus', () => highlight(node.id));
      g.addEventListener('blur', () => highlight(null));
    }

    // --- Simulation -------------------------------------------------------
    sim?.stop();

    sim = d3
      .forceSimulation<Node>(nodes)
      .force(
        'link',
        d3
          .forceLink<Node, Link>(links)
          .id((d) => d.id)
          .distance(58)
          .strength(0.7),
      )
      .force('charge', d3.forceManyBody<Node>().strength(-190))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<Node>().radius((d) => (d.kind === 'project' ? 26 : 20)))
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.06));

    function paint(): void {
      linkEls.forEach((line, i) => {
        const s = links[i]!.source as unknown as Node;
        const t = links[i]!.target as unknown as Node;
        line.setAttribute('x1', String(s.x ?? 0));
        line.setAttribute('y1', String(s.y ?? 0));
        line.setAttribute('x2', String(t.x ?? 0));
        line.setAttribute('y2', String(t.y ?? 0));
      });
      for (const { g, node } of nodeEls) {
        g.setAttribute('transform', `translate(${node.x ?? 0},${node.y ?? 0})`);
      }
    }

    if (reducedMotion) {
      // Settle synchronously, then paint once. No animation, but the layout is
      // still the real force-directed result rather than a hand-placed grid.
      sim.stop();
      for (let i = 0; i < 300; i += 1) sim.tick();
      paint();
    } else {
      sim.on('tick', paint);
      paint();
    }
  }

  draw();

  observer = new ResizeObserver(() => draw());
  observer.observe(svg);

  return {
    destroy: () => {
      destroyed = true;
      observer?.disconnect();
      sim?.stop();
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    },
  };
}
