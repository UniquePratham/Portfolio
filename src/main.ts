import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './styles/tokens.css';
import './styles/layout.css';

import Lenis from 'lenis';
import { initRouter, navigate, type Route, type RouteContext } from './scripts/router';
import { initAtlas } from './scripts/atlas';
import { initPalette } from './scripts/palette';
import { initEntrance } from './scripts/entrance';
import { PROJECTS, FIELD_NOTES } from './data/content';
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
   Persistent shell references
   ========================================================================= */

const outlet = document.getElementById('outlet') as HTMLElement;
const masthead = document.getElementById('masthead');
const menuToggle = document.getElementById('menu-toggle');
const mastheadNav = document.getElementById('masthead-nav');
const entranceSection = document.getElementById('entrance');
const entranceCanvas = document.getElementById('entrance-canvas') as HTMLCanvasElement | null;

/* =========================================================================
   Smooth scrolling — created once, never per route
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
   Reveal on scroll — one observer, re-targeted per route
   ========================================================================= */

let revealObserver: IntersectionObserver | null = null;

function observeReveals(root: ParentNode = document): void {
  revealObserver?.disconnect();

  const targets = root.querySelectorAll<HTMLElement>('[data-reveal]');
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
function syncShell(path: string): void {
  if (entranceSection) {
    const isHome = path === '/';
    entranceSection.hidden = !isHome;
    document.body.classList.toggle('is-home', isHome);
  }
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

    const goingDown = y > lastScroll;
    const pastEntrance = y > window.innerHeight * 0.8;
    masthead?.setAttribute('data-hidden', String(goingDown && pastEntrance));
    lastScroll = y;
  },
  { passive: true },
);

/* =========================================================================
   Project filters — in place, no innerHTML replacement
   ========================================================================= */

function mountFilters(root: HTMLElement): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-filter]');
  const rows = root.querySelectorAll<HTMLElement>('.project-row');
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  if (buttons.length === 0) return;

  const apply = (value: string) => {
    let shown = 0;
    rows.forEach((row) => {
      const match = value === 'all' || row.dataset.discipline === value;
      row.hidden = !match;
      if (match) shown += 1;
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === value)));
    if (empty) empty.hidden = shown > 0;
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => apply(btn.dataset.filter ?? 'all'));
  });
}

/* =========================================================================
   Routes
   ========================================================================= */

function projectTitle(slug: string): string {
  return PROJECTS.find((p) => p.slug === slug)?.title ?? 'Project';
}

function noteTitle(slug: string): string {
  return FIELD_NOTES.find((n) => n.slug === slug)?.title ?? 'Note';
}

