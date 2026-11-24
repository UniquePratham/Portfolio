/**
 * Footer signature — a pen writing the name, repeatedly.
 *
 * The ink is revealed along the pen's own travel path, not with a left-to-right
 * wipe. A wipe looks like a sliding window: a signature doubles back on itself,
 * so a vertical band uncovers the wrong parts first and the pen has nothing to
 * follow.
 *
 * `_tools/gen_signature_path.py` traces the stroke into an ordered polyline
 * (skeletonise, longest path through the pixel graph, simplify). This module
 * strokes that polyline into a clip region and draws the ink mask inside it, so
 * ink appears exactly where the pen has been. A pen is drawn at the leading
 * point, rotated to the path's tangent.
 *
 * Drawn on a 2D canvas: the reveal is one clip plus one `drawImage` per frame.
 */

import pathData from '../data/signature-path.json';

interface SignatureOptions {
  canvas: HTMLCanvasElement;
  /** Ink mask: white on transparent. */
  src: string;
  reducedMotion: boolean;
}

/** How long one full signature takes, in ms. */
const WRITE_MS = 3000;
/** How long the finished signature holds before it fades, in ms. */
const HOLD_MS = 2400;
/** How long the fade-out takes, in ms. */
const FADE_MS = 700;
/** Pause before the next signature starts, in ms. */
const REST_MS = 900;

const CYCLE_MS = WRITE_MS + HOLD_MS + FADE_MS + REST_MS;

/** Ink colour, matching `--accent`. */
const INK = '#c4df73';

/** The traced stroke, normalised to 0..1. `null` marks a pen lift. */
const RAW = pathData.points as Array<[number, number] | null>;

/**
 * Split the flat list into strokes at the `null` separators, and precompute each
 * stroke's cumulative arc length so progress is time-uniform.
 */
interface Stroke {
  points: Array<[number, number]>;
  cumulative: number[];
  length: number;
}

const STROKES: Stroke[] = [];
{
  let current: Array<[number, number]> = [];
  const flush = () => {
    if (current.length < 2) {
      current = [];
      return;
    }
    const cumulative = [0];
    let length = 0;
    for (let i = 1; i < current.length; i += 1) {
      const a = current[i - 1];
      const b = current[i];
      if (!a || !b) continue;
      length += Math.hypot(b[0] - a[0], b[1] - a[1]);
      cumulative.push(length);
    }
    STROKES.push({ points: current, cumulative, length });
    current = [];
  };
  for (const p of RAW) {
    if (p === null) flush();
    else current.push(p);
  }
  flush();
}

/** Total pen travel across every stroke. */
const TOTAL_LENGTH = STROKES.reduce((sum, s) => sum + s.length, 0);

