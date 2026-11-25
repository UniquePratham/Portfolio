/**
 * A physics playground, built on Matter.js.
 *
 * The stack of skills is a real rigid-body simulation: each tag is a body with
 * mass, the walls and floor are static, and the whole thing responds to the
 * pointer. It is not a decorative animation — you can throw the pieces around,
 * and they settle.
 *
 * Why Matter.js rather than a hand-rolled integrator: collision resolution
 * between rotated rectangles is the hard part, and getting it subtly wrong
 * produces bodies that sink into each other or jitter forever. The library is
 * ~90 kB minified and does that one job properly.
 *
 * Matter.js is imported dynamically, only once the section is near the viewport.
 * It is the single largest dependency on the site and it sits eight sections
 * down, so making the first paint wait for it would be a real cost for no
 * benefit.
 *
 * The simulation is paused whenever the section is off screen, and never starts
 * at all under `prefers-reduced-motion` — in that case the tags are settled once
 * and drawn statically, which is what they are.
 */
import type MatterNS from 'matter-js';

export interface PlaygroundOptions {
  /** The element the canvas fills. Its size drives the world bounds. */
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  /** Labels to drop in as bodies. */
  labels: string[];
  reducedMotion: boolean;
}

export interface PlaygroundHandle {
  destroy: () => void;
}

/** Palette pulled from the design tokens, so the bodies match the page. */
const BODY_FILL = '#182720';
const BODY_STROKE = 'rgba(196, 223, 115, 0.55)';
const BODY_TEXT = '#c4df73';
const ACCENT_FILL = '#c4df73';
const ACCENT_TEXT = '#101a16';