const routes: Route[] = [
  {
    pattern: /^\/$/,
    render: () => renderAtlas(),
    title: () => 'Pratham Agarwal — Engineering Atlas',
    description: () =>
      'Pratham Agarwal — full stack developer in Kolkata. Systems, applied AI and security work, with case studies and open-source contributions.',
    mount: (_ctx, root) => {
      const svg = root.querySelector<SVGSVGElement>('#atlas-svg');
      const readout = root.querySelector<HTMLElement>('#atlas-readout');
      if (!svg || !readout) return;
      initAtlas({ svg, readout, onNavigate: navigate });
      return () => {
        (svg as SVGSVGElement & { __cleanup?: () => void }).__cleanup?.();
      };
    },
  },
  {
    pattern: /^\/work$/,
    render: () => renderWork(),
    title: () => 'Work — Pratham Agarwal',
    description: () =>
      'Six engineering case studies: a terminal emulator in C, a local-first AI desktop app, an agentic fraud console, and more.',
    mount: (_ctx, root) => {
      mountFilters(root);
    },
  },
  {
    pattern: /^\/work\/([\w-]+)$/,
    render: ({ params }) => renderCase(params[0] ?? ''),
    title: ({ params }) => `${projectTitle(params[0] ?? '')} — Project Case Study | Pratham Agarwal`,
    description: ({ params }) => {
      const p = PROJECTS.find((x) => x.slug === params[0]);
      return p?.summary ?? 'Project case study.';
    },
  },
  {
    pattern: /^\/open-source$/,
    render: () => renderOpenSource(),
    title: () => 'Open Source — Pratham Agarwal',
    description: () =>
      'Merged pull requests into ollama/ollama and locally-uncensored, plus long-running collaboration on team builds.',
  },
  {
    pattern: /^\/security$/,
    render: () => renderSecurity(),
    title: () => 'Security — Pratham Agarwal',
    description: () => 'CTF record: 20+ events including DEADFACE CTF and boroCTF.',
  },
  {
    pattern: /^\/notes$/,
    render: () => renderNotes(),
    title: () => 'Field Notes — Pratham Agarwal',
    description: () => 'Short write-ups from actual engineering work.',
  },
  {
    pattern: /^\/notes\/([\w-]+)$/,
    render: ({ params }) => renderNote(params[0] ?? ''),
    title: ({ params }) => `${noteTitle(params[0] ?? '')} — Field Notes | Pratham Agarwal`,
    description: ({ params }) => FIELD_NOTES.find((n) => n.slug === params[0])?.summary ?? '',
  },
  {
    pattern: /^\/person$/,
    render: () => renderPerson(),
    title: () => 'About — Pratham Agarwal',
    description: () =>
      'M.Tech CSE at IIT Kharagpur, B.Tech at the University of Calcutta, and how I work.',
  },
  {
    pattern: /^\/capabilities$/,
    render: () => renderCapabilities(),
    title: () => 'Capabilities — Pratham Agarwal',
    description: () => 'Languages, frameworks and tools, grouped by engineering domain.',
  },
  {
    pattern: /^\/archive$/,
    render: () => renderArchive(),
    title: () => 'Archive — Pratham Agarwal',
    description: () => 'Earlier projects and experiments.',
  },
  {
    pattern: /^\/contact$/,
    render: () => renderContact(),
    title: () => 'Contact — Pratham Agarwal',
    description: () => 'Open to collaborations, freelance work and interesting problems.',
  },
  {
    pattern: /^\/systems$/,
    render: () => renderDiscipline('systems'),
    title: () => 'Systems — Pratham Agarwal',
    description: () => 'C, POSIX and low-level engineering.',
  },
  {
    pattern: /^\/intelligence$/,
    render: () => renderDiscipline('ai'),
    title: () => 'Applied AI — Pratham Agarwal',
    description: () => 'Applied AI, agents and grounded inference.',
  },
  {
    pattern: /^\/product$/,
    render: () => renderDiscipline('product'),
    title: () => 'Product — Pratham Agarwal',
    description: () => 'Full-stack systems with money and approvals in them.',
  },
  {
    pattern: /^\/tools$/,
    render: () => renderDiscipline('tools'),
    title: () => 'Developer Tools — Pratham Agarwal',
    description: () => 'Small, sharp utilities.',
  },
];

initRouter({
  routes,
  outlet,
  notFound: () => renderNotFound(),
  onNavigate(ctx: RouteContext) {
    syncShell(ctx.path);
    observeReveals(outlet);
    updateNavState(ctx.path);
  },
});

/* =========================================================================
   Command palette — mounted once, global
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
   Entrance portrait — mounted once
   ========================================================================= */

if (entranceCanvas && entranceSection) {
  initEntrance({ canvas: entranceCanvas, section: entranceSection });
}

/* =========================================================================
   "Enter the atlas" — scroll to the map, do not fake a route
   ========================================================================= */

document.querySelectorAll<HTMLElement>('[data-scroll-to-atlas]').forEach((el) => {
  el.addEventListener('click', (event) => {
    event.preventDefault();
    const atlas = document.querySelector('.atlas');
    if (!atlas) return;
    if (lenis) {
      lenis.scrollTo(atlas as HTMLElement, { offset: -72, duration: 1.1 });
    } else {
      atlas.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* =========================================================================
   Footer year
   ========================================================================= */

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());