export function initSignature({ canvas, src, reducedMotion }: SignatureOptions): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const ctx: CanvasRenderingContext2D = context;

  let image: HTMLImageElement | null = null;
  let buffer: HTMLCanvasElement | null = null;
  let destroyed = false;
  const cleanups: Array<() => void> = [];
  let raf = 0;
  let start = 0;
  let cssWidth = 0;
  let cssHeight = 0;
  let dpr = 1;

  /** Cumulative arc length along the path, so progress is time-uniform. */
  // (precomputed above as STROKES / TOTAL_LENGTH)

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

  /** Where the ink sits inside the canvas box. Anchored to the bottom, so the
   *  extra height above it is room for the pen. */
  function inkBox() {
    if (!image) return { x: 0, y: 0, w: 0, h: 0 };
    const scale = Math.min(cssWidth / image.width, cssHeight / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    return { x: (cssWidth - w) / 2, y: cssHeight - h, w, h };
  }

  /** Map a normalised path point into canvas space. */
  function toCanvas(p: [number, number], box: ReturnType<typeof inkBox>) {
    return { x: box.x + p[0] * box.w, y: box.y + p[1] * box.h };
  }

  /**
   * Stroke the travelled part of every stroke into the current path.
   *
   * This is drawn as a thick band and used as a composite mask, NOT as a clip:
   * `ctx.clip()` clips to the path's *interior*, and the interior of an open
   * polyline is a thin sliver — which silently cut away most of the ink.
   */
  function traceTravelled(
    progress: number,
    box: ReturnType<typeof inkBox>,
    width: number,
    target: CanvasRenderingContext2D,
  ) {
    let remaining = progress * TOTAL_LENGTH;
    target.beginPath();

    for (const stroke of STROKES) {
      if (remaining <= 0) break;

      const first = stroke.points[0];
      if (!first) continue;
      const startPt = toCanvas(first, box);
      target.moveTo(startPt.x, startPt.y);

      const budget = Math.min(remaining, stroke.length);
      for (let i = 1; i < stroke.points.length; i += 1) {
        const p = stroke.points[i];
        if (!p) continue;
        const pt = toCanvas(p, box);
        target.lineTo(pt.x, pt.y);
        if ((stroke.cumulative[i] ?? 0) >= budget) break;
      }

      remaining -= stroke.length;
    }

    target.lineWidth = width;
    target.lineCap = 'round';
    target.lineJoin = 'round';
    target.strokeStyle = '#fff';
    target.stroke();
  }

  /** The pen's position and heading at a given progress. */
  function penAt(progress: number, box: ReturnType<typeof inkBox>) {
    let remaining = progress * TOTAL_LENGTH;

    for (const stroke of STROKES) {
      if (remaining > stroke.length) {
        remaining -= stroke.length;
        continue;
      }

      let i = 1;
      while (i < stroke.points.length - 1 && (stroke.cumulative[i] ?? 0) < remaining) i += 1;

      const a = stroke.points[i - 1];
      const b = stroke.points[i];
      if (!a || !b) return null;

      const segStart = stroke.cumulative[i - 1] ?? 0;
      const segLen = (stroke.cumulative[i] ?? 0) - segStart;
      const t = segLen > 0 ? Math.min(1, Math.max(0, (remaining - segStart) / segLen)) : 0;

      const pa = toCanvas(a, box);
      const pb = toCanvas(b, box);
      return {
        x: pa.x + (pb.x - pa.x) * t,
        y: pa.y + (pb.y - pa.y) * t,
        angle: Math.atan2(pb.y - pa.y, pb.x - pa.x),
      };
    }

    return null;
  }

  /**
   * A fountain pen, tip at the origin, body extending up. Drawn with canvas
   * primitives rather than an image: no extra request, no licence, and it stays
   * crisp at any DPR.
   */
  function drawPen(x: number, y: number, angle: number, alpha: number): void {
    // Scale the pen to the ink's height so it reads as a real pen beside the
    // signature. The pen is ~80 units tall, so this makes it roughly 1.6x the
    // ink's height — big enough to be unmistakable at footer size.
    const scale = Math.max(1.0, Math.min(2.2, cssHeight / 55));

    ctx.save();
    ctx.translate(x, y);
    // The pen is drawn with its tip at the origin and its body along -y. A pen
    // trails BEHIND the direction of travel, so -y must map to `angle + PI`.
    // `rotate(angle - PI/2)` does that: (0,-1) -> (-cos angle, -sin angle).
    // Using `angle + PI/2` points the body forward, over the unwritten area,
    // where it is clipped by the canvas edge and effectively invisible.
    // The extra 0.38 tilts it back so it reads as held, not lying flat.
    ctx.rotate(angle - Math.PI * 0.5 + 0.38);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    // Nib: a slim wedge from the tip.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-3.4, -13);
    ctx.lineTo(3.4, -13);
    ctx.closePath();
    ctx.fillStyle = '#d8d4c6';
    ctx.fill();

    // The slit down the nib.
    ctx.beginPath();
    ctx.moveTo(0, -1.5);
    ctx.lineTo(0, -11);
    ctx.strokeStyle = 'rgba(16, 26, 22, 0.55)';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Grip section.
    ctx.beginPath();
    ctx.moveTo(-3.4, -13);
    ctx.lineTo(3.4, -13);
    ctx.lineTo(4.6, -26);
    ctx.lineTo(-4.6, -26);
    ctx.closePath();
    ctx.fillStyle = '#2e463a';
    ctx.fill();

    // Barrel.
    ctx.beginPath();
    ctx.moveTo(-4.6, -26);
    ctx.lineTo(4.6, -26);
    ctx.lineTo(5.4, -74);
    ctx.quadraticCurveTo(5.4, -80, 0, -80);
    ctx.quadraticCurveTo(-5.4, -80, -5.4, -74);
    ctx.closePath();
    ctx.fillStyle = '#182720';
    ctx.fill();

    // A highlight down the barrel so it reads as a cylinder.
    ctx.beginPath();
    ctx.moveTo(-2.2, -28);
    ctx.lineTo(-2.2, -72);
    ctx.strokeStyle = 'rgba(241, 240, 232, 0.16)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Cap band in the accent, tying the pen to the palette.
    ctx.beginPath();
    ctx.moveTo(-4.9, -30);
    ctx.lineTo(4.9, -30);
    ctx.lineTo(5.0, -34);
    ctx.lineTo(-5.0, -34);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();

    ctx.restore();
  }

  function draw(progress: number, alpha: number, showPen: boolean): void {
    if (!image || !resize()) return;

    ctx.clearRect(0, 0, cssWidth, cssHeight);
    if (alpha <= 0) return;

    const box = inkBox();

    // 1. Draw the ink mask into an offscreen buffer, tinted to the accent.
    //    Working offscreen keeps the mask and the travelled band separate, so
    //    they can be combined with a composite operation instead of a clip.
    if (!buffer || buffer.width !== canvas.width || buffer.height !== canvas.height) {
      buffer = document.createElement('canvas');
      buffer.width = canvas.width;
      buffer.height = canvas.height;
    }
    const bctx = buffer.getContext('2d');
    if (!bctx) return;

    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, cssWidth, cssHeight);
    bctx.drawImage(image, box.x, box.y, box.w, box.h);
    // Tint: keep only where the mask has ink, and fill that with the accent.
    bctx.globalCompositeOperation = 'source-in';
    bctx.fillStyle = INK;
    bctx.fillRect(0, 0, cssWidth, cssHeight);
    bctx.globalCompositeOperation = 'source-over';

    // 2. Keep only the part of the tinted ink the pen has already travelled.
    //    `destination-in` multiplies by the band's alpha, so the ink appears
    //    exactly along the stroke instead of being clipped to a sliver.
    bctx.globalCompositeOperation = 'destination-in';
    bctx.save();
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    traceTravelled(progress, box, Math.max(8, box.h * 0.22), bctx);
    bctx.restore();
    bctx.globalCompositeOperation = 'source-over';

    // 3. Composite the result onto the visible canvas.
    ctx.globalAlpha = alpha;
    ctx.drawImage(buffer, 0, 0, cssWidth, cssHeight);
    ctx.globalAlpha = 1;

    // 4. The pen, at the leading point.
    if (showPen && progress > 0 && progress < 1) {
      const pen = penAt(progress, box);
      if (pen) drawPen(pen.x, pen.y, pen.angle, alpha);
    }
  }

  function frame(time: number): void {
    if (destroyed) return;
    if (start === 0) start = time;

    const t = (time - start) % CYCLE_MS;

    if (t < WRITE_MS) {
      draw(ease(t / WRITE_MS), 1, true);
    } else if (t < WRITE_MS + HOLD_MS) {
      draw(1, 1, false);
    } else if (t < WRITE_MS + HOLD_MS + FADE_MS) {
      const f = (t - WRITE_MS - HOLD_MS) / FADE_MS;
      draw(1, 1 - f, false);
    } else {
      draw(0, 0, false);
    }

    raf = requestAnimationFrame(frame);
  }

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    if (destroyed) return;
    image = img;

    if (reducedMotion) {
      // No animation: show the finished signature, static, no pen.
      draw(1, 1, false);
      return;
    }

    // Start the cycle when the footer is actually on screen. Animating from page
    // load means the visitor scrolls down to a signature that has already been
    // written and is sitting in its hold phase — the pen is never seen.
    const startCycle = () => {
      if (destroyed || raf !== 0) return;
      start = 0;
      raf = requestAnimationFrame(frame);
    };

    if (!('IntersectionObserver' in window)) {
      startCycle();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          startCycle();
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(canvas);
    cleanups.push(() => observer.disconnect());
  };
  img.src = src;

  return () => {
    destroyed = true;
    cancelAnimationFrame(raf);
    cleanups.forEach((fn) => fn());
  };
}
