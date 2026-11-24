/**
 * 3D project carousel.
 *
 * Cards are laid out on a cylinder: each one is rotated around the Y axis and
 * pushed back in Z, so the active card faces the viewer and its neighbours
 * recede. Only the active card is interactive; the rest are inert and dimmed.
 *
 * Input: arrow buttons, dots, keyboard (arrows, Home/End), drag, and wheel when
 * the pointer is over the stage. Every path funnels through `goTo`, so the
 * state can never desync.
 */

interface CarouselOptions {
  root: HTMLElement;
  stage: HTMLElement;
  onActiveChange?: (index: number) => void;
}

const ANGLE_STEP = 34;
const RADIUS = 620;
const VISIBLE_RANGE = 2;

export function initCarousel({ root, stage, onActiveChange }: CarouselOptions): () => void {
  const cards = Array.from(stage.querySelectorAll<HTMLElement>('.carousel__card'));
  if (cards.length === 0) return () => {};

  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-goto]'));
  const arrows = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-dir]'));
  const toggles = Array.from(root.querySelectorAll<HTMLButtonElement>('.acc__toggle'));

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let active = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartIndex = 0;
  let dragMoved = false;

  const cleanups: Array<() => void> = [];
  const on = (target: EventTarget, type: string, handler: EventListener, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, handler, opts);
    cleanups.push(() => target.removeEventListener(type, handler, opts));
  };

  /* --- Layout ---------------------------------------------------------- */

  function layout(): void {
    cards.forEach((card, i) => {
      // Shortest signed distance from the active card, so the ring wraps.
      let offset = i - active;
      const half = cards.length / 2;
      if (offset > half) offset -= cards.length;
      if (offset < -half) offset += cards.length;

      const abs = Math.abs(offset);
      const visible = abs <= VISIBLE_RANGE;

      const angle = offset * ANGLE_STEP;
      const z = -abs * (RADIUS / VISIBLE_RANGE) * 0.55;
      const x = Math.sin((angle * Math.PI) / 180) * RADIUS * 0.42;
      const scale = 1 - abs * 0.12;
      const opacity = visible ? 1 - abs * 0.28 : 0;

      card.style.transform = `translate3d(${x}px, 0, ${z}px) rotateY(${-angle}deg) scale(${scale})`;
      card.style.opacity = String(Math.max(0, opacity));
      card.style.zIndex = String(100 - abs);
      card.style.pointerEvents = offset === 0 ? 'auto' : 'none';
      card.setAttribute('aria-hidden', String(offset !== 0));
      card.toggleAttribute('inert', offset !== 0);
      card.dataset.offset = String(offset);
    });

    dots.forEach((dot, i) => {
      dot.setAttribute('aria-selected', String(i === active));
    });

    root.setAttribute('data-active', String(active));
    onActiveChange?.(active);
  }

  /* --- Navigation ------------------------------------------------------ */

  function goTo(index: number): void {
    const next = ((index % cards.length) + cards.length) % cards.length;
    if (next === active) return;
    active = next;

    // Collapse any open accordion when the carousel turns.
    toggles.forEach((t) => setExpanded(t, false));

    layout();
  }

  function step(delta: number): void {
    goTo(active + delta);
  }

  /* --- Accordion ------------------------------------------------------- */

  function setExpanded(toggle: HTMLButtonElement, expanded: boolean): void {
    const panelId = toggle.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    toggle.setAttribute('aria-expanded', String(expanded));
    if (panel) panel.hidden = !expanded;
    toggle.closest('.carousel__card')?.classList.toggle('is-open', expanded);
  }

  toggles.forEach((toggle) => {
    on(toggle, 'click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      setExpanded(toggle, !expanded);
    });
  });

  /* --- Controls -------------------------------------------------------- */

  arrows.forEach((arrow) => {
    on(arrow, 'click', () => step(Number(arrow.dataset.dir ?? '1')));
  });

  dots.forEach((dot) => {
    on(dot, 'click', () => goTo(Number(dot.dataset.goto ?? '0')));
  });

  on(root, 'keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    if (key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (key === 'Home') {
      event.preventDefault();
      goTo(0);
    } else if (key === 'End') {
      event.preventDefault();
      goTo(cards.length - 1);
    }
  });

  /* --- Drag ------------------------------------------------------------ */

  on(stage, 'pointerdown', (event) => {
    const e = event as PointerEvent;
    // Ignore drags that start on a control.
    if ((e.target as HTMLElement).closest('button, a')) return;
    dragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartIndex = active;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('is-dragging');
  });

  on(stage, 'pointermove', (event) => {
    if (!dragging) return;
    const e = event as PointerEvent;
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 6) dragMoved = true;
    // One card per ~180px of travel.
    const shift = Math.round(-dx / 180);
    const target = dragStartIndex + shift;
    if (target !== active) goTo(target);
  });

  const endDrag = (event: Event) => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-dragging');
    const e = event as PointerEvent;
    if (stage.hasPointerCapture?.(e.pointerId)) stage.releasePointerCapture(e.pointerId);
  };

  on(stage, 'pointerup', endDrag);
  on(stage, 'pointercancel', endDrag);

  // A drag must not also trigger a click on the card underneath.
  on(
    stage,
    'click',
    (event) => {
      if (dragMoved) {
        event.preventDefault();
        event.stopPropagation();
        dragMoved = false;
      }
    },
    { capture: true },
  );

  /* --- Wheel ----------------------------------------------------------- */

  let wheelLock = false;
  on(
    stage,
    'wheel',
    (event) => {
      const e = event as WheelEvent;
      // Only take over when the gesture is clearly horizontal.
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      step(e.deltaX > 0 ? 1 : -1);
      window.setTimeout(() => {
        wheelLock = false;
      }, 320);
    },
    { passive: false },
  );

  /* --- Boot ------------------------------------------------------------ */

  if (reducedMotion) {
    stage.classList.add('is-reduced');
  }

  layout();

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
