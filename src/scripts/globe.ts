/**
 * Wireframe globe behind the project carousel.
 *
 * The carousel places its cards on the surface of a sphere; this draws the
 * sphere itself — meridians, parallels and a marker per project — so the
 * arrangement reads as a globe rather than a flat ring. The rotation is driven
 * by the carousel's active index, so turning the carousel turns the globe.
 *
 * Drawn on a 2D canvas rather than WebGL: ~1000 line segments per frame is well
 * within a 2D context's budget, and it avoids shipping a 3D library for one
 * decorative element.
 */

interface GlobeOptions {
  canvas: HTMLCanvasElement;
  /** Target rotation in radians. The globe eases toward it. */
  getTargetRotation: () => number;
  /** Number of markers to place on the surface, one per project. */
  markerCount: number;
  reducedMotion: boolean;
}

const MERIDIANS = 12;
const PARALLELS = 7;
const MERIDIAN_STEPS = 36;
const PARALLEL_STEPS = 48;

/** How fast the globe catches up to the carousel, per frame. */
const EASE = 0.12;
/** Idle drift, radians per second. Keeps the globe alive when nothing moves. */
const DRIFT = 0.035;

export function initGlobe({
  canvas,
  getTargetRotation,
  markerCount,
  reducedMotion,
}: GlobeOptions): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  // Bind to a non-nullable local: the closures below cannot narrow `context`.
  const ctx: CanvasRenderingContext2D = context;

  let cssWidth = 0;
  let cssHeight = 0;
  let dpr = 1;
  let raf = 0;
  let destroyed = false;
  let rotation = getTargetRotation();
  let drift = 0;
  let lastTime = 0;

  /**
   * Match the bitmap to the element's box. Returns false while the element has
   * no layout (hidden section), so the caller can skip the frame.
   */
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

  function draw(): void {
    if (!resize()) return;

    const cx = cssWidth / 2;
    const cy = cssHeight / 2;
    // Fit the sphere inside the stage so its silhouette is fully visible above
    // and below the cards. A larger radius clips into disconnected arcs, which
    // reads as random curves rather than a globe.
    const r = Math.min(cssWidth, cssHeight) * 0.46;

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // A soft core so the sphere reads as a body, not just floating lines.
    const glow = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    glow.addColorStop(0, 'rgba(196, 223, 115, 0.07)');
    glow.addColorStop(0.7, 'rgba(196, 223, 115, 0.022)');
    glow.addColorStop(1, 'rgba(196, 223, 115, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // The silhouette. Without it the wireframe reads as loose curves; with it
    // the shape is unmistakably a sphere.
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(196, 223, 115, 0.22)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1;

    /** Orthographic projection of a sphere point. `z` is 1 at the front. */
    const project = (lat: number, lon: number) => {
      const cosLat = Math.cos(lat);
      const angle = lon + rotation;
      return {
        x: cx + cosLat * Math.sin(angle) * r,
        y: cy - Math.sin(lat) * r,
        z: cosLat * Math.cos(angle),
      };
    };

    type Point = { x: number; y: number; z: number };

    /**
     * Stroke a whole curve as one path, split into depth bands.
     *
     * One `stroke()` per segment would be ~1000 draw calls per frame. Grouping
     * by depth band keeps the far side faint and the near side bright with a
     * handful of calls instead.
     */
    const BANDS = 6;
    const strokeCurve = (points: Point[], boost = 0) => {
      for (let band = 0; band < BANDS; band += 1) {
        const lo = -1 + (band / BANDS) * 2;
        const hi = -1 + ((band + 1) / BANDS) * 2;
        const mid = (lo + hi) / 2;
        const alpha = 0.05 + 0.42 * ((mid + 1) / 2) + boost;

        ctx.strokeStyle = `rgba(196, 223, 115, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        let drawing = false;
        for (let i = 0; i < points.length - 1; i += 1) {
          const a = points[i];
          const b = points[i + 1];
          if (!a || !b) continue;
          const depth = (a.z + b.z) / 2;
          if (depth < lo || depth >= hi) {
            drawing = false;
            continue;
          }
          if (!drawing) {
            ctx.moveTo(a.x, a.y);
            drawing = true;
          }
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      }
    };

    for (let m = 0; m < MERIDIANS; m += 1) {
      const lon = (m / MERIDIANS) * Math.PI * 2;
      const points: Point[] = [];
      for (let s = 0; s <= MERIDIAN_STEPS; s += 1) {
        const lat = -Math.PI / 2 + (s / MERIDIAN_STEPS) * Math.PI;
        points.push(project(lat, lon));
      }
      strokeCurve(points);
    }

    for (let p = 1; p <= PARALLELS; p += 1) {
      const lat = -Math.PI / 2 + (p / (PARALLELS + 1)) * Math.PI;
      const isEquator = Math.abs(lat) < 1e-6;
      const points: Point[] = [];
      for (let s = 0; s <= PARALLEL_STEPS; s += 1) {
        const lon = (s / PARALLEL_STEPS) * Math.PI * 2;
        points.push(project(lat, lon));
      }
      strokeCurve(points, isEquator ? 0.07 : 0);
    }

    // One marker per project, spaced evenly around the equator. They sit on the
    // same longitudes the cards do, so a marker lines up with its card.
    for (let i = 0; i < markerCount; i += 1) {
      const lon = (i / markerCount) * Math.PI * 2;
      const point = project(0, lon);
      // Only the near hemisphere is visible; a marker behind the sphere would
      // read as a dot floating in space.
      if (point.z <= 0) continue;

      const depth = (point.z + 1) / 2;
      const radius = 2.4 + depth * 2.2;

      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(196, 223, 115, ${(0.35 + depth * 0.55).toFixed(3)})`;
      ctx.fill();

      // A halo so the marker reads as a location, not a stray pixel.
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 3.2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(196, 223, 115, ${(0.06 + depth * 0.14).toFixed(3)})`;
      ctx.stroke();
    }
  }

  function frame(time: number): void {
    if (destroyed) return;

    // Idle drift, so the globe is alive even when the carousel is still.
    if (lastTime > 0) {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      drift += DRIFT * dt;
    }
    lastTime = time;

    rotation += (getTargetRotation() + drift - rotation) * EASE;
    draw();
    raf = requestAnimationFrame(frame);
  }

  if (reducedMotion) {
    draw();
  } else {
    raf = requestAnimationFrame(frame);
  }

  return () => {
    destroyed = true;
    cancelAnimationFrame(raf);
  };
}
