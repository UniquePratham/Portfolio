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
/** Radius of the card ring, as a fraction of the stage width. A fixed px
 *  radius throws the neighbours off-screen on a phone. */
const RING_RADIUS_RATIO = 0.46;
/** How far each step back recedes, in px. */
const DEPTH_STEP = 230;
/** Cards beyond this many steps are visible. Three at a time reads clearly;
 *  five overlap into mush at any card width that fits the text. */
const VISIBLE_RANGE = 1;
/** Vertical offset of the card ring, in px. Pushing the cards down leaves the
 *  globe's upper hemisphere visible above them, which is what makes the
 *  arrangement read as a planet rather than a flat row. */
const RING_Y = 90;

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
    // The ring radius follows the stage width, so the neighbours stay on screen
    // at every viewport instead of flying off on a phone.
    const stageWidth = stage.clientWidth || 1200;
    const ringRadius = Math.max(220, stageWidth * RING_RADIUS_RATIO);

    cards.forEach((card, i) => {
      const offset = offsetOf(i);
      const abs = Math.abs(offset);
      const visible = abs <= VISIBLE_RANGE;

      // Position on the ring: longitude from the offset, and a depth step so
      // the neighbours recede. A true sphere surface would place the second
      // neighbour almost directly behind the first, which reads as overlapping
      // cards rather than a ring; the depth step keeps them legible.
      const lon = offset * LON_STEP * DEG;

      const x = Math.sin(lon) * ringRadius;
      const z = -abs * DEPTH_STEP;

      // Face outward from the ring's centre, so the active card is square-on
      // and its neighbours turn away.
      const rotateY = -lon / DEG;

      const scale = 1 - abs * 0.1;
      const opacity = visible ? 1 - abs * 0.42 : 0;

      // An open card must fit the stage exactly, so it drops the ring offset.
      // Otherwise the offset pushes its bottom past the stage and the case
      // study is cut off.
      const isOpen = card.classList.contains('is-open');
      const y = isOpen ? 0 : Math.min(RING_Y, stageWidth * 0.07);

      card.style.transform =
        `translate(-50%, -50%) ` +
        `translate3d(${x.toFixed(2)}px, ${y}px, ${z.toFixed(2)}px) ` +
        `rotateY(${rotateY.toFixed(2)}deg) ` +
        `scale(${scale.toFixed(3)})`;
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
