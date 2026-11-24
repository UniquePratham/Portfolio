/**
 * Footer signature — a pen writing the name, repeatedly.
 *
 * The ink is revealed along the pen's own travel path, not with a left-to-right
 * wipe. A wipe looks like a sliding window: a signature doubles back on itself,
 * so a vertical band uncovers the wrong parts first and the pen has nothing to
 * follow.
 *
 * `_tools/gen_signature_path.py` traces the stroke into ordered polylines
 * (skeletonise, split at junctions, chain by proximity, simplify). This module
 * walks those polylines at a human writing speed, drawing the ink mask only
 * where the pen has been, and lifts the pen between strokes.
 *
 * Timing is per-stroke, not global: each stroke is written at a constant speed
 * and each pen lift takes a fixed time. A single global progress makes short
 * strokes flash past and long ones crawl, which reads as a machine, not a hand.
 *
 * Drawn on a 2D canvas: the reveal is one composite per frame.
 */

import pathData from '../data/signature-path.json';

interface SignatureOptions {
  canvas: HTMLCanvasElement;
  /** Ink mask: white on transparent. */
  src: string;
  reducedMotion: boolean;
}

/**
 * Writing speed, in normalised path units per second. The path is normalised to
 * a 0..1 box, so this is roughly "signature widths per second". Tuned so the
 * whole signature takes about 2.5-3s — a natural hand speed. Slower reads as
 * sluggish, faster reads as a machine.
 */
const WRITE_SPEED = 3.1;
/** How long a pen lift between strokes takes, in ms. */
const LIFT_MS = 110;
/** How long the finished signature holds before it fades, in ms. */
const HOLD_MS = 2600;
/** How long the fade-out takes, in ms. */
const FADE_MS = 800;
/** Pause before the next signature starts, in ms. */
const REST_MS = 1100;

/** Ink colour, matching `--accent`. */
const INK = '#c4df73';

/**
 * The pen's writing angle, in radians, measured from the +x axis.
 *
 * A real hand holds the pen at a roughly constant angle and moves the whole arm;
 * it does not spin the pen to follow every curve. Rotating to the path tangent
 * made the pen "dance". This angle is fixed for the whole signature — about 52°
 * from horizontal, which is a natural right-handed writing posture.
 */
const PEN_ANGLE = (52 * Math.PI) / 180;

/** The traced strokes, normalised to 0..1. `null` marks a pen lift. */
const RAW = pathData.points as Array<[number, number] | null>;

interface Stroke {
  points: Array<[number, number]>;
  cumulative: number[];
  length: number;
  /** Time to write this stroke at WRITE_SPEED, in ms. */
  writeMs: number;
  /** Time at which this stroke starts, in ms, including preceding lifts. */
  startMs: number;
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
    STROKES.push({ points: current, cumulative, length, writeMs: 0, startMs: 0 });
    current = [];
  };
  for (const p of RAW) {
    if (p === null) flush();
    else current.push(p);
  }
  flush();
}

// Assign each stroke its own time slot: write time proportional to its length,
// plus a fixed lift before every stroke after the first.
{
  let t = 0;
  for (let i = 0; i < STROKES.length; i += 1) {
    const s = STROKES[i];
    if (!s) continue;
    if (i > 0) t += LIFT_MS;
    s.startMs = t;
    s.writeMs = Math.max(90, (s.length / WRITE_SPEED) * 1000);
    t += s.writeMs;
  }
}

/** Total time to write the whole signature, in ms. */
const WRITE_MS = STROKES.reduce((sum, s) => sum + s.writeMs, 0) + LIFT_MS * Math.max(0, STROKES.length - 1);

