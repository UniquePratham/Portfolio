/**
 * Entrance portrait.
 *
 * The portrait is a scroll-scrubbed frame sequence. Two rules make it stable:
 *
 * 1. **The canvas bitmap is a fixed size.** It is set once, from the frame's own
 *    dimensions, and never touched again. Resizing a canvas clears it, and any
 *    resize driven by layout is a source of visible jumps. Instead the canvas is
 *    scaled by CSS (`object-fit: cover`), which the compositor handles without
 *    touching the bitmap.
 *
 * 2. **The drawing is a pure function of the frame index.** No layout reads, no
 *    viewport maths, no DPR. The same index always produces the same pixels, so
 *    the portrait cannot drift or change size while scrolling.
 *
 * The frames are already portrait and bottom-anchored, so `cover` fills the box
 * exactly and the subject's feet stay on the bottom edge at every viewport.
 */

interface EntranceOptions {
  canvas: HTMLCanvasElement;
  section: HTMLElement;
  onReady?: () => void;
}

const TOTAL = 121;
const PRIORITY = 12;

const TIER: 'desktop' | 'mobile' = window.matchMedia('(max-width: 47.99rem)').matches
  ? 'mobile'
  : 'desktop';

function framePath(index: number): string {
  return `/frames/${TIER}/f${String(index).padStart(4, '0')}.webp`;
}

export function initEntrance({ canvas, section, onReady }: EntranceOptions): void {
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;
  const ctx: CanvasRenderingContext2D = context;

  const frames: Array<ImageBitmap | null> = new Array(TOTAL).fill(null);
  const pending = new Map<number, Promise<void>>();

  let current = -1;
  let target = 0;
  let rafId = 0;
  let destroyed = false;
  let ready = false;
  let sized = false;

  /* --- Sizing: once, from the frame, never again ------------------------ */

  function sizeToFrame(bitmap: ImageBitmap): void {
    if (sized) return;
    sized = true;
    // The bitmap is the frame's own resolution. CSS scales it to the box, so
    // the canvas never needs to be resized and can never be cleared mid-scroll.
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    current = -1;
  }

  /* --- Painting -------------------------------------------------------- */

  function nearestBitmap(index: number): ImageBitmap | null {
    const exact = frames[index];
    if (exact) return exact;

    for (let offset = 1; offset < TOTAL; offset += 1) {
      const before = frames[index - offset];
      if (before) return before;
      const after = frames[index + offset];
      if (after) return after;
    }
    return null;
  }

  function paint(index: number, force = false): void {
    if (index === current && !force) return;

    const bitmap = nearestBitmap(index);
    if (!bitmap) return;

    sizeToFrame(bitmap);

    // Draw the frame 1:1. No scaling maths, no viewport reads — the same index
    // always produces identical pixels.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    current = index;
  }

  /* --- Scroll progress ------------------------------------------------- */

  function progress(): number {
    const rect = section.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return 0;
    return Math.min(1, Math.max(0, -rect.top / scrollable));
  }

  function tick(): void {
    if (destroyed) return;
    const p = progress();
    target = Math.round(p * (TOTAL - 1));
    paint(target);
    rafId = requestAnimationFrame(tick);
  }

  /* --- Loading --------------------------------------------------------- */

  function load(index: number): Promise<void> {
    if (destroyed || frames[index]) return Promise.resolve();

    const existing = pending.get(index);
    if (existing) return existing;

    const task = (async () => {
      try {
        const res = await fetch(framePath(index), { cache: 'force-cache' });
        if (!res.ok) return;
        const bitmap = await createImageBitmap(await res.blob());
        if (destroyed) {
          bitmap.close();
          return;
        }
        frames[index] = bitmap;
        if (index === target) paint(index, true);
      } catch {
        // A missing frame is survivable; paint() falls back to a neighbour.
      } finally {
        pending.delete(index);
      }
    })();

    pending.set(index, task);
    return task;
  }

  async function loadAll(): Promise<void> {
    const priority: number[] = [];
    for (let i = 0; i < PRIORITY; i += 1) {
      priority.push(Math.round((i / (PRIORITY - 1)) * (TOTAL - 1)));
    }
    await Promise.all(priority.map(load));

    if (!ready && !destroyed) {
      ready = true;
      onReady?.();
    }

    const rest: number[] = [];
    for (let i = 0; i < TOTAL; i += 1) {
      if (!frames[i]) rest.push(i);
    }

    let cursor = 0;
    const worker = async () => {
      while (cursor < rest.length && !destroyed) {
        const index = rest[cursor];
        cursor += 1;
        if (index === undefined) continue;
        await load(index);
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
  }

  /* --- Boot ------------------------------------------------------------ */

  rafId = requestAnimationFrame(tick);
  void loadAll();

  window.addEventListener(
    'pagehide',
    () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      frames.forEach((b) => b?.close());
    },
    { once: true },
  );
}
