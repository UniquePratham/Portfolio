import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './styles/tokens.css';
import './styles/layout.css';

import Lenis from 'lenis';
import { initAtlas } from './scripts/atlas';
import { initPalette } from './scripts/palette';
import { initEntrance } from './scripts/entrance';
import { initCarousel } from './scripts/carousel';
import { initGlobe } from './scripts/globe';
import { initSignature } from './scripts/signature';
import { initPlayground } from './scripts/playground';
import { initChart } from './scripts/chart';
import { initAnnotations } from './scripts/annotate';
import { initGraph } from './scripts/graph';
import { initVoronoi } from './scripts/voronoi';
import { initInk } from './scripts/ink';
import { initScroll } from './scripts/scroll';
import { initShader } from './scripts/shader';
import { initTour } from './scripts/tour';
import { initSeries } from './scripts/series';
import { initPlot } from './scripts/plot';
import { initZdog } from './scripts/zdog';
import { initMorph } from './scripts/morph';
import { initAutoAnimate } from './scripts/autoanimate';
import { initSound } from './scripts/sound';
import {
  renderAtlas,
  renderWork,
  renderOpenSource,
  renderSecurity,
  renderNotes,
  renderPerson,
  renderCapabilities,
  renderPlayground,
  renderMeasured,
  renderGraph,
  renderSeries,
  renderPlot,
  renderInk,
  renderForm,
  renderArchive,
  renderContact,
} from './scripts/sections';
import { CAPABILITIES, PROJECTS, DESTINATIONS } from './data/content';

/* =========================================================================
   One page, rendered once
   ========================================================================= */

const outlet = document.getElementById('outlet') as HTMLElement;

outlet.innerHTML = [
  renderAtlas(),
  renderWork(),
  renderOpenSource(),
  renderSecurity(),
  renderNotes(),
  renderPerson(),
  renderCapabilities(),
  renderPlayground(),
  renderMeasured(),
  renderGraph(),
  renderSeries(),
  renderPlot(),
  renderInk(),
  renderForm(),
  renderArchive(),
  renderContact(),
].join('');

/* =========================================================================
   Smooth scrolling — created once
   ========================================================================= */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const lenis = reducedMotion
  ? null
  : new Lenis({
      duration: 1.0,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });

if (lenis) {
  const raf = (time: number) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

/* =========================================================================
   Anchor navigation — every internal link is a #id, never a new document
   ========================================================================= */

const masthead = document.getElementById('masthead');
const menuToggle = document.getElementById('menu-toggle');
const mastheadNav = document.getElementById('masthead-nav');
const entranceSection = document.getElementById('entrance');

const HEADER_OFFSET = 88;

/**
 * Scroll to a section by id.
 *
 * The target position is computed here and passed to Lenis as an absolute
 * number, so there is exactly one source of truth for the offset. Passing
 * `offset` to Lenis while also relying on `scroll-margin-top` double-counts it.
 */
function scrollToId(id: string, smooth = true): void {
  const target = document.getElementById(id);
  if (!target) return;

  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET);

  if (lenis) {
    lenis.scrollTo(top, { duration: smooth ? 1.1 : 0, immediate: !smooth });
  } else {
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }
}

function currentId(): string {
  return window.location.hash.replace(/^#/, '');
}

/** Intercept every same-document anchor so the browser never jumps abruptly. */
document.addEventListener('click', (event) => {
  const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
  if (!anchor) return;

  const href = anchor.getAttribute('href') ?? '';
  // A bare "#" is not a destination.
  if (href === '#' || href === '') return;

  // Let modifier-clicks open a new tab with the anchor intact.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

  const id = href.slice(1);
  const target = document.getElementById(id);
  if (!target) return;

  event.preventDefault();

  // Update the URL without adding a history entry for every scroll.
  if (currentId() !== id) {
    window.history.pushState(null, '', `#${id}`);
  }

  scrollToId(id);
  closeMenu();
});

/** Deep link: a hash on load must land on the right section. */
function applyInitialHash(): void {
  const id = currentId();
  if (!id) return;

  const jump = () => {
    const target = document.getElementById(id);
    if (!target) return;
    // Instant, not smooth: a smooth scroll on load looks like a glitch.
    const top = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top, behavior: 'auto' });
  };

  // Layout, fonts and the portrait all change section heights after first
  // paint, so re-apply once each settles.
  requestAnimationFrame(() => {
    requestAnimationFrame(jump);
  });

  if ('fonts' in document) {
    void document.fonts.ready.then(() => {
      requestAnimationFrame(jump);
    });
  }

  window.addEventListener('load', () => requestAnimationFrame(jump), { once: true });
}

