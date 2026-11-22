/**
 * Entrance portrait.
 *
 * A short, skippable scrub of the frame sequence. Unlike the previous build it
 * does not pin the page for 300vh: the portrait advances over the first screen
 * of scroll and then releases. Only a handful of frames are fetched up front,
 * so the entrance is usable immediately.
 */

interface EntranceOptions {
  canvas: HTMLCanvasElement;
  section: HTMLElement;
  onReady?: () => void;
}

const TOTAL = 121;
/** Frames fetched before the entrance is considered ready. */
const PRIORITY = 12;

function path(index: number): string {
  return `/frames/desktop/f${String(index).padStart(4, '0')}.webp`;
}

export function initEntrance({ canvas, section, onReady }: EntranceOptions): void {
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;
  const ctx: CanvasRenderingContext2D = context;

  const frames: Array<ImageBitmap | null> = new Array(TOTAL).fill(null);
  let current = -1;
  let target = 0;
  let rafId = 0;
  let destroyed = false;
  let ready = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    current = -1;
    paint(target, true);
  }

  function paint(index: number, force = false) {
    if (index === current && !force) return;

    let bitmap = frames[index];
    if (!bitmap) {
      for (let offset = 1; offset < TOTAL; offset += 1) {
        const before = frames[index - offset];
        if (before) {
          bitmap = before;
          break;
        }
        const after = frames[index + offset];
        if (after) {
          bitmap = after;
          break;
        }
      }
    }
    if (!bitmap) return;

    const { width, height } = canvas;
    // Fit the height and anchor to the bottom: the head sits at the top of the
    // crop, so vertical cropping would remove it. The frame's black background
    // blends into the page.
    const scale = Math.min(width / bitmap.width, height / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    const x = (width - w) / 2;
    const y = height - h;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, x, y, w, h);
    current = index;
  }

  function progress(): number {
    const rect = section.getBoundingClientRect();
    const span = rect.height;
    if (span <= 0) return 0;
    return Math.min(1, Math.max(0, -rect.top / span));
  }

  function tick() {
    if (destroyed) return;
    const p = progress();
    target = Math.round(p * (TOTAL - 1));
    paint(target);
    rafId = requestAnimationFrame(tick);
  }

  async function load(index: number) {
    if (destroyed || frames[index]) return;
    try {
      const res = await fetch(path(index), { cache: 'force-cache' });
      if (!res.ok) return;
      const bitmap = await createImageBitmap(await res.blob());
      if (destroyed) {
        bitmap.close();
        return;
      }
      frames[index] = bitmap;
      if (index === 0) paint(0, true);
    } catch {
      // A missing frame is survivable; paint() falls back to a neighbour.
    }
  }

  async function loadAll() {
    // Priority frames first, spread across the sequence.
    const priority: number[] = [];
    for (let i = 0; i < PRIORITY; i += 1) {
      priority.push(Math.round((i / (PRIORITY - 1)) * (TOTAL - 1)));
    }
    await Promise.all(priority.map(load));

    if (!ready) {
      ready = true;
      onReady?.();
    }

    // The rest, in the background, at low concurrency.
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

  resize();
  window.addEventListener('resize', resize, { passive: true });
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
