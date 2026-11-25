/**
 * List reflow animation, with @formkit/auto-animate.
 *
 * The project filters currently snap: cards disappear and the carousel rebuilds
 * with no transition. auto-animate watches a container and animates whatever
 * changes inside it — 11 kB, one call, and every list on the site gets the same
 * behaviour for free.
 *
 * It is applied to the archive list and the capability lists, which are the two
 * places where items genuinely appear and disappear.
 */
export interface AutoAnimateOptions {
  reducedMotion: boolean;
}

export interface AutoAnimateHandle {
  destroy: () => void;
}

export function initAutoAnimate({ reducedMotion }: AutoAnimateOptions): AutoAnimateHandle {
  if (reducedMotion) return { destroy: () => {} };

  let destroyed = false;
  let cleanups: Array<() => void> = [];

  void import('@formkit/auto-animate').then((mod) => {
    if (destroyed) return;

    const targets = document.querySelectorAll<HTMLElement>('.collab, .cap ul, .filters');

    for (const el of targets) {
      const controller = mod.default(el, {
        duration: 220,
        easing: 'ease-out',
      });
      cleanups.push(() => controller.disable());
    }
  });

  return {
    destroy: () => {
      destroyed = true;
      cleanups.forEach((fn) => fn());
      cleanups = [];
    },
  };
}