applyInitialHash();

window.addEventListener('popstate', () => {
  const id = currentId();
  if (id) scrollToId(id, false);
  else window.scrollTo({ top: 0, behavior: 'auto' });
});

// A hash set programmatically, or by a link the click handler did not catch,
// fires `hashchange` rather than `popstate`. Both must scroll.
window.addEventListener('hashchange', () => {
  const id = currentId();
  if (!id) return;
  // Skip if the click handler already scrolled to this target.
  const target = document.getElementById(id);
  if (!target) return;
  const top = target.getBoundingClientRect().top;
  if (Math.abs(top - HEADER_OFFSET) < 4) return;
  scrollToId(id);
});

/* =========================================================================
   Masthead
   ========================================================================= */

function closeMenu(): void {
  masthead?.setAttribute('data-open', 'false');
  menuToggle?.setAttribute('aria-expanded', 'false');
}

menuToggle?.addEventListener('click', () => {
  const open = masthead?.getAttribute('data-open') === 'true';
  masthead?.setAttribute('data-open', String(!open));
  menuToggle?.setAttribute('aria-expanded', String(!open));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

let lastScroll = 0;
window.addEventListener(
  'scroll',
  () => {
    const y = window.scrollY;
    masthead?.setAttribute('data-scrolled', String(y > 24));

    const goingDown = y > lastScroll;
    const pastEntrance = y > window.innerHeight * 0.8;
    masthead?.setAttribute('data-hidden', String(goingDown && pastEntrance));
    lastScroll = y;
  },
  { passive: true },
);

/* =========================================================================
   Active section in the masthead
   ========================================================================= */

const SECTION_IDS = [
  'atlas',
  'work',
  'open-source',
  'security',
  'notes',
  'person',
  'capabilities',
  'playground',
  'measured',
  'graph',
  'series',
  'timeline-plot',
  'ink',
  'form',
  'archive',
  'contact',
];

const sectionEls = SECTION_IDS.map((id) => document.getElementById(id)).filter(
  (el): el is HTMLElement => el !== null,
);

function setActiveSection(id: string): void {
  mastheadNav?.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
    const target = (a.getAttribute('href') ?? '').replace(/^#/, '');
    a.setAttribute('aria-current', String(target === id));
  });
}

if ('IntersectionObserver' in window && sectionEls.length > 0) {
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        setActiveSection(entry.target.id);
      }
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  sectionEls.forEach((el) => spy.observe(el));
}

/* =========================================================================
   Reveal on scroll
   ========================================================================= */

const revealTargets = document.querySelectorAll<HTMLElement>('[data-reveal]');

