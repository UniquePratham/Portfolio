/**
 * 3D project carousel on a globe.
 *
 * Cards sit on the surface of a sphere: each one is placed at its own longitude
 * on a fixed latitude, rotated to face outward, and pushed to the sphere's
 * radius. The wireframe globe behind them is drawn from the same rotation, so
 * the cards and the sphere can never disagree.
 *
 * Only the active card is interactive; the rest are inert and dimmed. Input:
 * arrow buttons, dots, keyboard (arrows, Home/End), drag, and horizontal wheel
 * over the stage. Every path funnels through `goTo`, so state cannot desync.
 */

export interface CarouselHandle {
  destroy: () => void;
  /** Rotation the globe should show, in radians. */
  targetRotation: () => number;
  reducedMotion: boolean;
}

interface CarouselOptions {
  root: HTMLElement;
  stage: HTMLElement;
  onActiveChange?: (index: number) => void;
}

/** Longitude between adjacent cards, in degrees. */
const LON_STEP = 42;
/** Vertical offset of the card ring, in px. Pushing the cards down leaves the
 *  globe's upper hemisphere visible above them, which is what makes the
 *  arrangement read as a planet rather than a flat row. Clamped per card so it
 *  can never push a card past the stage. */
const RING_Y = 90;
/** Scale applied to a card one step from the active one. */
const NEIGHBOUR_SCALE = 0.9;
/** Cards beyond this many steps are visible. Three at a time reads clearly;
 *  five overlap into mush at any card width that fits the text. */
const VISIBLE_RANGE = 1;

const DEG = Math.PI / 180;

