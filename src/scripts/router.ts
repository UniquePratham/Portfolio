/**
 * Hash router.
 *
 * Every destination and case study is a real URL, so a link can be shared and
 * the back button works. Routes are declared in one table; the renderer is
 * chosen from it.
 */
export interface Route {
  pattern: RegExp;
  render: (params: string[]) => string;
  title: string;
}

export interface RouterOptions {
  routes: Route[];
  outlet: HTMLElement;
  onAfterRender?: (path: string) => void;
}

export function initRouter({ routes, outlet, onAfterRender }: RouterOptions): void {
  function currentPath(): string {
    const hash = window.location.hash.replace(/^#/, '');
    return hash === '' ? '/' : hash;
  }

  function render() {
    const path = currentPath();

    for (const route of routes) {
      const match = route.pattern.exec(path);
      if (!match) continue;

      outlet.innerHTML = route.render(match.slice(1));
      document.title = route.title;

      // Move focus to the new view for screen-reader and keyboard users, but
      // never steal focus from an open dialog.
      const dialogOpen = document.querySelector('[role="dialog"][data-open="true"]');
      const heading = outlet.querySelector<HTMLElement>('h1');
      if (heading && !dialogOpen) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
        // Drop the tabindex after focus so the heading is not a tab stop.
        heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), { once: true });
      }

      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      onAfterRender?.(path);
      return;
    }

    // Unknown route: fall back to the atlas.
    window.location.hash = '#/';
  }

  window.addEventListener('hashchange', render);
  render();
}

export function navigate(href: string): void {
  const target = href.startsWith('#') ? href : `#${href}`;
  if (window.location.hash === target) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  window.location.hash = target;
}
