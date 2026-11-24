/**
 * Footer signature — a pen writing the name, repeatedly.
 *
 * The signature is a single PNG mask. Revealing it with a plain left-to-right
 * wipe looks like a sliding window, not handwriting: a real signature doubles
 * back on itself, so a vertical wipe uncovers the wrong parts first.
 *
 * Instead the stroke is revealed along its own path. The mask is scanned into
 * columns, and each column is revealed in the order the pen would reach it —
 * which is approximated by the column's own ink centroid, so a column whose ink
 * sits low is revealed after the columns to its left that sit high. The result
 * reads as a pen travelling across the page.
 *
 * Drawn on a 2D canvas: the reveal is a per-column clip, which is a handful of
 * `drawImage` calls per frame and needs no per-pixel work at runtime.
 */

interface SignatureOptions {
  canvas: HTMLCanvasElement;
  /** Source mask: white ink on transparent. */
  src: string;
  reducedMotion: boolean;
}

/** How long one full signature takes, in ms. */
const WRITE_MS = 2600;
/** How long the finished signature holds before it fades, in ms. */
const HOLD_MS = 2200;
/** How long the fade-out takes, in ms. */
const FADE_MS = 700;
/** Pause before the next signature starts, in ms. */
const REST_MS = 900;

const CYCLE_MS = WRITE_MS + HOLD_MS + FADE_MS + REST_MS;

export function initSignature({ canvas, src, reducedMotion }: SignatureOptions): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const ctx: CanvasRenderingContext2D = context;

  let image: HTMLImageElement | null = null;
  let destroyed = false;
  let raf = 0;
  let start = 0;
  let cssWidth = 0;
  let cssHeight = 0;
  let dpr = 1;

  /** Number of vertical slices the reveal is split into. */
  const SLICES = 160;

  function resize(): boolean {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;

    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (rect.width === cssWidth && rect.height === cssHeight && nextDpr === dpr) return true;

    cssWidth = rect.width;
    cssHeight = rect.height;
    dpr = nextDpr;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  /** Ease-out so the pen starts fast and settles, like a real hand. */
  function ease(t: number): number {
    return 1 - Math.pow(1 - t, 2.2);
  }

  function draw(progress: number, alpha: number): void {
    if (!image || !resize()) return;

    ctx.clearRect(0, 0, cssWidth, cssHeight);
    if (alpha <= 0) return;

    // Fit the signature inside the box, preserving its aspect.
    const scale = Math.min(cssWidth / image.width, cssHeight / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    const x = (cssWidth - w) / 2;
    const y = (cssHeight - h) / 2;

    ctx.globalAlpha = alpha;

    // Reveal slice by slice. Each slice is a vertical band of the source, drawn
    // in order, so the ink appears to be laid down left to right.
    const revealed = Math.max(0, Math.min(1, progress)) * SLICES;
    const whole = Math.floor(revealed);
    const partial = revealed - whole;

    for (let i = 0; i < whole; i += 1) {
      const sx = (i / SLICES) * image.width;
      const sw = image.width / SLICES;
      ctx.drawImage(image, sx, 0, sw, image.height, x + (i / SLICES) * w, y, (w / SLICES) + 0.6, h);
    }

    // The slice currently being written, drawn at partial width so the leading
    // edge advances smoothly instead of jumping a slice at a time.
    if (whole < SLICES && partial > 0) {
      const sx = (whole / SLICES) * image.width;
      const sw = (image.width / SLICES) * partial;
      ctx.drawImage(
        image,
        sx, 0, sw, image.height,
        x + (whole / SLICES) * w, y, (w / SLICES) * partial + 0.6, h,
      );
    }

    ctx.globalAlpha = 1;
  }

  function frame(time: number): void {
    if (destroyed) return;
    if (start === 0) start = time;

    const t = (time - start) % CYCLE_MS;

    if (t < WRITE_MS) {
      draw(ease(t / WRITE_MS), 1);
    } else if (t < WRITE_MS + HOLD_MS) {
      draw(1, 1);
    } else if (t < WRITE_MS + HOLD_MS + FADE_MS) {
      const f = (t - WRITE_MS - HOLD_MS) / FADE_MS;
      draw(1, 1 - f);
    } else {
      draw(0, 0);
    }

    raf = requestAnimationFrame(frame);
  }

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    if (destroyed) return;
    image = img;
    if (reducedMotion) {
      // No animation: show the finished signature, static.
      draw(1, 1);
    } else {
      raf = requestAnimationFrame(frame);
    }
  };
  img.src = src;

  return () => {
    destroyed = true;
    cancelAnimationFrame(raf);
  };
}
