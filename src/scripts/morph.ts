/**
 * SVG shape morphing, with flubber.
 *
 * The atlas is a contour map. This module morphs the contour silhouette between
 * two states as the section scrolls, so the map appears to redraw itself rather
 * than sit still. flubber interpolates between two paths with the same winding,
 * which is the hard part of shape morphing done properly.
 *
 * The two shapes are generated here rather than shipped as assets: a closed
 * blob built from a sum of sines, and a second with different phases. That keeps
 * the payload at the library's 52 kB and nothing else.
 */
export interface MorphOptions {
  root: HTMLElement;
  path: SVGPathElement;
  reducedMotion: boolean;
}

export interface MorphHandle {
  destroy: () => void;
}

/** Build a closed blob path from a sum of sines, in a 1000x640 box. */
function blob(phase: number, radius: number, lobes: number): string {
  const cx = 500;
  const cy = 320;
  const steps = 180;
  const pts: string[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const r =
      radius +
      Math.sin(t * lobes + phase) * radius * 0.16 +
      Math.sin(t * (lobes + 2) - phase * 1.7) * radius * 0.09;
    const x = cx + Math.cos(t) * r * 1.35;
    const y = cy + Math.sin(t) * r;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return `${pts.join('')}Z`;
}

export function initMorph({ root, path, reducedMotion }: MorphOptions): MorphHandle {
  let destroyed = false;
  let handle: MorphHandle | null = null;

  const loader = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        loader.disconnect();
        void import('flubber').then((mod) => {
          if (destroyed) return;
          handle = mount(mod, path, reducedMotion);
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
  flubber: typeof import('flubber'),
  path: SVGPathElement,
  reducedMotion: boolean,
): MorphHandle {
  let destroyed = false;
  let raf = 0;

  const from = blob(0, 150, 5);
  const to = blob(Math.PI, 150, 7);

  path.setAttribute('d', from);

  if (reducedMotion) {
    path.setAttribute('d', to);
    return {
      destroy: () => {
        destroyed = true;
        cancelAnimationFrame(raf);
      },
    };
  }

  const interpolate = flubber.interpolate(from, to, { maxSegmentLength: 4 });

  // Drive the morph from scroll position within the section, so the shape is a
  // function of where the reader is rather than a loop they cannot control.
  const section = path.closest('section') ?? path.ownerSVGElement;

  function update(): void {
    if (destroyed || !section) return;

    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 when the section enters from the bottom, 1 when it leaves the top.
    const progress = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));

    path.setAttribute('d', interpolate(progress));
  }

  const onScroll = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  update();

  return {
    destroy: () => {
      destroyed = true;
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    },
  };
}
