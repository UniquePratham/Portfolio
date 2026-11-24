/**
 * Entrance portrait.
 *
 * A short, skippable scrub of the frame sequence. The portrait advances over the
 * distance the entrance section travels while pinned, then releases.
 *
 * Sizing is driven by a ResizeObserver on the canvas box, not by `window.resize`
 * alone: the canvas lives in a grid column whose width changes when fonts load
 * and when the viewport crosses a breakpoint. Measuring before layout settles
 * produced a zero-width bitmap and a visible jump when a later resize corrected
 * it, so every resize is now guarded by an actual dimension change.
 */

interface EntranceOptions {
  canvas: HTMLCanvasElement;
  section: HTMLElement;
  onReady?: () => void;
}

const TOTAL = 121;
/** Frames fetched before the entrance is considered ready. */
const PRIORITY = 12;

/** Phones get the portrait crop, which fills the frame without letterboxing. */
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
  /** In-flight requests, so a frame is never fetched twice concurrently. */
  const pending = new Map<number, Promise<void>>();

  let current = -1;
  let target = 0;
  let rafId = 0;
  let destroyed = false;
  let ready = false;
  let lastWidth = 0;
  let lastHeight = 0;

  /* --- Sizing ---------------------------------------------------------- */

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);

    // A zero-size box means layout has not settled. Leave the canvas alone and
    // wait for the ResizeObserver to fire again rather than writing a 0x0
    // bitmap, which would blank the portrait until the next resize.
    if (width < 2 || height < 2) return;

    // Only touch the bitmap when the size actually changed. Assigning
    // canvas.width clears the canvas, so a redundant resize is a visible flash.
    if (width === lastWidth && height === lastHeight) return;

    lastWidth = width;
    lastHeight = height;
    canvas.width = width;
    canvas.height = height;

    current = -1;
    paint(target, true);
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

    const { width, height } = canvas;
    if (width < 2 || height < 2) return;

    // Fill the box and pin the subject's feet to the bottom edge.
    //
    // The frames are portrait and already normalised on head width, so a cover
    // fit crops almost nothing. Anchoring to the bottom means the figure always
    // stands on the same line, whatever the viewport height — no dead space
    // below, and no vertical drift as the box resizes.
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    const x = (width - w) / 2;
    const y = height - h;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, x, y, w, h);
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
        // Repaint if this frame is the one the scrub is currently asking for.
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

  // Measure once now, then let the observer handle every later change.
  resize();

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(canvas);

  // Fonts change the grid column width after first paint.
  if ('fonts' in document) {
    void document.fonts.ready.then(() => resize());
  }

  rafId = requestAnimationFrame(tick);
  void loadAll();

  window.addEventListener(
    'pagehide',
    () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      frames.forEach((b) => b?.close());
    },
    { once: true },
  );
}