export function initPlayground({
  root,
  canvas,
  labels,
  reducedMotion,
}: PlaygroundOptions): PlaygroundHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy: () => {} };

  let destroyed = false;
  let handle: PlaygroundHandle | null = null;

  // Load the engine when the section is within a screen of the viewport, then
  // hand off to the real implementation.
  const loader = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        loader.disconnect();
        void import('matter-js').then((mod) => {
          if (destroyed) return;
          handle = mount(mod.default, ctx, { root, canvas, labels, reducedMotion });
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
  Matter: typeof MatterNS,
  ctx: CanvasRenderingContext2D,
  { root, canvas, labels, reducedMotion }: PlaygroundOptions,
): PlaygroundHandle {
  const { Engine, Bodies, Composite, Query, Sleeping } = Matter;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let destroyed = false;
  let running = false;

  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = 1;

  const world = engine.world;

  /** Bodies carry their label and a measured size so the renderer can draw them. */
  interface TagBody extends MatterNS.Body {
    tagLabel?: string;
    tagW?: number;
    tagH?: number;
    tagAccent?: boolean;
  }

  const tags: TagBody[] = [];

  /**
   * Tag type size, scaled to the arena.
   *
   * Sized so the whole stack settles into roughly three readable rows. Smaller
   * than this and the labels are illegible; larger and the pile overflows the
   * box before it settles.
   */
  function fontSizeFor(): number {
    return Math.max(12, Math.min(18, width / 62));
  }

  function measure(label: string): { w: number; h: number } {
    const fontSize = fontSizeFor();
    ctx.font = `500 ${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
    const textW = ctx.measureText(label).width;
    return { w: Math.ceil(textW + fontSize * 2.1), h: Math.ceil(fontSize * 2.6) };
  }

  function build(): void {
    Composite.clear(world, false, true);

    const wall = { isStatic: true, friction: 0.4, restitution: 0.1 };

    const floor = Bodies.rectangle(width / 2, height + 30, width * 2, 60, wall);
    const left = Bodies.rectangle(-30, height / 2, 60, height * 2, wall);
    const right = Bodies.rectangle(width + 30, height / 2, 60, height * 2, wall);
    Composite.add(world, [floor, left, right]);

    tags.length = 0;

    // Lay the tags out in a loose grid above the floor, then let gravity do the
    // rest. Spawning them at their final resting place would look static.
    const cols = Math.max(2, Math.floor(width / 150));
    labels.forEach((label, i) => {
      const { w, h } = measure(label);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = ((col + 0.5) / cols) * width + (Math.random() - 0.5) * 18;
      const y = -h - row * (h + 14) - 40;

      const body = Bodies.rectangle(x, y, w, h, {
        chamfer: { radius: 3 },
        friction: 0.35,
        frictionAir: 0.02,
        restitution: 0.18,
        density: 0.0012,
        angle: (Math.random() - 0.5) * 0.5,
      }) as TagBody;

      body.tagLabel = label;
      body.tagW = w;
      body.tagH = h;
      body.tagAccent = i === 0;
      tags.push(body);
      Composite.add(world, body);
    });
  }

  function resize(): boolean {
    const rect = root.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;

    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (rect.width === width && rect.height === height && nextDpr === dpr) return true;

    width = rect.width;
    height = rect.height;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    return true;
  }

  function render(): void {
    ctx.clearRect(0, 0, width, height);

    // Publish the body positions so a test can target a real tag instead of
    // guessing at a pixel. Re-deriving the layout in the test is how a drag
    // check silently misses and reports a false pass.
    canvas.dataset.bodies = tags
      .map((b) => `${b.tagLabel}@${Math.round(b.position.x)},${Math.round(b.position.y)}`)
      .join('|');

    for (const body of tags) {
      const { position, angle } = body;
      const w = body.tagW ?? 0;
      const h = body.tagH ?? 0;

      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 3);
      ctx.fillStyle = body.tagAccent ? ACCENT_FILL : BODY_FILL;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = body.tagAccent ? ACCENT_FILL : BODY_STROKE;
      ctx.stroke();

      const fontSize = fontSizeFor();
      ctx.font = `500 ${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = body.tagAccent ? ACCENT_TEXT : BODY_TEXT;
      ctx.fillText(body.tagLabel ?? '', 0, 0.5);

      ctx.restore();
    }
  }

  function tick(): void {
    if (destroyed) return;
    Engine.update(engine, 1000 / 60);
    render();
    raf = requestAnimationFrame(tick);
  }

  function start(): void {
    if (running || destroyed) return;
    running = true;
    raf = requestAnimationFrame(tick);
  }

  function stop(): void {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // --- Pointer ------------------------------------------------------------
  // Dragging is handled with native pointer events rather than Matter's `Mouse`.
  // `Mouse` derives its position from `offsetX`/`offsetY` and a `pixelRatio`
  // attribute, which is a second coordinate space to keep in sync with the DPR
  // transform. Doing the mapping here means there is exactly one conversion:
  // client px -> canvas-local CSS px, which is the space the world lives in.
  let dragConstraint: MatterNS.Constraint | null = null;

  function localPoint(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event: PointerEvent): void {
    start();
    const p = localPoint(event);

    // Topmost body under the cursor. `Query.point` returns them in world order,
    // so the last match is the one drawn on top.
    const hits = Query.point(tags, p) as TagBody[];
    const body = hits[hits.length - 1];
    if (!body) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    // Wake it: a sleeping body ignores the constraint until it is woken.
    Sleeping.set(body, false);

    dragConstraint = Matter.Constraint.create({
      pointA: p,
      bodyB: body,
      pointB: { x: p.x - body.position.x, y: p.y - body.position.y },
      stiffness: 0.14,
      damping: 0.18,
      length: 0,
    });
    Composite.add(world, dragConstraint);
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragConstraint) return;
    dragConstraint.pointA = localPoint(event);
  }

  function onPointerUp(event: PointerEvent): void {
    if (dragConstraint) {
      Composite.remove(world, dragConstraint);
      dragConstraint = null;
    }
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  // --- Lifecycle ----------------------------------------------------------

  if (reducedMotion) {
    // No simulation. Settle the stack once, then draw it — the tags are content,
    // so they must be visible even when motion is off. Without the settle loop
    // the bodies are still above the floor and the canvas renders empty.
    resize();
    for (let i = 0; i < 120; i += 1) Engine.update(engine, 1000 / 60);
    render();
    return {
      destroy: () => {
        destroyed = true;
        Composite.clear(world, false, true);
        Engine.clear(engine);
      },
    };
  }

  resize();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) start();
        else stop();
      }
    },
    { threshold: 0.05 },
  );
  observer.observe(root);

  const onResize = () => {
    if (resize()) render();
  };
  window.addEventListener('resize', onResize);

  // Settle the stack before the first paint so the section never appears empty.
  for (let i = 0; i < 90; i += 1) Engine.update(engine, 1000 / 60);
  render();

  return {
    destroy: () => {
      destroyed = true;
      stop();
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      Composite.clear(world, false, true);
      Engine.clear(engine);
    },
  };
}
