/**
 * Scroll-driven typography and section pinning, with GSAP.
 *
 * GSAP became 100% free including all plugins in 2025, so ScrollTrigger and
 * SplitText are available without a licence. This module replaces the old
 * IntersectionObserver reveal with a scroll-scrubbed system: headings split into
 * lines and rise as they enter, and the Measured section pins while its bars
 * draw.
 *
 * Everything is registered against `prefers-reduced-motion`: when it is set, the
 * module does nothing at all and the CSS reveal fallback stays in charge.
 */
export interface ScrollOptions {
  reducedMotion: boolean;
}

export interface ScrollHandle {
  destroy: () => void;
}

export function initScroll({ reducedMotion }: ScrollOptions): ScrollHandle {
  if (reducedMotion) return { destroy: () => {} };

  let destroyed = false;
  let handle: ScrollHandle | null = null;

  // GSAP is ~124 kB across core + ScrollTrigger + SplitText. It is loaded after
  // first paint so it never blocks the hero.
  const start = () => {
    void Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
      import('gsap/SplitText'),
    ]).then(([gsapMod, stMod, splitMod]) => {
      if (destroyed) return;
      handle = mount(gsapMod.gsap, stMod.ScrollTrigger, splitMod.SplitText);
    });
  };

  if ('requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(start);
  } else {
    setTimeout(start, 400);
  }

  return {
    destroy: () => {
      destroyed = true;
      handle?.destroy();
    },
  };
}

function mount(
  gsap: typeof import('gsap').gsap,
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger,
  SplitText: typeof import('gsap/SplitText').SplitText,
): ScrollHandle {
  gsap.registerPlugin(ScrollTrigger, SplitText);

  const splits: InstanceType<typeof SplitText>[] = [];
  const triggers: ScrollTrigger[] = [];

  // --- Section headings: split into lines, rise on entry -------------------
  document.querySelectorAll<HTMLElement>('.section-head__title').forEach((title) => {
    const split = new SplitText(title, { type: 'lines', linesClass: 'split-line' });
    splits.push(split);

    gsap.set(split.lines, { yPercent: 110, opacity: 0 });

    const tween = gsap.to(split.lines, {
      yPercent: 0,
      opacity: 1,
      duration: 0.9,
      stagger: 0.08,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: title,
        start: 'top 88%',
        once: true,
      },
    });

    if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
  });

  // --- Lede paragraphs: fade up, slightly behind the heading ---------------
  document.querySelectorAll<HTMLElement>('.section-head__lede').forEach((lede) => {
    gsap.from(lede, {
      y: 18,
      opacity: 0,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: lede, start: 'top 90%', once: true },
    });
  });

  // --- Measured: pin the chart while the bars draw -------------------------
  const measured = document.getElementById('measured');
  if (measured) {
    const st = ScrollTrigger.create({
      trigger: measured,
      start: 'top 70%',
      end: 'bottom 40%',
      onEnter: () => {
        measured.setAttribute('data-drawn', 'true');
      },
    });
    triggers.push(st);
  }

  // --- Atlas: parallax the contour field slightly --------------------------
  const atlasSvg = document.getElementById('atlas-svg');
  if (atlasSvg) {
    gsap.to(atlasSvg, {
      yPercent: -4,
      ease: 'none',
      scrollTrigger: {
        trigger: atlasSvg,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
      },
    });
  }

  return {
    destroy: () => {
      triggers.forEach((t) => t.kill());
      splits.forEach((s) => s.revert());
      ScrollTrigger.getAll().forEach((t) => t.kill());
    },
  };
}
