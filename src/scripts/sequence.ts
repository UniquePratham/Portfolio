/**
 * Scroll-scrubbed frame sequence.
 *
 * Frames are decoded into ImageBitmaps and painted to a canvas whose position is
 * driven by scroll progress through a tall sticky section. Frames load
 * coarse-to-fine so the first paint happens early and the scrub never stalls.
 *
 * The subject is anchored to the bottom edge of the viewport, so the figure
 * rises out of the page rather than floating in the middle of a letterbox.
 */

interface SequenceOptions {
  canvas: HTMLCanvasElement;
  section: HTMLElement;
  progressBar: HTMLElement;
  nav: HTMLElement | null;
  onProgress?: (loaded: number, total: number) => void;
  onFirstFrame?: () => void;
}

const TOTAL_FRAMES = 121;

function framePath(tier: 'desktop' | 'mobile', index: number): string {
  return `/frames/${tier}/f${String(index).padStart(4, '0')}.webp`;
}

/** Coarse-to-fine load order: every 8th frame, then every 4th, then the rest. */
function loadOrder(total: number): number[] {
  const seen = new Set<number>();
  const order: number[] = [];
  const push = (i: number) => {
    if (i < 0 || i >= total || seen.has(i)) return;
    seen.add(i);
    order.push(i);
  };

  for (let i = 0; i < total; i += 8) push(i);
  push(total - 1);
  for (let i = 0; i < total; i += 4) push(i);
  for (let i = 0; i < total; i += 2) push(i);
  for (let i = 0; i < total; i += 1) push(i);

  return order;
}

export function initSequence(options: SequenceOptions): { destroy: () => void } {
  const { canvas, section, progressBar, nav } = options;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return { destroy: () => {} };
  const ctx: CanvasRenderingContext2D = context;

  const tier: 'desktop' | 'mobile' = window.matchMedia('(max-width: 47.99rem)').matches
    ? 'mobile'
    : 'desktop';

  const frames: Array<ImageBitmap | null> = new Array(TOTAL_FRAMES).fill(null);
  let loadedCount = 0;
  let firstFrameShown = false;
  let currentFrame = -1;
  let targetFrame = 0;
  let rafId = 0;
  let destroyed = false;
  let navHidden = false;

  /* --- Sizing ---------------------------------------------------------- */
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    currentFrame = -1;
    paint(targetFrame, true);
  }

  /* --- Painting -------------------------------------------------------- */
  function paint(index: number, force = false) {
    if (index === currentFrame && !force) return;

    // Fall back to the nearest decoded frame so the scrub never blanks out.
    let bitmap = frames[index];
    if (!bitmap) {
      for (let offset = 1; offset < TOTAL_FRAMES; offset += 1) {
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

    // The subject's head sits at the very top of the crop, so vertical cropping
    // cuts it off. Cover only when it crops horizontally (viewport narrower than
    // the frame); otherwise fit the height and let the black background blend
    // into the plate. Phones use the portrait crop, which is tall enough to fill.
    const viewportAspect = width / height;
    const frameAspect = bitmap.width / bitmap.height;
    const scale =
      viewportAspect <= frameAspect
        ? Math.max(width / bitmap.width, height / bitmap.height)
        : Math.min(width / bitmap.width, height / bitmap.height);

    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    const x = (width - w) / 2;
    const y = height - h;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, x, y, w, h);
    currentFrame = index;

    if (!firstFrameShown) {
      firstFrameShown = true;
      options.onFirstFrame?.();
    }
  }

  /* --- Scroll progress ------------------------------------------------- */
  function progress(): number {
    const rect = section.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return 0;
    const raw = -rect.top / scrollable;
    return Math.min(1, Math.max(0, raw));
  }

  function tick() {
    if (destroyed) return;

    const p = progress();
    targetFrame = Math.round(p * (TOTAL_FRAMES - 1));

    paint(targetFrame);
    progressBar.style.transform = `scaleX(${p})`;

    // The nav leaves while the plate is pinned, and returns once it releases.
    const rect = section.getBoundingClientRect();
    const inPlate = rect.top <= 0 && rect.bottom >= window.innerHeight;
    if (inPlate !== navHidden) {
      navHidden = inPlate;
      nav?.setAttribute('data-hidden', String(inPlate));
    }

    rafId = requestAnimationFrame(tick);
  }

  /* --- Loading --------------------------------------------------------- */
  const order = loadOrder(TOTAL_FRAMES);

  async function loadFrame(index: number): Promise<void> {
    if (destroyed || frames[index]) return;
    try {
      const response = await fetch(framePath(tier, index), { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      if (destroyed) {
        bitmap.close();
        return;
      }
      frames[index] = bitmap;
      loadedCount += 1;
      options.onProgress?.(loadedCount, TOTAL_FRAMES);

      if (index === 0) paint(0, true);
    } catch {
      // A missing frame is survivable — paint() falls back to a neighbour.
      loadedCount += 1;
      options.onProgress?.(loadedCount, TOTAL_FRAMES);
    }
  }

  async function loadAll() {
    const CONCURRENCY = 6;
    let cursor = 0;

    const worker = async () => {
      while (cursor < order.length && !destroyed) {
        const index = order[cursor];
        cursor += 1;
        if (index === undefined) continue;
        await loadFrame(index);
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  /* --- Boot ------------------------------------------------------------ */
  resize();
  window.addEventListener('resize', resize, { passive: true });
  rafId = requestAnimationFrame(tick);
  void loadAll();

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      frames.forEach((bitmap) => bitmap?.close());
    },
  };
}
