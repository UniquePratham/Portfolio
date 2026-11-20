import type Lenis from 'lenis';

interface UiOptions {
  lenis: Lenis | null;
}

export function initUi({ lenis }: UiOptions): void {
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  /* --- Nav: scrolled state --------------------------------------------- */
  const onScroll = () => {
    const scrolled = window.scrollY > 24;
    nav?.setAttribute('data-scrolled', String(scrolled));
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* --- Nav: mobile menu ------------------------------------------------ */
  const closeMenu = () => {
    nav?.setAttribute('data-open', 'false');
    navToggle?.setAttribute('aria-expanded', 'false');
  };

  navToggle?.addEventListener('click', () => {
    const open = nav?.getAttribute('data-open') === 'true';
    nav?.setAttribute('data-open', String(!open));
    navToggle.setAttribute('aria-expanded', String(!open));
  });

  navLinks?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  /* --- Anchor scrolling ------------------------------------------------ */
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;

      event.preventDefault();
      if (lenis) {
        lenis.scrollTo(target as HTMLElement, { offset: -72, duration: 1.2 });
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* --- Reveal on scroll ------------------------------------------------ */
  const revealables = document.querySelectorAll<HTMLElement>('[data-reveal]');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );

    revealables.forEach((el) => observer.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-visible'));
  }

  /* --- Active section in nav ------------------------------------------- */
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>('main section[id]'),
  ).filter((section) => section.id !== 'top');

  if ('IntersectionObserver' in window && sections.length > 0) {
    const navAnchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('.nav__links a'),
    );

    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.id;
          navAnchors.forEach((anchor) => {
            const active = anchor.getAttribute('href') === `#${id}`;
            anchor.setAttribute('aria-current', String(active));
          });
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );

    sections.forEach((section) => spy.observe(section));
  }

  /* --- Footer year ----------------------------------------------------- */
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
}