const CYCLE_MS = WRITE_MS + HOLD_MS + FADE_MS + REST_MS;

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

  /**
   * The pen's scale, tied to the ink's height so it stays proportional at every
   * viewport. The pen is 80 units tall, so `inkH / 110` makes it about 0.73x the
   * signature's height — present, but not dominating it.
   */
  function penScaleFor(inkH: number): number {
    return Math.max(0.7, Math.min(1.5, inkH / 110));
  }

  /**
   * The pen's footprint in canvas px, measured from the nib.
   *
   * Derived from the drawing constants in `drawPen()` and rotated by
   * `PEN_ANGLE`, so the ink box can be inset by exactly the room the pen needs.
   * Hard-coding these numbers is how the hand ended up cropped: the barrel and
   * hand reach ~89 units to the right of the nib, not the ~36 that looked
   * plausible.
   */
  function penExtent(s: number) {
    // Local bbox of everything `drawPen()` paints, nib at the origin: the hand
    // (palm, wrist and fingers, all above the nib) plus the barrel.
    const x0 = -6;
    const x1 = 50;
    const y0 = -80;
    const y1 = 6;
    const th = Math.PI * 0.5 - PEN_ANGLE;
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    let left = 0;
    let right = 0;
    let top = 0;
    let bottom = 0;
    for (const x of [x0, x1]) {
      for (const y of [y0, y1]) {
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        left = Math.max(left, -rx);
        right = Math.max(right, rx);
        top = Math.max(top, -ry);
        bottom = Math.max(bottom, ry);
      }
    }
    return { left: left * s, right: right * s, top: top * s, bottom: bottom * s };
  }

  /**
   * Where the ink sits inside the canvas box.
   *
   * The pen's footprint scales with the ink's height, so the ink height that
   * fits is solved by iteration: start from a guess, measure the pen at that
   * size, then shrink the ink to what is left. Three passes converge to well
   * under a pixel. The ink is anchored to the bottom so the signature sits on
   * the footer rule.
   */
  function inkBox() {
    if (!image) return { x: 0, y: 0, w: 0, h: 0 };

    const aspect = image.width / image.height;
    let inkH = Math.min(cssWidth / (aspect + 1), cssHeight / 2);

    for (let i = 0; i < 3; i += 1) {
      const pad = penExtent(penScaleFor(inkH));
      const availW = Math.max(1, cssWidth - pad.left - pad.right);
      const availH = Math.max(1, cssHeight - pad.top - pad.bottom);
      inkH = Math.min(availW / aspect, availH);
    }

    const pad = penExtent(penScaleFor(inkH));
    const availW = Math.max(1, cssWidth - pad.left - pad.right);
    const w = inkH * aspect;
    const h = inkH;

    const x = pad.left + (availW - w) / 2;
    const y = cssHeight - pad.bottom - h;
    return { x, y, w, h };
  }

  /** Map a normalised path point into canvas space. */
  function toCanvas(p: [number, number], box: ReturnType<typeof inkBox>) {
    return { x: box.x + p[0] * box.w, y: box.y + p[1] * box.h };
  }

  /**
   * Stroke the travelled part of every stroke into the target context.
   *
   * This is drawn as a thick band and used as a composite mask, NOT as a clip:
   * `ctx.clip()` clips to the path's *interior*, and the interior of an open
   * polyline is a thin sliver — which silently cut away most of the ink.
   */
  function traceTravelled(
    elapsed: number,
    box: ReturnType<typeof inkBox>,
    width: number,
    target: CanvasRenderingContext2D,
  ) {
    target.beginPath();

    for (const stroke of STROKES) {
      if (elapsed <= stroke.startMs) break;

      // How much of this stroke has been written, 0..1.
      const local = Math.min(1, (elapsed - stroke.startMs) / stroke.writeMs);
      const budget = local * stroke.length;

      const first = stroke.points[0];
      if (!first) continue;
      const startPt = toCanvas(first, box);
      target.moveTo(startPt.x, startPt.y);

      for (let i = 1; i < stroke.points.length; i += 1) {
        const p = stroke.points[i];
        if (!p) continue;
        const pt = toCanvas(p, box);
        target.lineTo(pt.x, pt.y);
        if ((stroke.cumulative[i] ?? 0) >= budget) break;
      }
    }

    target.lineWidth = width;
    target.lineCap = 'round';
    target.lineJoin = 'round';
    target.strokeStyle = '#fff';
    target.stroke();
  }

  /**
   * The pen's position and heading at a given time.
   *
   * During a lift the pen travels in a straight line from the end of the last
   * stroke to the start of the next, so it moves rather than teleporting.
   */
  function penAt(elapsed: number, box: ReturnType<typeof inkBox>) {
    for (let i = 0; i < STROKES.length; i += 1) {
      const stroke = STROKES[i];
      if (!stroke) continue;

      // Inside this stroke's write window.
      if (elapsed >= stroke.startMs && elapsed <= stroke.startMs + stroke.writeMs) {
        const local = (elapsed - stroke.startMs) / stroke.writeMs;
        const target = local * stroke.length;

        let j = 1;
        while (j < stroke.points.length - 1 && (stroke.cumulative[j] ?? 0) < target) j += 1;

        const a = stroke.points[j - 1];
        const b = stroke.points[j];
        if (!a || !b) return null;

        const segStart = stroke.cumulative[j - 1] ?? 0;
        const segLen = (stroke.cumulative[j] ?? 0) - segStart;
        const t = segLen > 0 ? Math.min(1, Math.max(0, (target - segStart) / segLen)) : 0;

        const pa = toCanvas(a, box);
        const pb = toCanvas(b, box);
        return {
          x: pa.x + (pb.x - pa.x) * t,
          y: pa.y + (pb.y - pa.y) * t,
          angle: Math.atan2(pb.y - pa.y, pb.x - pa.x),
          lifted: false,
        };
      }

      // In the lift before the next stroke.
      const next = STROKES[i + 1];
      if (next && elapsed > stroke.startMs + stroke.writeMs && elapsed < next.startMs) {
        const from = stroke.points[stroke.points.length - 1];
        const to = next.points[0];
        if (!from || !to) return null;

        const liftStart = stroke.startMs + stroke.writeMs;
        const t = Math.min(1, Math.max(0, (elapsed - liftStart) / (next.startMs - liftStart)));

        const pa = toCanvas(from, box);
        const pb = toCanvas(to, box);
        return {
          x: pa.x + (pb.x - pa.x) * t,
          y: pa.y + (pb.y - pa.y) * t,
          angle: Math.atan2(pb.y - pa.y, pb.x - pa.x),
          lifted: true,
        };
      }
    }

    return null;
  }

  /**
   * A hand holding a fountain pen, tip at the origin, body extending up.
   *
   * Drawn with canvas primitives rather than a photo: no extra request, no
   * licence, and it stays crisp at any DPR. The angle is FIXED — a real hand
   * holds the pen steady and moves the arm, so rotating to the path tangent made
   * the pen dance.
   */
  function drawPen(x: number, y: number, alpha: number, scale: number): void {
    ctx.save();
    ctx.translate(x, y);
    // The pen is drawn with its tip at the origin and its body along -y. A pen
    // trails BEHIND the direction of travel, so the barrel must lean back over
    // the written area. `rotate(PI/2 - PEN_ANGLE)` maps (0,-1) to
    // (+cos, -sin) — up and to the RIGHT, which is a right-handed grip. The
    // opposite rotation is a left-hander's pose and reads as wrong.
    ctx.rotate(Math.PI * 0.5 - PEN_ANGLE);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    // --- Hand, behind the pen --------------------------------------------
    // A hand gripping a pen wraps AROUND the barrel: the palm sits behind it, the
    // index finger and thumb in front. Drawing the whole hand behind the pen is
    // what made it read as a mitten stuck to a floating pen.
    //
    // Everything is kept ABOVE the nib (y < 0). The ink is written at y = 0, so
    // any part of the hand below that covers the signature — which is exactly
    // what happened when the palm was allowed to hang past the tip.
    ctx.save();

    const skin = '#c9a184';
    const skinLight = '#dcb99c';
    const skinMid = '#cfa88b';
    const crease = 'rgba(112, 74, 50, 0.42)';

    // Palm and wrist as ONE mass. Drawing the wrist as a separate capsule made
    // it read as a pointing finger.
    ctx.beginPath();
    ctx.moveTo(46, 6);
    // Outer edge of the wrist, rising into the back of the hand.
    ctx.quadraticCurveTo(42, -14, 34, -30);
    ctx.quadraticCurveTo(26, -44, 14, -44);
    ctx.quadraticCurveTo(6, -42, 5, -32);
    ctx.quadraticCurveTo(4, -22, 7, -14);
    // Lower edge of the palm, back out to the wrist.
    ctx.quadraticCurveTo(14, -6, 26, -2);
    ctx.quadraticCurveTo(38, 2, 46, 6);
    ctx.closePath();
    ctx.fillStyle = skin;
    ctx.fill();

    // Curled middle, ring and little fingers, tucked UNDER the barrel — they
    // point left and down, toward the nib, which is what a pen grip looks like.
    ctx.lineCap = 'round';
    for (const f of [
      { x0: 12, y0: -12, x1: 3, y1: -7, w: 7.5 },
      { x0: 20, y0: -10, x1: 11, y1: -4, w: 7.5 },
      { x0: 28, y0: -9, x1: 19, y1: -2, w: 7 },
    ]) {
      ctx.beginPath();
      ctx.moveTo(f.x0, f.y0);
      ctx.lineTo(f.x1, f.y1);
      ctx.lineWidth = f.w;
      ctx.strokeStyle = skinMid;
      ctx.stroke();
    }

    // Palm crease, so the grip has depth.
    ctx.beginPath();
    ctx.moveTo(10, -26);
    ctx.quadraticCurveTo(18, -32, 27, -28);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = crease;
    ctx.stroke();

    ctx.restore();

    // --- Pen -------------------------------------------------------------
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

    // --- Fingers in front of the barrel ----------------------------------
    // The index finger lies along the near side of the barrel and the thumb
    // crosses it lower down. Drawn AFTER the pen so they overlap it — that
    // overlap is what makes the hand read as gripping rather than resting
    // behind.
    ctx.save();
    ctx.lineCap = 'round';

    // Index finger, lying along the near side of the barrel.
    ctx.beginPath();
    ctx.moveTo(8, -22);
    ctx.quadraticCurveTo(5, -32, 3, -42);
    ctx.lineWidth = 8.5;
    ctx.strokeStyle = skinLight;
    ctx.stroke();

    // Thumb, crossing the grip from the near side.
    ctx.beginPath();
    ctx.moveTo(10, -16);
    ctx.quadraticCurveTo(3, -20, -1, -28);
    ctx.lineWidth = 9;
    ctx.strokeStyle = skinLight;
    ctx.stroke();

    // Crease where the thumb meets the index finger.
    ctx.beginPath();
    ctx.moveTo(6, -27);
    ctx.quadraticCurveTo(2, -30, -1, -28);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = crease;
    ctx.stroke();

    ctx.restore();

    ctx.restore();
  }

  function draw(elapsed: number, alpha: number, showPen: boolean): void {
    if (!image || !resize()) return;

    ctx.clearRect(0, 0, cssWidth, cssHeight);
    if (alpha <= 0) return;

    const box = inkBox();

    // Publish the ink rect so tests can compare against the real geometry
    // instead of re-deriving it and silently drifting from the implementation.
    canvas.dataset.inkBox = `${box.x},${box.y},${box.w},${box.h}`;

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
    traceTravelled(elapsed, box, Math.max(8, box.h * 0.22), bctx);
    bctx.restore();
    bctx.globalCompositeOperation = 'source-over';

    // 3. Composite the result onto the visible canvas.
    ctx.globalAlpha = alpha;
    ctx.drawImage(buffer, 0, 0, cssWidth, cssHeight);
    ctx.globalAlpha = 1;

    // 4. The pen, at the leading point. It is drawn during a lift too, so it
    //    visibly travels to the next stroke instead of teleporting. Full alpha
    //    throughout: a real hand does not fade out when it lifts the pen.
    if (showPen && elapsed > 0 && elapsed < WRITE_MS) {
      const pen = penAt(elapsed, box);
      if (pen) drawPen(pen.x, pen.y, alpha, penScaleFor(box.h));
    }
  }

  function frame(time: number): void {
    if (destroyed) return;
    if (start === 0) start = time;

    const t = (time - start) % CYCLE_MS;

    if (t < WRITE_MS) {
      draw(t, 1, true);
    } else if (t < WRITE_MS + HOLD_MS) {
      draw(WRITE_MS, 1, false);
    } else if (t < WRITE_MS + HOLD_MS + FADE_MS) {
      const f = (t - WRITE_MS - HOLD_MS) / FADE_MS;
      draw(WRITE_MS, 1 - f, false);
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
      // No animation: show the finished signature, static, no pen. `draw` takes
      // ELAPSED TIME, so it must be given the full write duration, not `1`.
      draw(WRITE_MS, 1, false);
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
