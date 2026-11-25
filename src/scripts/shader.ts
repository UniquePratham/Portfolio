/**
 * A contour shader behind the entrance, drawn with ogl.
 *
 * The site's visual language is a topographic map — the atlas is literally
 * contour lines. This puts the same idea behind the hero as a live fragment
 * shader: slow-moving iso-lines in the accent colour, at very low opacity, so it
 * reads as paper texture rather than a background effect.
 *
 * ogl is a ~42 kB minimal WebGL wrapper. three.js would be 600 kB for the same
 * single quad.
 */
export interface ShaderOptions {
  canvas: HTMLCanvasElement;
  reducedMotion: boolean;
}

export interface ShaderHandle {
  destroy: () => void;
}

export function initShader({ canvas, reducedMotion }: ShaderOptions): ShaderHandle {
  let destroyed = false;
  let handle: ShaderHandle | null = null;

  // Observe the section, not the canvas. The canvas is absolutely positioned and
  // has no intrinsic size until the renderer runs, so observing it directly can
  // report a zero-area target that never intersects.
  const target = canvas.closest('section') ?? canvas;

  const loader = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        loader.disconnect();
        void import('ogl').then((mod) => {
          if (destroyed) return;
          handle = mount(mod, canvas, reducedMotion);
        });
      }
    },
    { rootMargin: '50% 0px' },
  );
  loader.observe(target);

  return {
    destroy: () => {
      destroyed = true;
      loader.disconnect();
      handle?.destroy();
    },
  };
}

const VERT = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Iso-lines from a sum of slow sine fields. The contour band is produced by
// taking the fractional part of the field and thresholding it, which gives
// evenly spaced lines without any texture lookup.
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;

float field(vec2 p, float t) {
  float v = 0.0;
  v += sin(p.x * 2.1 + t * 0.22) * 0.5;
  v += sin(p.y * 1.7 - t * 0.17) * 0.5;
  v += sin((p.x + p.y) * 1.3 + t * 0.13) * 0.35;
  v += sin(length(p - 0.5) * 6.0 - t * 0.3) * 0.4;
  return v;
}

void main() {
  vec2 p = vUv * vec2(uRes.x / uRes.y, 1.0);
  float v = field(p, uTime);

  // Contour lines: the distance to the nearest integer level of the field.
  // A fixed band width rather than fwidth — the derivatives extension is not
  // available in every WebGL1 context, and a constant width is stable here
  // because the field's frequency does not change with zoom.
  float level = v * 2.2;
  float d = abs(fract(level) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.055, d);

  // Fade toward the edges so the shader never fights the page frame.
  vec2 e = abs(vUv - 0.5) * 2.0;
  float vignette = 1.0 - smoothstep(0.45, 1.1, max(e.x, e.y));

  vec3 accent = vec3(0.769, 0.874, 0.451);
  float alpha = line * vignette * 0.5;

  gl_FragColor = vec4(accent, alpha);
}
`;

function mount(
  { Renderer, Program, Mesh, Triangle }: typeof import('ogl'),
  canvas: HTMLCanvasElement,
  reducedMotion: boolean,
): ShaderHandle {
  let destroyed = false;
  let raf = 0;

  const renderer = new Renderer({
    canvas,
    alpha: true,
    antialias: false,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  // ogl writes inline `width`/`height` on the canvas, which beats the
  // stylesheet. Clear them so the CSS `inset: 0` sizing applies, then let
  // `setSize` drive the bitmap.
  canvas.style.removeProperty('width');
  canvas.style.removeProperty('height');

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      // A plain JS array trips ogl's texture-array branch: it checks
      // `value.length && value[0].texture`, and a number has no `.texture`, so
      // it falls into a `.forEach` on a number. A Float32Array has no `.length`
      // in the same sense and takes the scalar path.
      uRes: { value: new Float32Array([1, 1]) },
    },
  });
  const mesh = new Mesh(gl, { geometry, program });

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    renderer.setSize(rect.width, rect.height);
    program.uniforms.uRes.value = new Float32Array([rect.width, rect.height]);
  }

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  if (reducedMotion) {
    // One frame, no animation. The texture is still there, just still.
    program.uniforms.uTime.value = 12;
    renderer.render({ scene: mesh });
    return {
      destroy: () => {
        destroyed = true;
        observer.disconnect();
        cancelAnimationFrame(raf);
      },
    };
  }

  const start = performance.now();
  function frame(): void {
    if (destroyed) return;
    program.uniforms.uTime.value = (performance.now() - start) / 1000;
    renderer.render({ scene: mesh });
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy: () => {
      destroyed = true;
      observer.disconnect();
      cancelAnimationFrame(raf);
    },
  };
}
