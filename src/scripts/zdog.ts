/**
 * A pseudo-3D object, drawn with Zdog.
 *
 * Zdog renders flat-shaded 3D shapes into a canvas — no WebGL, no shaders, no
 * 600 kB engine. That flatness is the point: it matches the site's editorial,
 * two-tone palette in a way a photoreal 3D scene never would.
 *
 * The object is a slowly rotating wireframe globe, echoing the carousel's globe
 * and the atlas contours. It is decorative, so it is `aria-hidden` and stops
 * entirely under reduced motion.
 */
export interface ZdogOptions {
  canvas: HTMLCanvasElement;
  reducedMotion: boolean;
}

export interface ZdogHandle {
  destroy: () => void;
}

export function initZdog({ canvas, reducedMotion }: ZdogOptions): ZdogHandle {
  let destroyed = false;
  let handle: ZdogHandle | null = null;

  const loader = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        loader.disconnect();
        void import('zdog').then((mod) => {
          if (destroyed) return;
          // `@types/zdog` declares a namespace, not a default export, so the
          // runtime default is reached through the module object.
          const Zdog = (mod as unknown as { default: typeof import('zdog') }).default;
          handle = mount(Zdog, canvas, reducedMotion);
        });      }
    },
    { rootMargin: '100% 0px' },
  );
  loader.observe(canvas);

  return {
    destroy: () => {
      destroyed = true;
      loader.disconnect();
      handle?.destroy();
    },
  };
}

function mount(
  Zdog: typeof import('zdog'),
  canvas: HTMLCanvasElement,
  reducedMotion: boolean,
): ZdogHandle {
  let destroyed = false;
  let raf = 0;

  const rect = canvas.getBoundingClientRect();
  const size = Math.max(160, Math.min(rect.width, rect.height || rect.width));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);

  const illo = new Zdog.Illustration({
    element: canvas,
    zoom: size / 260,
    resize: false,
  });

  const ACCENT = '#c4df73';
  const DIM = 'rgba(196, 223, 115, 0.28)';

  // A sphere approximated by latitude rings plus a few meridians. Zdog has no
  // sphere primitive, and rings read as a wireframe globe rather than a solid.
  const globe = new Zdog.Anchor({ addTo: illo });

  const R = 60;
  const LAT = 5;
  for (let i = 1; i < LAT; i += 1) {
    const phi = (i / LAT) * Math.PI;
    const r = Math.sin(phi) * R;
    const y = Math.cos(phi) * R;
    new Zdog.Ellipse({
      addTo: globe,
      diameter: r * 2,
      rotate: { x: Math.PI / 2 },
      translate: { y },
      stroke: 1.2,
      color: DIM,
      closed: true,
    });
  }

  const MERIDIANS = 6;
  for (let i = 0; i < MERIDIANS; i += 1) {
    new Zdog.Ellipse({
      addTo: globe,
      diameter: R * 2,
      rotate: { y: (i / MERIDIANS) * Math.PI },
      stroke: 1.2,
      color: i === 0 ? ACCENT : DIM,
      closed: true,
    });
  }

  // A single accent node on the surface, so the object has a focal point.
  new Zdog.Shape({
    addTo: globe,
    translate: { x: R * 0.62, y: -R * 0.42, z: R * 0.62 },
    stroke: 5,
    color: ACCENT,
  });

  illo.updateRenderGraph();

  if (reducedMotion) {
    return {
      destroy: () => {
        destroyed = true;
        cancelAnimationFrame(raf);
      },
    };
  }

  function frame(): void {
    if (destroyed) return;
    globe.rotate.y += 0.006;
    globe.rotate.x = Math.sin(performance.now() / 4200) * 0.18;
    illo.updateRenderGraph();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
    },
  };
}
