/**
 * An ink guestbook, drawn with atrament.
 *
 * The footer already has a pen writing the owner's signature. This is the
 * visitor's turn: a canvas they can actually sign, with real ink behaviour —
 * stroke width follows velocity, so a fast flick is thin and a slow press is
 * heavy. That is the same physical model the signature animation imitates.
 *
 * Strokes are kept in memory and can be cleared. Nothing is uploaded: the
 * drawing never leaves the device, which is the only honest promise a static
 * site can make about a canvas.
 */
export interface InkOptions {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  clearButton: HTMLButtonElement;
  reducedMotion: boolean;
}

export interface InkHandle {
  destroy: () => void;
}

export function initInk({ root, canvas, clearButton }: InkOptions): InkHandle {
  let destroyed = false;
  let handle: InkHandle | null = null;

  const loader = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        loader.disconnect();
        void import('atrament').then((mod) => {
          if (destroyed) return;
          handle = mount(mod.default, canvas, clearButton);
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
  Atrament: typeof import('atrament').default,
  canvas: HTMLCanvasElement,
  clearButton: HTMLButtonElement,
): InkHandle {
  let destroyed = false;

  // Size the bitmap to the element, once. Resizing a canvas clears it, so this
  // must not run on every frame or the visitor's stroke would vanish.
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ink = new Atrament(canvas, {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    color: '#c4df73',
    weight: 2.2,
    smoothing: 0.6,
    adaptiveStroke: true,
    mode: 'draw',
  });

  // Atrament works in CSS pixels; the bitmap is scaled by DPR.
  ink.canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);

  const onClear = () => ink.clear();
  clearButton.addEventListener('click', onClear);

  return {
    destroy: () => {
      destroyed = true;
      clearButton.removeEventListener('click', onClear);
      if (destroyed) ink.destroy();
    },
  };
}
