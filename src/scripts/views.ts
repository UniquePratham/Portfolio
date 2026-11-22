/**
 * View templates.
 *
 * Each function returns an HTML string for one route. Content comes from
 * `src/data/content.ts`; nothing is invented here.
 */
import {
  PROJECTS,
  CONTRIBUTIONS,
  COLLABORATIONS,
  OSS_TOTALS,
  TIMELINE,
  CAPABILITIES,
  FIELD_NOTES,
  DESTINATIONS,
  PROFILE,
  type Project,
  type Discipline,
} from '../data/content';

const arrow = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 9L9 3M9 3H4M9 3v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Breadcrumb trail. The last crumb is the current page and is not a link. */
function crumbs(trail: Array<{ label: string; href?: string }>): string {
  const parts = trail.map((c, i) => {
    const last = i === trail.length - 1;
    if (last || !c.href) {
      return `<span aria-current="page">${esc(c.label)}</span>`;
    }
    return `<a href="${esc(c.href)}">${esc(c.label)}</a>`;
  });
  return `<nav class="crumbs" aria-label="Breadcrumb">${parts.join('<i aria-hidden="true">/</i>')}</nav>`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tags(items: string[]): string {
  return items.map((t) => `<span class="tag">${esc(t)}</span>`).join('');
}

function links(items: Array<{ label: string; href: string }>): string {
  return items
    .map(
      (l) =>
        `<a class="tlink" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ${arrow}</a>`,
    )
    .join('');
}

/* -------------------------------------------------------------------------
   Atlas (home)
   ------------------------------------------------------------------------- */

export function renderAtlas(): string {
  const list = DESTINATIONS.map(
    (d, i) => `
      <li>
        <a href="${esc(d.href)}">
          <span class="idx">${String(i + 1).padStart(2, '0')}</span>
          <span class="name">${esc(d.label)}</span>
          <span class="hint">${esc(d.hint)}</span>
        </a>
      </li>`,
  ).join('');

  return `
    <section class="atlas" aria-labelledby="atlas-title">
      <div class="shell">
        <div class="section-head">
          <p class="section-head__label">The Atlas</p>
          <h1 class="section-head__title" id="atlas-title">Nine places to look</h1>
          <p class="section-head__lede">
            Each marker is a part of the work. Hover or focus one to see what is inside,
            then open it.
          </p>
        </div>

        <div class="atlas__frame">
          <svg class="atlas__svg" id="atlas-svg"></svg>
          <div class="atlas__readout" id="atlas-readout" aria-live="polite"></div>
        </div>

        <div class="atlas__legend">
          <span><i></i> Survey route</span>
          <span>Contours: 14 levels</span>
          <span>${DESTINATIONS.length} destinations</span>
        </div>

        <ul class="atlas__list">${list}</ul>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   Project index
   ------------------------------------------------------------------------- */

const DISCIPLINE_LABEL: Record<Discipline, string> = {
  systems: 'Systems',
  ai: 'Applied AI',
  product: 'Product',
  tools: 'Developer tools',
  security: 'Security',
};

export function renderWork(filter?: string): string {
  const active = filter && filter !== 'all' ? filter : 'all';
  const shown = PROJECTS.filter((p) => active === 'all' || p.discipline === active);

  const filters = [
    ['all', 'All'],
    ['systems', 'Systems'],
    ['ai', 'Applied AI'],
    ['product', 'Products'],
    ['tools', 'Developer tools'],
  ]
    .map(
      ([value, label]) =>
        `<button class="filter" type="button" data-filter="${value}" aria-pressed="${value === active}">${label}</button>`,
    )
    .join('');

  const rows = shown
    .map(
      (p) => `
      <a class="project-row" href="#/work/${p.slug}" data-discipline="${p.discipline}">
        <div>
          <h2 class="project-row__title">${esc(p.title)} <small>${DISCIPLINE_LABEL[p.discipline]}</small></h2>
          <div class="project-row__meta">${tags(p.stack.slice(0, 4))}</div>
        </div>
        <div>
          <p class="project-row__summary">${esc(p.summary)}</p>
        </div>
      </a>`,
    )
    .join('');

  return `
    <section class="dest">
      <div class="shell">
        ${crumbs([{ label: "Atlas", href: "#/" }, { label: "Work" }])}
        <div class="dest__head">
          <p class="section-head__label">Selected work</p>
          <h1 class="dest__title">Six projects, six problems</h1>
          <p class="dest__lede">
            Each one is live or has a public repository. The case studies cover the problem,
            the decisions, and what the thing actually does.
          </p>
        </div>

        <div class="filters" role="group" aria-label="Filter projects by discipline">${filters}</div>
        <div class="project-index">${rows}</div>
        <p class="project-empty" data-empty hidden>No projects in this discipline.</p>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   Case study
   ------------------------------------------------------------------------- */

export function renderCase(slug: string): string {
  const index = PROJECTS.findIndex((x) => x.slug === slug);
  const p = PROJECTS[index];
  if (!p) return renderNotFound();

  const prev = index > 0 ? PROJECTS[index - 1] : undefined;
  const next = index < PROJECTS.length - 1 ? PROJECTS[index + 1] : undefined;

  const media = p.image
    ? `<figure class="case__media">
         <img src="${esc(p.image.src)}" alt="${esc(p.image.alt)}" width="${p.image.width}" height="${p.image.height}" loading="eager" decoding="async" />
       </figure>`
    : '';

  const arch = p.architecture
    ? `<div class="arch">
         ${p.architecture
           .map(
             (layer, i) =>
               `<div class="arch__layer" style="--depth:${i}">
                  <span class="arch__label">${esc(layer.label)}</span>
                  <span class="arch__detail">${esc(layer.detail)}</span>
                </div>`,
           )
           .join('')}
       </div>`
    : '';

  const decisions = p.decisions
    .map(
      (d) => `<div class="decision">
        <h3>${esc(d.title)}</h3>
        <p>${esc(d.body)}</p>
      </div>`,
    )
    .join('');

  return `
    <section class="dest">
      <div class="shell">
        ${crumbs([
          { label: 'Atlas', href: '#/' },
          { label: 'Work', href: '#/work' },
          { label: p.title },
        ])}
        <div class="case">
          <div class="case__hero">
            <div class="dest__head" style="margin-bottom:0">
              <p class="section-head__label">${DISCIPLINE_LABEL[p.discipline]} · ${esc(p.year)}</p>
              <h1 class="dest__title">${esc(p.title)}</h1>
              <p class="dest__lede">${esc(p.summary)}</p>
            </div>
            ${media}
            <dl class="case__meta">
              <div><dt>Role</dt><dd>${esc(p.role)}</dd></div>
              <div><dt>Stack</dt><dd>${esc(p.stack.join(', '))}</dd></div>
              <div><dt>Links</dt><dd>${links(p.links)}</dd></div>
            </dl>
          </div>

          <div class="case__section">
            <h2>The problem</h2>
            <p>${esc(p.problem)}</p>
          </div>

          <div class="case__section">
            <h2>Approach</h2>
            <p>${esc(p.approach)}</p>
          </div>

          ${arch ? `<div class="case__section"><h2>Architecture</h2>${arch}</div>` : ''}

          <div class="case__section">
            <h2>Decisions and trade-offs</h2>
            <div class="decisions">${decisions}</div>
          </div>

          <div class="case__section">
            <h2>What it does</h2>
            <ul class="case__list">
              ${p.outcomes.map((o) => `<li><span>${esc(o)}</span></li>`).join('')}
            </ul>
          </div>

          <nav class="case__nav" aria-label="Project navigation">
            ${
              prev
                ? `<a class="case__nav-link" href="#/work/${prev.slug}">
                     <span class="case__nav-dir">Previous</span>
                     <span class="case__nav-title">${esc(prev.title)}</span>
                   </a>`
                : '<span></span>'
            }
            <a class="case__nav-index" href="#/work">All projects</a>
            ${
              next
                ? `<a class="case__nav-link case__nav-link--next" href="#/work/${next.slug}">
                     <span class="case__nav-dir">Next</span>
                     <span class="case__nav-title">${esc(next.title)}</span>
                   </a>`
                : '<span></span>'
            }
          </nav>
        </div>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   Open source
   ------------------------------------------------------------------------- */

export function renderOpenSource(): string {
  const prs = CONTRIBUTIONS.map((c) => {
    const diff = c.diff
      ? `<div class="pr__diff">
           <span class="add">+${c.diff.additions}</span>
           <span class="del">−${c.diff.deletions}</span>
           <span>${c.diff.files} files</span>
         </div>`
      : '';

    return `
      <article class="pr">
        <div class="pr__top">
          <a class="pr__repo" href="${esc(c.repoUrl)}" target="_blank" rel="noopener">${esc(c.repo)}</a>
          <span class="pr__status" data-status="${c.status}">${c.status}</span>
          <span class="mono" style="color:var(--text-faint)">${esc(c.date)}</span>
        </div>
        <h2 class="pr__title">${esc(c.title)}</h2>
        <dl class="pr__body">
          <dt>Problem</dt>
          <dd>${esc(c.problem)}</dd>
          <dt>Change</dt>
          <dd>${esc(c.change)}</dd>
        </dl>
        ${diff}
        <div><a class="tlink" href="${esc(c.prUrl)}" target="_blank" rel="noopener">View pull request ${arrow}</a></div>
      </article>`;
  }).join('');

  const collab = COLLABORATIONS.map(
    (c) => `
      <li>
        <a class="collab__repo" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.repo)}</a>
        <span class="collab__what">${esc(c.what)}</span>
        <span class="collab__count">${c.merged} merged</span>
      </li>`,
  ).join('');

  return `
    <section class="dest">
      <div class="shell">
        ${crumbs([{ label: "Atlas", href: "#/" }, { label: "Open source" }])}
        <div class="dest__head">
          <p class="section-head__label">Open-source observatory</p>
          <h1 class="dest__title">Work in repositories I don’t own</h1>
          <p class="dest__lede">
            Two upstream fixes, and a long collaboration on team builds. Counts are from the
            GitHub search API as of ${esc(OSS_TOTALS.asOf)}.
          </p>
        </div>

        <div class="oss-totals">
          <div><b>${OSS_TOTALS.merged}</b><span>Merged pull requests</span></div>
          <div><b>${OSS_TOTALS.repos}</b><span>Repositories</span></div>
          <div><b>${CONTRIBUTIONS.length}</b><span>Upstream fixes</span></div>
        </div>

        <h2 class="section-head__title" style="font-size:var(--step-3);margin-bottom:var(--space-s)">Upstream</h2>
        ${prs}

        <h2 class="section-head__title" style="font-size:var(--step-3);margin-top:var(--space-xl);margin-bottom:var(--space-s)">Collaboration</h2>
        <ul class="collab">${collab}</ul>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   Security
   ------------------------------------------------------------------------- */

export function renderSecurity(): string {
  const events: Array<[string, string, string]> = [
    ['DEADFACE CTF', 'Verified competitor, issued by Cyber Hacktics', '2025 · 2026'],
    ['boroCTF', '104th, Open Division', '2025'],
    ['VishwaCTF', 'Participant', '2025'],
    ['CyberGame (SK-CERT)', 'Participant', '2025'],
    ['CREST CTF 2.0', 'Participant', '2025'],
    ['RIFT · H7CTF · CSS CTF', 'Participant', '2025'],
    ['SecLeaf · Obsidian Labs', 'Participant', '2025'],
    ['ZeroDayHeist · NULL ORIGIN · DEFCON 2.0', 'Participant', '2025'],
  ];

  return `
    <section class="dest">
      <div class="shell">
        ${crumbs([{ label: "Atlas", href: "#/" }, { label: "Security" }])}
        <div class="dest__head">
          <p class="section-head__label">Security range</p>
          <h1 class="dest__title">Twenty-plus events, one habit</h1>
          <p class="dest__lede">
            CTFs are where I learned to read a system instead of using it. The list below is
            the public record; no challenge material is published here.
          </p>
        </div>

        <ul class="timeline">
          ${events
            .map(
              ([name, detail, year]) => `
            <li data-kind="security">
              <p class="timeline__year">${esc(year)}</p>
              <p class="timeline__title">${esc(name)}</p>
              <p class="timeline__detail">${esc(detail)}</p>
            </li>`,
            )
            .join('')}
        </ul>

        <div class="case__section" style="margin-top:var(--space-xl)">
          <h2>What carries over into engineering</h2>
          <p>
            Reading an unfamiliar system under time pressure, forming a hypothesis from partial
            evidence, and discarding it quickly when it fails. That is the same loop as
            debugging a production incident, just with a scoreboard.
          </p>
        </div>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   Field notes
   ------------------------------------------------------------------------- */

export function renderNotes(): string {
  const rows = FIELD_NOTES.map(
    (n) => `
      <a class="note-row" href="#/notes/${n.slug}">
        <span class="note-row__cat">${esc(n.category)}</span>
        <span class="note-row__title">${esc(n.title)}</span>
        <span class="note-row__date">${esc(n.date)}</span>
        <span class="note-row__summary" style="grid-column:2">${esc(n.summary)}</span>
      </a>`,
  ).join('');

  return `
    <section class="dest">
      <div class="shell">
        ${crumbs([{ label: "Atlas", href: "#/" }, { label: "Field notes" }])}
        <div class="dest__head">
          <p class="section-head__label">Field notes</p>
          <h1 class="dest__title">What building these taught me</h1>
          <p class="dest__lede">
            Short write-ups from actual work. Each one is about a decision that was not obvious
            at the time.
          </p>
        </div>
        <div class="notes">${rows}</div>
      </div>
    </section>`;
}

export function renderNote(slug: string): string {
  const note = FIELD_NOTES.find((n) => n.slug === slug);
  if (!note) return renderNotFound();

  return `
    <section class="dest">
      <div class="shell">
        ${crumbs([{ label: "Atlas", href: "#/" }, { label: "Field notes", href: "#/notes" }, { label: note.title }])}
        <div class="dest__head">
          <p class="section-head__label">${esc(note.category)} · ${esc(note.date)}</p>
          <h1 class="dest__title">${esc(note.title)}</h1>
          <p class="dest__lede">${esc(note.summary)}</p>
        </div>
        <div class="note-body">
          ${note.body.map((p) => `<p>${esc(p)}</p>`).join('')}
        </div>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   The person
   ------------------------------------------------------------------------- */

export function renderPerson(): string {
  const edu = PROFILE.education
    .map(
      (e) => `
      <div class="edu">
        <p class="edu__degree">${esc(e.degree)}</p>
        <p class="edu__school">${esc(e.school)} · ${esc(e.year)}</p>
      </div>`,
    )
    .join('');

  const timeline = TIMELINE.map(
    (t) => `
      <li data-kind="${t.kind}">
        <p class="timeline__year">${esc(t.year)}</p>
        <p class="timeline__title">${esc(t.title)}</p>
        <p class="timeline__detail">${esc(t.detail)}</p>
      </li>`,
  ).join('');

  return `
    <section class="dest mineral">
      <div class="shell">
        ${crumbs([{ label: "Atlas", href: "#/" }, { label: "About" }])}
        <div class="dest__head">
          <p class="section-head__label">The person</p>
          <h1 class="dest__title">How I got here</h1>
        </div>

        <p class="philosophy">${esc(PROFILE.philosophy)}</p>

        <div class="education">${edu}</div>

        <h2 class="section-head__title" style="font-size:var(--step-3);margin-bottom:var(--space-m)">Timeline</h2>
        <ul class="timeline">${timeline}</ul>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   Capabilities
   ------------------------------------------------------------------------- */

export function renderCapabilities(): string {
  const groups = CAPABILITIES.map(
    (c) => `
      <div class="cap">
        <h3>${esc(c.domain)}</h3>
        <p class="cap__blurb">${esc(c.blurb)}</p>
        <ul>
          ${c.items
            .map(
              (i) =>
                `<li><span>${esc(i.name)}</span>${i.usedIn ? `<small>${esc(i.usedIn)}</small>` : ''}</li>`,
            )
            .join('')}
        </ul>
      </div>`,
  ).join('');

  return `
    <section class="dest">
      <div class="shell">
        ${crumbs([{ label: "Atlas", href: "#/" }, { label: "Capabilities" }])}
        <div class="dest__head">
          <p class="section-head__label">Capability map</p>
          <h1 class="dest__title">What I actually use</h1>
          <p class="dest__lede">
            Grouped by domain, with the project each one was used in where there is one. No
            logo wall.
          </p>
        </div>
        <div class="cap-grid">${groups}</div>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   Archive
   ------------------------------------------------------------------------- */

export function renderArchive(): string {
  const items: Array<[string, string, string]> = [
    ['Urban Motion', 'Car rental platform — long-running collaboration', 'https://github.com/subhro1530/urbanmotion'],
    ['Vitality AI', 'IoT health emergency response system', 'https://github.com/subhro1530/VitalityAI'],
    ['Pangea News', 'Multi-category news reader', 'https://github.com/subhro1530/pangea-news'],
    ['ACNS', 'Next.js application with Stripe payments', 'https://github.com/subhro1530/acns-v4'],
    ['DualText OCR Fusion', 'Multilingual OCR with keyword search', 'https://huggingface.co/spaces/UniquePratham/DualTextOCRFusion'],
    ['Windows 11 in the browser', 'Desktop experience recreated in HTML, CSS and JS', 'https://windows11-browser.vercel.app'],
    ['CrisisLink', 'Disaster response coordination platform', 'https://crisislink-pied.vercel.app'],
    ['Utopians', 'Official site for the University of Calcutta CTF team', 'https://utopians.vercel.app'],
  ];

  return `
    <section class="dest">
      <div class="shell">
        ${crumbs([{ label: "Atlas", href: "#/" }, { label: "Archive" }])}
        <div class="dest__head">
          <p class="section-head__label">Archive</p>
          <h1 class="dest__title">Earlier work</h1>
          <p class="dest__lede">
            Projects that are real but not flagship. Kept here so the main index stays honest
            about what is finished.
          </p>
        </div>
        <ul class="collab">
          ${items
            .map(
              ([name, what, url]) => `
            <li>
              <a class="collab__repo" href="${esc(url)}" target="_blank" rel="noopener">${esc(name)}</a>
              <span class="collab__what">${esc(what)}</span>
              <span class="collab__count">${arrow}</span>
            </li>`,
            )
            .join('')}
        </ul>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   Contact
   ------------------------------------------------------------------------- */

export function renderContact(): string {
  return `
    <section class="dest">
      <div class="shell">
        ${crumbs([{ label: "Atlas", href: "#/" }, { label: "Contact" }])}
        <div class="dest__head">
          <p class="section-head__label">Contact station</p>
          <h1 class="dest__title">Let’s build something real</h1>
          <p class="dest__lede">
            Open to collaborations, freelance work and interesting problems — especially at the
            intersection of web platforms, applied AI and security.
          </p>
        </div>

        <a class="contact__mail" href="mailto:${esc(PROFILE.email)}">${esc(PROFILE.email)}</a>

        <div class="contact__links">
          <a href="${esc(PROFILE.github)}" target="_blank" rel="noopener">GitHub ${arrow}</a>
          <a href="${esc(PROFILE.linkedin)}" target="_blank" rel="noopener">LinkedIn ${arrow}</a>
          <a href="${esc(PROFILE.x)}" target="_blank" rel="noopener">X ${arrow}</a>
          <a href="${esc(PROFILE.instagram)}" target="_blank" rel="noopener">Instagram ${arrow}</a>
          <a href="tel:${esc(PROFILE.phone.replace(/\s/g, ''))}">${esc(PROFILE.phone)}</a>
        </div>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   Discipline destinations
   ------------------------------------------------------------------------- */

export function renderDiscipline(discipline: Discipline): string {
  const items = PROJECTS.filter((p) => p.discipline === discipline);
  const label = DISCIPLINE_LABEL[discipline];

  const rows = items
    .map(
      (p) => `
      <a class="project-row" href="#/work/${p.slug}">
        <div>
          <h2 class="project-row__title">${esc(p.title)}</h2>
          <div class="project-row__meta">${tags(p.stack.slice(0, 4))}</div>
        </div>
        <div><p class="project-row__summary">${esc(p.summary)}</p></div>
      </a>`,
    )
    .join('');

  return `
    <section class="dest">
      <div class="shell">
        ${crumbs([{ label: "Atlas", href: "#/" }, { label: label }])}
        <div class="dest__head">
          <p class="section-head__label">${esc(label)}</p>
          <h1 class="dest__title">${esc(label)}</h1>
          <p class="dest__lede">${esc(disciplineLede(discipline))}</p>
        </div>
        <div class="project-index">${rows}</div>
      </div>
    </section>`;
}

function disciplineLede(d: Discipline): string {
  switch (d) {
    case 'systems':
      return 'Where the abstractions come off — process control, memory, and the syscall boundary.';
    case 'ai':
      return 'Models used as components inside a system, with the evidence for each claim kept visible.';
    case 'product':
      return 'Full-stack applications where the hard part is a workflow, not a screen.';
    case 'tools':
      return 'Small, sharp utilities that answer one question well.';
    case 'security':
      return 'Reading systems rather than using them.';
  }
}

/* -------------------------------------------------------------------------
   Not found
   ------------------------------------------------------------------------- */

export function renderNotFound(): string {
  return `
    <section class="dest">
      <div class="shell">
        ${crumbs([{ label: "Atlas", href: "#/" }, { label: "Not found" }])}
        <div class="dest__head">
          <p class="section-head__label">404</p>
          <h1 class="dest__title">That marker isn’t on the map</h1>
          <p class="dest__lede">The atlas has nine destinations. Start from the map.</p>
        </div>
        <a class="btn btn--solid" href="#/">Return to the atlas</a>
      </div>
    </section>`;
}

export type { Project };
