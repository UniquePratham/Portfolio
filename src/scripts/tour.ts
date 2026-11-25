/**
 * A guided tour, with driver.js.
 *
 * A portfolio is usually landed on cold, from a link in a résumé or a message.
 * The tour gives a first-time visitor a route through the work instead of
 * leaving them to scroll and guess. It is opt-in — a button, never automatic —
 * because an unsolicited overlay is the fastest way to lose a reader.
 */
export interface TourOptions {
  trigger: HTMLButtonElement;
  reducedMotion: boolean;
}

export interface TourHandle {
  destroy: () => void;
}

interface TourRunner {
  start: () => void;
  destroy: () => void;
}

export function initTour({ trigger, reducedMotion }: TourOptions): TourHandle {
  let destroyed = false;
  let runner: TourRunner | null = null;

  const onClick = () => {
    if (runner) {
      runner.start();
      return;
    }
    void Promise.all([import('driver.js'), import('driver.js/dist/driver.css')]).then(([mod]) => {
      if (destroyed) return;
      runner = mount(mod.driver, reducedMotion);
      runner.start();
    });
  };

  trigger.addEventListener('click', onClick);

  return {
    destroy: () => {
      destroyed = true;
      trigger.removeEventListener('click', onClick);
      runner?.destroy();
    },
  };
}

interface TourRunner {
  start: () => void;
  destroy: () => void;
}

function mount(
  driver: typeof import('driver.js').driver,
  reducedMotion: boolean,
): TourRunner {
  const tour = driver({
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    animate: !reducedMotion,
    allowClose: true,
    overlayColor: 'rgba(16, 26, 22, 0.82)',
    stagePadding: 8,
    stageRadius: 2,
    popoverClass: 'tour-popover',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    steps: [
      {
        element: '#atlas',
        popover: {
          title: 'Start with the map',
          description:
            'Every marker is a part of the work. Hover one to see what is inside, then jump straight to it.',
        },
      },
      {
        element: '#work',
        popover: {
          title: 'The work itself',
          description:
            'Ten projects. Turn the carousel, filter by discipline, and open a card for the problem, the decisions and what it actually does.',
        },
      },
      {
        element: '#playground',
        popover: {
          title: 'The stack, with mass',
          description:
            'A real rigid-body simulation. Drag a piece and throw it — it is Matter.js, not a video.',
        },
      },
      {
        element: '#measured',
        popover: {
          title: 'The numbers',
          description:
            'Measured results, not claims. These are the reported errors from the Delhi bus model against the timetable it replaced.',
        },
      },
      {
        element: '#contact',
        popover: {
          title: 'Get in touch',
          description: 'Email, GitHub and LinkedIn. The signature at the bottom is drawn, not an image.',
        },
      },
    ],
  });

  return {
    start: () => tour.drive(),
    destroy: () => tour.destroy(),
  };
}
