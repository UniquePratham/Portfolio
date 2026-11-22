/**
 * Command palette.
 *
 * Ctrl/Cmd+K opens a searchable list of destinations, projects and notes. It is
 * a real dialog: focus is trapped while open, Escape closes it, and the list is
 * driven by the same data the site renders from.
 */
import { DESTINATIONS, PROJECTS, FIELD_NOTES } from '../data/content';

interface Command {
  label: string;
  hint: string;
  href: string;
  keywords: string;
}

interface PaletteOptions {
  root: HTMLElement;
  input: HTMLInputElement;
  results: HTMLListElement;
  onNavigate: (href: string) => void;
}

type HTMLListElement = HTMLUListElement;

function buildCommands(): Command[] {
  const commands: Command[] = [];

  for (const d of DESTINATIONS) {
    commands.push({
      label: d.label,
      hint: 'Destination',
      href: d.href,
      keywords: `${d.label} ${d.hint} ${d.contents.join(' ')}`.toLowerCase(),
    });
  }

  for (const p of PROJECTS) {
    commands.push({
      label: p.title,
      hint: 'Case study',
      href: `#/work/${p.slug}`,
      keywords: `${p.title} ${p.summary} ${p.stack.join(' ')} ${p.discipline}`.toLowerCase(),
    });
  }

  for (const n of FIELD_NOTES) {
    commands.push({
      label: n.title,
      hint: `Note · ${n.category}`,
      href: `#/notes/${n.slug}`,
      keywords: `${n.title} ${n.summary} ${n.category}`.toLowerCase(),
    });
  }

  return commands;
}

export function initPalette({ root, input, results, onNavigate }: PaletteOptions): void {
  const commands = buildCommands();
  let filtered = commands;
  let activeIndex = 0;
  let lastFocused: HTMLElement | null = null;

  function render() {
    results.innerHTML = '';

    if (filtered.length === 0) {
      const li = document.createElement('li');
      li.className = 'palette__empty';
      li.textContent = 'No matches.';
      results.appendChild(li);
      return;
    }

    filtered.forEach((cmd, i) => {
      const li = document.createElement('li');
      li.setAttribute('data-active', String(i === activeIndex));
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === activeIndex));

      const label = document.createElement('span');
      label.textContent = cmd.label;

      const hint = document.createElement('small');
      hint.textContent = cmd.hint;

      li.append(label, hint);
      li.addEventListener('pointerenter', () => {
        activeIndex = i;
        render();
      });
      li.addEventListener('click', () => choose(i));
      results.appendChild(li);
    });
  }

  function choose(index: number) {
    const cmd = filtered[index];
    if (!cmd) return;
    close();
    onNavigate(cmd.href);
  }

  function filter(query: string) {
    const q = query.trim().toLowerCase();
    if (q === '') {
      filtered = commands;
    } else {
      // Rank: title prefix, then title contains, then keyword contains.
      const scored = commands
        .map((c) => {
          const title = c.label.toLowerCase();
          let score = -1;
          if (title.startsWith(q)) score = 0;
          else if (title.includes(q)) score = 1;
          else if (c.keywords.includes(q)) score = 2;
          return { c, score };
        })
        .filter((x) => x.score >= 0)
        .sort((a, b) => a.score - b.score);

      filtered = scored.map((x) => x.c);
    }
    activeIndex = 0;
    render();
  }
  function open() {
    lastFocused = document.activeElement as HTMLElement | null;
    root.setAttribute('data-open', 'true');
    input.value = '';
    filter('');
    input.focus();
    // A route change can move focus to the new heading in the same tick; take
    // it back on the next frame if that happened.
    requestAnimationFrame(() => {
      if (root.getAttribute('data-open') === 'true' && document.activeElement !== input) {
        input.focus();
      }
    });
  }

  function close() {
    root.setAttribute('data-open', 'false');
    lastFocused?.focus();
  }

  function isOpen() {
    return root.getAttribute('data-open') === 'true';
  }

  input.addEventListener('input', () => filter(input.value));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
      render();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      render();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });

  root.addEventListener('click', (event) => {
    if (event.target === root) close();
  });

  document.addEventListener('keydown', (event) => {
    const isK = event.key === 'k' || event.key === 'K';
    if ((event.metaKey || event.ctrlKey) && isK) {
      event.preventDefault();
      if (isOpen()) close();
      else open();
      return;
    }

    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      close();
    }

    // Trap focus inside the dialog while it is open.
    if (event.key === 'Tab' && isOpen()) {
      event.preventDefault();
      input.focus();
    }
  });

  document.querySelectorAll<HTMLElement>('[data-open-palette]').forEach((btn) => {
    btn.addEventListener('click', open);
  });

  render();
}