if (revealTargets.length > 0) {
  if (!('IntersectionObserver' in window)) {
    revealTargets.forEach((t) => t.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    revealTargets.forEach((t) => revealObserver.observe(t));
  }
}

/* =========================================================================
   Project filters — in place, and they drive the carousel
   ========================================================================= */

const filterButtons = document.querySelectorAll<HTMLButtonElement>('[data-filter]');
const carouselRoot = document.getElementById('carousel');
const carouselStage = document.getElementById('carousel-stage');
const carouselGlobe = document.getElementById('carousel-globe') as HTMLCanvasElement | null;
const emptyState = document.querySelector<HTMLElement>('[data-empty]');

let carouselCleanup: (() => void) | null = null;
let globeCleanup: (() => void) | null = null;

function mountCarousel(): void {
  if (!carouselRoot || !carouselStage) return;

  carouselCleanup?.();
  globeCleanup?.();

  const handle = initCarousel({ root: carouselRoot, stage: carouselStage });
  carouselCleanup = handle.destroy;

  if (carouselGlobe) {
    globeCleanup = initGlobe({
      canvas: carouselGlobe,
      getTargetRotation: handle.targetRotation,
      markerCount: document.querySelectorAll('.carousel__card:not([hidden])').length,
      reducedMotion: handle.reducedMotion,
    });
  }
}

mountCarousel();

function applyFilter(value: string): void {
  const cards = document.querySelectorAll<HTMLElement>('.carousel__card');
  let shown = 0;

  cards.forEach((card) => {
    const match = value === 'all' || card.dataset.discipline === value;
    card.hidden = !match;
    if (match) shown += 1;
  });

  filterButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === value)));
  if (emptyState) emptyState.hidden = shown > 0;

  // Rebuild the carousel over the visible cards so the ring stays coherent.
  mountCarousel();
}

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => applyFilter(btn.dataset.filter ?? 'all'));
});

/* =========================================================================
   Atlas
   ========================================================================= */

const atlasSvg = document.getElementById('atlas-svg') as SVGSVGElement | null;
const atlasReadout = document.getElementById('atlas-readout');

