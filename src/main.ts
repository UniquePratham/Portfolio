import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import './styles/tokens.css';
import './styles/layout.css';

import Lenis from 'lenis';
import { initUi } from './scripts/ui';
import { initSequence } from './scripts/sequence';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const lenis = reducedMotion
  ? null
  : new Lenis({
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });

if (lenis) {
  const raf = (time: number) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

initUi({ lenis });

const preloader = document.getElementById('preloader');
const preloaderFill = document.getElementById('preloader-fill');
const preloaderCount = document.getElementById('preloader-count');
const preloaderLabel = document.getElementById('preloader-label');

let sequenceReady = false;

function dismissPreloader() {
  if (!sequenceReady) return;
  preloader?.setAttribute('data-state', 'done');
  document.body.classList.add('is-ready');
}

const sequence = initSequence({
  canvas: document.getElementById('sequence-canvas') as HTMLCanvasElement,
  section: document.getElementById('sequence') as HTMLElement,
  progressBar: document.getElementById('sequence-progress') as HTMLElement,
  currentLabel: document.getElementById('sequence-current') as HTMLElement,
  caption: document.getElementById('sequence-caption') as HTMLElement,
  onProgress(loaded, total) {
    const pct = Math.round((loaded / total) * 100);
    if (preloaderFill) preloaderFill.style.transform = `scaleX(${loaded / total})`;
    if (preloaderCount) preloaderCount.textContent = `${pct}%`;
    if (preloaderLabel && pct > 55) preloaderLabel.textContent = 'Almost there';
  },
  onFirstFrame() {
    sequenceReady = true;
    dismissPreloader();
  },
});

void sequence;

/* Three.js is ~520 kB, so it is imported only when the Lab section nears the
   viewport. The frame sequence gets the bandwidth first. */
const labStage = document.getElementById('lab-stage');
const labFallback = document.getElementById('lab-fallback');

if (labStage && labFallback) {
  const labObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      labObserver.disconnect();
      void import('./scripts/avatar').then(({ initAvatar }) => {
        initAvatar({ stage: labStage, fallback: labFallback });
      });
    },
    { rootMargin: '600px 0px' },
  );
  labObserver.observe(labStage);
}

// Safety net: never trap the visitor behind the preloader.
window.setTimeout(() => {
  sequenceReady = true;
  dismissPreloader();
}, 9000);
