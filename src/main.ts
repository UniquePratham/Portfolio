import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './styles/tokens.css';
import './styles/layout.css';

import Lenis from 'lenis';
import { initRouter, navigate, type Route } from './scripts/router';
import { initAtlas } from './scripts/atlas';
import { initPalette } from './scripts/palette';
import { initEntrance } from './scripts/entrance';
import {
  renderAtlas,
  renderWork,
  renderCase,
  renderOpenSource,
  renderSecurity,
  renderNotes,
  renderNote,
  renderPerson,
  renderCapabilities,
  renderArchive,
  renderContact,
  renderDiscipline,
  renderNotFound,
} from './scripts/views';

/* =========================================================================
   Element references
   ========================================================================= */

const outlet = document.getElementById('outlet') as HTMLElement;
const masthead = document.getElementById('masthead');
const menuToggle = document.getElementById('menu-toggle');
const mastheadNav = document.getElementById('masthead-nav');
const entranceSection = document.getElementById('entrance');
const entranceCanvas = document.getElementById('entrance-canvas') as HTMLCanvasElement | null;

/* =========================================================================
   Smooth scrolling
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
   Reveal on scroll
   ========================================================================= */

let revealObserver: IntersectionObserver | null = null;

function observeReveals(): void {
  revealObserver?.disconnect();

  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (targets.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('is-visible'));
    return;
  }

  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        revealObserver?.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
  );

  targets.forEach((t) => revealObserver?.observe(t));
}

/* =========================================================================
   Masthead
   ========================================================================= */

function updateNavState(path: string): void {
  mastheadNav?.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    const target = href.replace(/^#/, '');
    const active = target === path || (target !== '/' && path.startsWith(target));
    a.setAttribute('aria-current', String(active));
  });
}

/** The entrance belongs to the home route only. */
function syncEntrance(path: string): void {
  if (!entranceSection) return;
  const isHome = path === '/';
  entranceSection.hidden = !isHome;
  document.body.classList.toggle('is-home', isHome);

  // The person route uses the mineral-light surface, so the masthead inverts.
  document.body.setAttribute('data-surface', path === '/person' ? 'light' : 'dark');
}

menuToggle?.addEventListener('click', () => {
  const open = masthead?.getAttribute('data-open') === 'true';
  masthead?.setAttribute('data-open', String(!open));
  menuToggle.setAttribute('aria-expanded', String(!open));
});

mastheadNav?.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', () => {
    masthead?.setAttribute('data-open', 'false');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

let lastScroll = 0;
window.addEventListener(
  'scroll',
  () => {
    const y = window.scrollY;
    masthead?.setAttribute('data-scrolled', String(y > 24));

    // Hide the masthead when scrolling down past the entrance, show on scroll up.
    const goingDown = y > lastScroll;
    const pastEntrance = y > window.innerHeight * 0.8;
    masthead?.setAttribute('data-hidden', String(goingDown && pastEntrance));
    lastScroll = y;
  },
  { passive: true },
);

/* =========================================================================
   Routes
   ========================================================================= */

const routes: Route[] = [
  { pattern: /^\/$/, render: () => renderAtlas(), title: 'Pratham Agarwal — Engineering Atlas' },
  { pattern: /^\/work$/, render: () => renderWork(), title: 'Work — Pratham Agarwal' },
  {
    pattern: /^\/work\/([\w-]+)$/,
    render: ([slug]) => renderCase(slug ?? ''),
    title: 'Case study — Pratham Agarwal',
  },
  {
    pattern: /^\/open-source$/,
    render: () => renderOpenSource(),
    title: 'Open source — Pratham Agarwal',
  },
  { pattern: /^\/security$/, render: () => renderSecurity(), title: 'Security — Pratham Agarwal' },
  { pattern: /^\/notes$/, render: () => renderNotes(), title: 'Field notes — Pratham Agarwal' },
  {
    pattern: /^\/notes\/([\w-]+)$/,
    render: ([slug]) => renderNote(slug ?? ''),
    title: 'Note — Pratham Agarwal',
  },
  { pattern: /^\/person$/, render: () => renderPerson(), title: 'About — Pratham Agarwal' },
  {
    pattern: /^\/capabilities$/,
    render: () => renderCapabilities(),
    title: 'Capabilities — Pratham Agarwal',
  },
  { pattern: /^\/archive$/, render: () => renderArchive(), title: 'Archive — Pratham Agarwal' },
  { pattern: /^\/contact$/, render: () => renderContact(), title: 'Contact — Pratham Agarwal' },
  {
    pattern: /^\/systems$/,
    render: () => renderDiscipline('systems'),
    title: 'Systems — Pratham Agarwal',
  },
  {
    pattern: /^\/intelligence$/,
    render: () => renderDiscipline('ai'),
    title: 'Applied AI — Pratham Agarwal',
  },
  {
    pattern: /^\/product$/,
    render: () => renderDiscipline('product'),
    title: 'Product — Pratham Agarwal',
  },
  {
    pattern: /^\/tools$/,
    render: () => renderDiscipline('tools'),
    title: 'Developer tools — Pratham Agarwal',
  },
  { pattern: /^\/404$/, render: () => renderNotFound(), title: 'Not found — Pratham Agarwal' },
];

function bindFilters(): void {
  outlet.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-filter') ?? 'all';
      outlet.innerHTML = renderWork(value);
      bindFilters();
    });
  });
}

initRouter({
  routes,
  outlet,
  onAfterRender(path) {
    syncEntrance(path);

    if (path === '/') {
      const svg = document.getElementById('atlas-svg') as SVGSVGElement | null;
      const readout = document.getElementById('atlas-readout') as HTMLElement | null;
      if (svg && readout) {
        initAtlas({ svg, readout, onNavigate: navigate });
      }
    }

    bindFilters();
    observeReveals();
    updateNavState(path);
  },
});

/* =========================================================================
   Command palette
   ========================================================================= */

const paletteRoot = document.getElementById('palette');
const paletteInput = document.getElementById('palette-input') as HTMLInputElement | null;
const paletteResults = document.getElementById('palette-results') as HTMLUListElement | null;

if (paletteRoot && paletteInput && paletteResults) {
  initPalette({
    root: paletteRoot,
    input: paletteInput,
    results: paletteResults,
    onNavigate: navigate,
  });
}

/* =========================================================================
   Entrance portrait
   ========================================================================= */

if (entranceCanvas && entranceSection) {
  initEntrance({ canvas: entranceCanvas, section: entranceSection });
}

/* =========================================================================
   Footer year
   ========================================================================= */

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