if (atlasSvg && atlasReadout) {
  initAtlas({
    svg: atlasSvg,
    readout: atlasReadout,
    onNavigate: (href) => {
      const id = href.replace(/^#/, '');
      if (currentId() !== id) window.history.pushState(null, '', `#${id}`);
      scrollToId(id);
    },
  });
}

/* =========================================================================
   Command palette — mounted once
   ========================================================================= */

const paletteRoot = document.getElementById('palette');
const paletteInput = document.getElementById('palette-input') as HTMLInputElement | null;
const paletteResults = document.getElementById('palette-results') as HTMLUListElement | null;

if (paletteRoot && paletteInput && paletteResults) {
  initPalette({
    root: paletteRoot,
    input: paletteInput,
    results: paletteResults,
    onNavigate: (href) => {
      const id = href.replace(/^#/, '');
      if (currentId() !== id) window.history.pushState(null, '', `#${id}`);
      scrollToId(id);
    },
  });
}

/* =========================================================================
   Entrance portrait — mounted once
   ========================================================================= */

const entranceCanvas = document.getElementById('entrance-canvas') as HTMLCanvasElement | null;

if (entranceCanvas && entranceSection) {
  initEntrance({ canvas: entranceCanvas, section: entranceSection });
}

/* =========================================================================
   "Enter the atlas"
   ========================================================================= */

document.querySelectorAll<HTMLElement>('[data-scroll-to-atlas]').forEach((el) => {
  el.addEventListener('click', (event) => {
    event.preventDefault();
    if (currentId() !== 'atlas') window.history.pushState(null, '', '#atlas');
    scrollToId('atlas');
  });
});

/* =========================================================================
   Footer year
   ========================================================================= */

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

/* =========================================================================
   Playground — Matter.js physics
   ========================================================================= */

const playgroundRoot = document.getElementById('playground-root');
const playgroundCanvas = document.getElementById('playground-canvas') as HTMLCanvasElement | null;

if (playgroundRoot && playgroundCanvas) {
  initPlayground({
    root: playgroundRoot,
    canvas: playgroundCanvas,
    labels: CAPABILITIES.flatMap((c) => c.items.map((i) => i.name)),
    reducedMotion,
  });
}

/* =========================================================================
   Measured — D3 chart of real results
   ========================================================================= */

const measuredRoot = document.getElementById('measured');
const measuredSvg = document.getElementById('measured-chart') as SVGSVGElement | null;

if (measuredRoot && measuredSvg) {
  initChart({
    root: measuredRoot,
    svg: measuredSvg,
    reducedMotion,
    data: [
      { label: 'Segment error', value: 22.4, baseline: 41.6, unit: 's' },
      { label: 'Journey error', value: 0.93, baseline: 1.86, unit: 'min' },
    ],
  });
}

/* =========================================================================
   Hand-drawn emphasis
   ========================================================================= */

initAnnotations({ root: document, reducedMotion });

/* =========================================================================
   Force-directed network of projects and technologies
   ========================================================================= */

const graphRoot = document.getElementById('graph-root');
const graphSvg = document.getElementById('graph-svg') as SVGSVGElement | null;

if (graphRoot && graphSvg) {
  initGraph({
    root: graphRoot,
    svg: graphSvg,
    reducedMotion,
    projects: PROJECTS.map((p) => ({ slug: p.slug, title: p.title, stack: p.stack })),
  });
}

/* =========================================================================
   Voronoi hover regions on the atlas
   ========================================================================= */

if (atlasSvg && atlasReadout) {
  initVoronoi({
    svg: atlasSvg,
    reducedMotion,
    points: DESTINATIONS.map((d) => ({
      id: d.id,
      label: d.label,
      x: d.x,
      y: d.y,
      hint: d.hint,
    })),
    onHover: (point) => {
      if (!point) return;
      atlasReadout.textContent = `${point.label} — ${point.hint}`;
    },
  });
}

/* =========================================================================
   Ink guestbook
   ========================================================================= */

const inkRoot = document.getElementById('ink-root');
const inkCanvas = document.getElementById('ink-canvas') as HTMLCanvasElement | null;
const inkClear = document.getElementById('ink-clear') as HTMLButtonElement | null;

if (inkRoot && inkCanvas && inkClear) {
  initInk({ root: inkRoot, canvas: inkCanvas, clearButton: inkClear, reducedMotion });
}

/* =========================================================================
   Scroll-driven typography (GSAP)
   ========================================================================= */

initScroll({ reducedMotion });

/* =========================================================================
   Contour shader behind the entrance (ogl)
   ========================================================================= */

const shaderCanvas = document.getElementById('entrance-shader') as HTMLCanvasElement | null;
if (shaderCanvas) initShader({ canvas: shaderCanvas, reducedMotion });

/* =========================================================================
   Guided tour (driver.js)
   ========================================================================= */

const tourButton = document.getElementById('tour-start') as HTMLButtonElement | null;
if (tourButton) initTour({ trigger: tourButton, reducedMotion });

/* =========================================================================
   Time series (uPlot)
   ========================================================================= */

const seriesRoot = document.getElementById('series-root');
const seriesChart = document.getElementById('series-chart');
if (seriesRoot && seriesChart) {
  initSeries({ root: seriesRoot, container: seriesChart, reducedMotion });
}

/* =========================================================================
   Distribution plot (Observable Plot)
   ========================================================================= */

const plotRoot = document.getElementById('plot-root');
const plotChart = document.getElementById('plot-chart');
if (plotRoot && plotChart) {
  initPlot({
    root: plotRoot,
    container: plotChart,
    reducedMotion,
    data: PROJECTS.map((p) => ({ title: p.title, year: p.year, discipline: p.discipline })),
  });
}

/* =========================================================================
   Pseudo-3D globe (Zdog)
   ========================================================================= */

const zdogCanvas = document.getElementById('zdog-canvas') as HTMLCanvasElement | null;
if (zdogCanvas) initZdog({ canvas: zdogCanvas, reducedMotion });

/* =========================================================================
   Contour morph (flubber)
   ========================================================================= */

const morphPath = document.getElementById('morph-path') as SVGPathElement | null;
const morphRoot = document.getElementById('morph-root');
if (morphPath && morphRoot) initMorph({ root: morphRoot, path: morphPath, reducedMotion });

/* =========================================================================
   List reflow animation
   ========================================================================= */

initAutoAnimate({ reducedMotion });

/* =========================================================================
   Interface sound (Howler)
   ========================================================================= */

const soundToggle = document.getElementById('sound-toggle') as HTMLButtonElement | null;
if (soundToggle) initSound({ toggle: soundToggle, reducedMotion });

/* =========================================================================
   Footer signature — a pen writing the name, on a loop
   ========================================================================= */

const signatureCanvas = document.getElementById('footer-signature') as HTMLCanvasElement | null;

if (signatureCanvas) {
  initSignature({
    canvas: signatureCanvas,
    src: '/signature.png',
    reducedMotion,
  });
}
