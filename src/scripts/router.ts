/**
 * Hash router with a real view lifecycle.
 *
 * One document, one shell. Only the outlet's contents change. Each route may
 * return a cleanup function, which runs before the next view is mounted, so
 * observers and listeners cannot accumulate across navigations.
 */

export interface RouteContext {
  /** Route parameters, in capture-group order. */
  params: string[];
  /** The full path, e.g. `/work/terminator`. */
  path: string;
}

export interface Route {
  pattern: RegExp;
  render: (ctx: RouteContext) => string;
  /** Document title for this route. */
  title: (ctx: RouteContext) => string;
  /** Meta description for this route. */
  description?: (ctx: RouteContext) => string;
  /** Runs after the view is in the DOM. Return a cleanup function. */
  mount?: (ctx: RouteContext, root: HTMLElement) => (() => void) | void;
}

export interface RouterOptions {
  routes: Route[];
  outlet: HTMLElement;
  /** Called after every successful navigation. */
  onNavigate?: (ctx: RouteContext) => void;
  /** Rendered when no route matches. */
  notFound: (path: string) => string;
}

const SCROLL_KEY = 'atlas:scroll';

/** Scroll positions per path, so Back returns you where you were. */
const scrollMemory = new Map<string, number>();

function readScrollMemory(): void {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, number>;
    for (const [key, value] of Object.entries(parsed)) scrollMemory.set(key, value);
  } catch {
    // Session storage is optional; ignore failures.
  }
}

function writeScrollMemory(): void {
  try {
    const obj: Record<string, number> = {};
    for (const [key, value] of scrollMemory) obj[key] = value;
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(obj));
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

export function currentPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash === '' ? '/' : hash;
}

export function navigate(href: string, options: { replace?: boolean } = {}): void {
  const target = href.startsWith('#') ? href.slice(1) : href;
  const next = target === '' ? '/' : target;

  if (currentPath() === next) {
    // Same route: scroll to top rather than pushing a duplicate history entry.
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (options.replace) {
    const url = `${window.location.pathname}${window.location.search}#${next}`;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }

  window.location.hash = next;
}

export function initRouter({ routes, outlet, onNavigate, notFound }: RouterOptions): void {
  readScrollMemory();

  let cleanup: (() => void) | void;
  let currentRoutePath: string | null = null;
  let transitionToken = 0;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name'): void {
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, name);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  }

  function render(): void {
    const path = currentPath();
    const token = ++transitionToken;

    // Remember where the outgoing view was, so Back can restore it.
    if (currentRoutePath) scrollMemory.set(currentRoutePath, window.scrollY);
    writeScrollMemory();

    // Tear down the previous view before mounting the next one.
    if (typeof cleanup === 'function') {
      cleanup();
      cleanup = undefined;
    }

    let matched: { route: Route; params: string[] } | null = null;
    for (const route of routes) {
      const match = route.pattern.exec(path);
      if (match) {
        matched = { route, params: match.slice(1) };
        break;
      }
    }

    const ctx: RouteContext = { params: matched?.params ?? [], path };

    const apply = () => {
      if (token !== transitionToken) return;

      outlet.innerHTML = matched ? matched.route.render(ctx) : notFound(path);

      const title = matched ? matched.route.title(ctx) : 'Not found — Pratham Agarwal';
      document.title = title;
      setMeta('og:title', title, 'property');
      setMeta('twitter:title', title);

      const description = matched?.route.description?.(ctx);
      if (description) {
        setMeta('description', description);
        setMeta('og:description', description, 'property');
        setMeta('twitter:description', description);
      }

      // Restore scroll for a revisited route, otherwise start at the top.
      const remembered = scrollMemory.get(path);
      const isBack = remembered !== undefined && remembered > 0;
      window.scrollTo({ top: isBack ? remembered : 0, behavior: 'instant' as ScrollBehavior });

      // Focus the new heading for keyboard and screen-reader users, unless a
      // dialog is open (the palette must keep focus).
      const dialogOpen = document.querySelector('[role="dialog"][data-open="true"]');
      const heading = outlet.querySelector<HTMLElement>('h1');
      if (heading && !dialogOpen) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
        heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true });
      }

      cleanup = matched?.route.mount?.(ctx, outlet);
      currentRoutePath = path;
      onNavigate?.(ctx);
    };

    if (reducedMotion || !currentRoutePath) {
      apply();
      return;
    }

    // Restrained cross-fade: the old view leaves, the new one arrives.
    outlet.setAttribute('data-leaving', 'true');
    window.setTimeout(() => {
      if (token !== transitionToken) return;
      apply();
      outlet.removeAttribute('data-leaving');
      outlet.setAttribute('data-entering', 'true');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => outlet.removeAttribute('data-entering'));
      });
    }, 130);
  }

  window.addEventListener('hashchange', render);

  // A hash URL opened directly must render the right destination.
  render();
}