export function initCarousel({ root, stage, onActiveChange }: CarouselOptions): CarouselHandle {
  const cards = Array.from(stage.querySelectorAll<HTMLElement>('.carousel__card'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cleanups: Array<() => void> = [];
  const on = (
    target: EventTarget,
    type: string,
    handler: EventListener,
    opts?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, handler, opts);
    cleanups.push(() => target.removeEventListener(type, handler, opts));
  };

  let active = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartIndex = 0;
  let dragMoved = false;

  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-goto]'));
  const arrows = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-dir]'));
  const toggles = Array.from(root.querySelectorAll<HTMLButtonElement>('.acc__toggle'));

  /* --- Layout ---------------------------------------------------------- */

  /**
   * Shortest signed distance from the active card, so the ring wraps.
   * With 6 cards, offsets run -2..3 rather than 0..5.
   */
  function offsetOf(index: number): number {
    let offset = index - active;
    const half = cards.length / 2;
    if (offset > half) offset -= cards.length;
    if (offset < -half) offset += cards.length;
    return offset;
  }

  function layout(): void {
    const stageWidth = stage.clientWidth || 1200;
    const stageHeight = stage.clientHeight || 760;

    // The ring radius is derived from the CARD width, not the stage width.
    // Deriving it from the stage let the neighbours tuck behind the active card
    // on a wide viewport, because the card is a fixed max-width while the stage
    // keeps growing.
    //
    // The neighbour's CENTRE lands at `sin(angle) * radius`, and its own
    // projected half-width extends from there. To leave a visible sliver beside
    // the active card, the radius must satisfy:
    //     sin(angle) * radius - neighbourHalf >= activeHalf + exposed
    // Solving for the radius is what keeps the neighbour tappable at every
    // viewport; using `activeHalf + exposed` directly under-shoots by 1/sin.
    // On a narrow stage there is no room for a neighbour beside the active card:
    // the ring would have to push it off-screen. Below this width the carousel
    // shows the active card only, and the arrows / drag are the affordance.
    const showNeighbours = stageWidth >= 560;

    const cardWidth = cards[0]?.offsetWidth || Math.min(480, stageWidth * 0.82);
    const activeHalf = cardWidth * 0.5;
    const neighbourHalf = cardWidth * 0.5 * NEIGHBOUR_SCALE;
    const exposed = Math.min(96, Math.max(48, stageWidth * 0.2));
    const ringRadius = showNeighbours
      ? (activeHalf + neighbourHalf + exposed) / Math.sin(LON_STEP * DEG)
      : 0;

    cards.forEach((card, i) => {
      const offset = offsetOf(i);
      const abs = Math.abs(offset);
      const visible = showNeighbours ? abs <= VISIBLE_RANGE : abs === 0;

      // Position on the ring: longitude from the offset. Depth comes from the
      // scale and opacity, NOT from a negative z: a card at z < 0 sits behind
      // the stage's own plane in a `preserve-3d` context, so the stage wins the
      // hit-test and the neighbour becomes unclickable even though it is painted.
      const lon = offset * LON_STEP * DEG;

      const x = Math.sin(lon) * ringRadius;

      // Face outward from the ring's centre, so the active card is square-on
      // and its neighbours turn away.
      const rotateY = -lon / DEG;

      const scale = 1 - abs * (1 - NEIGHBOUR_SCALE);
      const opacity = visible ? 1 - abs * 0.42 : 0;

      // The ring offset must never push a card past the stage: the controls sit
      // directly below it, so an overflowing card overlaps the arrows. Clamp the
      // offset to the space actually left over.
      const isOpen = card.classList.contains('is-open');
      const cardHeight = card.offsetHeight || 0;
      const room = Math.max(0, (stageHeight - cardHeight) / 2);
      const y = isOpen ? 0 : Math.min(RING_Y, room);

      card.style.transform =
        `translate(-50%, -50%) ` +
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) ` +
        `rotateY(${rotateY.toFixed(2)}deg) ` +
        `scale(${scale.toFixed(3)})`;
      card.style.opacity = String(Math.max(0, opacity));
      card.style.zIndex = String(100 - abs);
      // Every visible card is clickable: clicking a neighbour brings it to the
      // front. Hidden cards stay inert so they cannot be tabbed to.
      card.style.pointerEvents = visible ? 'auto' : 'none';
      card.setAttribute('aria-hidden', String(!visible));
      card.toggleAttribute('inert', !visible);
      card.dataset.offset = String(offset);
    });

    dots.forEach((dot, i) => {
      dot.setAttribute('aria-selected', String(i === active));
    });

    root.setAttribute('data-active', String(active));
    onActiveChange?.(active);
  }

  function targetRotation(): number {
    return -active * LON_STEP * DEG;
  }

  /* --- Navigation ------------------------------------------------------ */

  function goTo(index: number): void {
    if (cards.length === 0) return;
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
    // The open card drops the ring offset so it fits the stage; re-lay out so
    // the transform reflects that.
    layout();
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

  // Drag state lives on `window`, not on the stage. Capturing the pointer on the
  // stage stops the move stream after the first event in some browsers, and a
  // drag that leaves the stage must keep tracking anyway.
  let pointerId = -1;

  on(stage, 'pointerdown', (event) => {
    const e = event as PointerEvent;
    // A drag may start anywhere on the stage, including on a card — that is how
    // a user naturally grabs the carousel. Only controls are excluded, because
    // they need their own click.
    if ((e.target as HTMLElement).closest('button, a')) return;
    dragging = false;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartIndex = active;
    pointerId = e.pointerId;
  });

  on(window, 'pointermove', (event) => {
    const e = event as PointerEvent;
    if (e.pointerId !== pointerId) return;

    const dx = e.clientX - dragStartX;

    // Promote to a drag only past the threshold, so a click stays a click.
    if (!dragging) {
      if (Math.abs(dx) <= 6) return;
      dragging = true;
      dragMoved = true;
      stage.classList.add('is-dragging');
    }

    // One card per ~180px of travel.
    const shift = Math.round(-dx / 180);
    const target = dragStartIndex + shift;
    if (target !== active) goTo(target);
  });

  const endDrag = (event: Event) => {
    const e = event as PointerEvent;
    if (e.pointerId !== pointerId) return;
    pointerId = -1;
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-dragging');
  };

  on(window, 'pointerup', endDrag);
  on(window, 'pointercancel', endDrag);

  // A drag must not also trigger a click on the card underneath.
  on(
    stage,
    'click',
    (event) => {
      if (dragMoved) {
        event.preventDefault();
        event.stopPropagation();
        dragMoved = false;
        return;
      }

      // Clicking a neighbour brings it to the front. The active card's own
      // controls (accordion toggle, links) keep their normal behaviour.
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>('.carousel__card');
      if (!card) return;
      const offset = Number(card.dataset.offset ?? '0');
      if (offset === 0) return;
      if ((event.target as HTMLElement).closest('button, a')) return;

      event.preventDefault();
      goTo(active + offset);
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

  // The ring radius is derived from the stage width, so a resize must re-lay
  // out or the cards keep the old geometry.
  let resizeRaf = 0;
  on(window, 'resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(layout);
  });

  return {
    destroy: () => {
      cancelAnimationFrame(resizeRaf);
      cleanups.forEach((fn) => fn());
    },
    targetRotation,
    reducedMotion,
  };
}
