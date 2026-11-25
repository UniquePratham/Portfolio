/**
 * Hand-drawn emphasis, using rough-notation.
 *
 * The site's voice is editorial — a serif display face, rules, marginalia. A
 * hand-drawn underline or circle on a key phrase reads as an editor's mark on a
 * proof, which is the register the copy is written in. It is used sparingly:
 * one annotation per section at most, on the phrase that carries the argument.
 *
 * The library draws into an SVG overlay it manages itself, so the text stays
 * real, selectable and accessible. Under `prefers-reduced-motion` the marks are
 * drawn immediately rather than animated.
 */
import { annotate } from 'rough-notation';

/** The subset of the annotation handle this module uses. */
interface Mark {
  show: () => void;
  remove: () => void;
}

export interface AnnotateOptions {
  /** Elements to annotate, each with a `data-annotate` type. */
  root: ParentNode;
  reducedMotion: boolean;
}

export interface AnnotateHandle {
  destroy: () => void;
}

type AnnotationType = 'underline' | 'circle' | 'box' | 'highlight' | 'bracket';

const ACCENT = '#c4df73';

export function initAnnotations({ root, reducedMotion }: AnnotateOptions): AnnotateHandle {
  const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-annotate]'));
  if (targets.length === 0) return { destroy: () => {} };

  const marks: Mark[] = [];
  let destroyed = false;

  // Annotate when the element is on screen, not on load: a mark that has already
  // finished drawing by the time the reader arrives is just a decoration.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        observer.unobserve(el);

        const type = (el.dataset.annotate ?? 'underline') as AnnotationType;
        const mark = annotate(el, {
          type,
          color: ACCENT,
          strokeWidth: 2,
          padding: type === 'circle' ? 6 : 2,
          multiline: false,
          animationDuration: reducedMotion ? 0 : 700,
        });
        marks.push(mark);
        mark.show();
      }
    },
    { threshold: 0.6 },
  );

  targets.forEach((el) => observer.observe(el));

  return {
    destroy: () => {
      destroyed = true;
      observer.disconnect();
      if (destroyed) marks.forEach((m) => m.remove());
    },
  };
}
