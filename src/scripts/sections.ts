/**
 * Section templates.
 *
 * The site is one document. Every section is rendered once into the page and
 * navigated to by `#id`, so there is no route swap, no re-render and no
 * possibility of a full page load. Content comes from `src/data/content.ts`.
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
  type Discipline,
} from '../data/content';

const arrow = `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 9L9 3M9 3H4M9 3v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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

const DISCIPLINE_LABEL: Record<Discipline, string> = {
  systems: 'Systems',
  ai: 'Applied AI',
  product: 'Product',
  tools: 'Developer tools',
  security: 'Security',
};

/* -------------------------------------------------------------------------
   Atlas
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

  // Sections that are not atlas destinations, listed so nothing is orphaned.
  const more: Array<[string, string, string]> = [
    ['Capability map', '#capabilities', 'Languages, frameworks and tools by domain'],
    ['Archive', '#archive', 'Earlier projects and experiments'],
  ];
  const moreList = more
    .map(
      ([label, href, hint]) => `
      <li>
        <a href="${href}">
          <span class="idx">→</span>
          <span class="name">${esc(label)}</span>
          <span class="hint">${esc(hint)}</span>
        </a>
      </li>`,
    )
    .join('');

  return `
    <section class="atlas" id="atlas" aria-labelledby="atlas-title">
      <div class="shell">
        <div class="section-head">
          <p class="section-head__label">The Atlas</p>
          <h2 class="section-head__title" id="atlas-title">Nine places to look</h2>
          <p class="section-head__lede">
            Each marker is a part of the work. Hover or focus one to see what is inside,
            then jump to it.
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

        <ul class="atlas__list">${list}${moreList}</ul>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   Work — 3D carousel of accordion cards
   ------------------------------------------------------------------------- */

export function renderWork(): string {
  const filters = [
    ['all', 'All'],
    ['systems', 'Systems'],
    ['ai', 'Applied AI'],
    ['product', 'Products'],
    ['tools', 'Developer tools'],
  ]
    .map(
      ([value, label]) =>
        `<button class="filter" type="button" data-filter="${value}" aria-pressed="${value === 'all'}">${label}</button>`,
    )
    .join('');

  const cards = PROJECTS.map((p, i) => {
    const media = p.image
      ? `<img src="${esc(p.image.src)}" alt="${esc(p.image.alt)}" width="${p.image.width}" height="${p.image.height}" loading="lazy" decoding="async" />`
      : '';

    const arch = p.architecture
      ? `<ol class="acc__arch">
           ${p.architecture
             .map(
               (layer) =>
                 `<li><span>${esc(layer.label)}</span><small>${esc(layer.detail)}</small></li>`,
             )
             .join('')}
         </ol>`
      : '';

    const decisions = p.decisions
      .map(
        (d) => `<div class="acc__decision">
          <h4>${esc(d.title)}</h4>
          <p>${esc(d.body)}</p>
        </div>`,
      )
      .join('');

    return `
      <article class="carousel__card" data-index="${i}" data-discipline="${p.discipline}" data-slug="${p.slug}">
        <div class="carousel__face">
          <div class="carousel__media">${media}</div>
          <div class="carousel__meta">
            <p class="carousel__index">${String(i + 1).padStart(2, '0')} — ${DISCIPLINE_LABEL[p.discipline]}</p>
            <h3 class="carousel__title">${esc(p.title)}</h3>
            <p class="carousel__summary">${esc(p.summary)}</p>
            <div class="carousel__tags">${tags(p.stack.slice(0, 4))}</div>
          </div>
        </div>

        <div class="carousel__accordion">
          <button class="acc__toggle" type="button" aria-expanded="false" aria-controls="acc-${p.slug}">
            <span>Case study</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          <div class="acc__panel" id="acc-${p.slug}" hidden>
            <div class="acc__inner">
              <div class="acc__block">
                <h4>The problem</h4>
                <p>${esc(p.problem)}</p>
              </div>
              <div class="acc__block">
                <h4>Approach</h4>
                <p>${esc(p.approach)}</p>
              </div>
              <div class="acc__block">
                <h4>My role</h4>
                <p>${esc(p.role)}</p>
              </div>
              ${arch ? `<div class="acc__block"><h4>Architecture</h4>${arch}</div>` : ''}
              <div class="acc__block">
                <h4>Decisions and trade-offs</h4>
                ${decisions}
              </div>
              <div class="acc__block">
                <h4>What it does</h4>
                <ul class="acc__outcomes">
                  ${p.outcomes.map((o) => `<li>${esc(o)}</li>`).join('')}
                </ul>
              </div>
              <div class="acc__links">${links(p.links)}</div>
            </div>
          </div>
        </div>
      </article>`;
  }).join('');

  return `
    <section class="dest" id="work" aria-labelledby="work-title">
      <div class="shell">
        <div class="section-head">
          <p class="section-head__label">Selected work</p>
          <h2 class="section-head__title" id="work-title">Six projects, six problems</h2>
          <p class="section-head__lede">
            Drag, scroll or use the arrows to turn the carousel. Open a card to read the
            problem, the decisions and what the thing actually does.
          </p>
        </div>

        <div class="filters" role="group" aria-label="Filter projects by discipline">${filters}</div>

        <div class="carousel" id="carousel" data-active="0">
          <div class="carousel__globe" aria-hidden="true">
            <canvas id="carousel-globe"></canvas>
          </div>

          <div class="carousel__stage" id="carousel-stage">
            ${cards}
          </div>

          <div class="carousel__controls">
            <button class="carousel__arrow" type="button" data-dir="-1" aria-label="Previous project">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            <div class="carousel__dots" role="tablist" aria-label="Projects">
              ${PROJECTS.map(
                (p, i) =>
                  `<button class="carousel__dot" type="button" role="tab" data-goto="${i}" aria-label="${esc(p.title)}" aria-selected="${i === 0}"></button>`,
              ).join('')}
            </div>

            <button class="carousel__arrow" type="button" data-dir="1" aria-label="Next project">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <p class="project-empty" data-empty hidden>No projects in this discipline.</p>
      </div>
    </section>`;
}

/* -------------------------------------------------------------------------
   Case studies
   ------------------------------------------------------------------------- */

export function renderCases(): string {
  return PROJECTS.map((p, index) => {
    const prev = index > 0 ? PROJECTS[index - 1] : undefined;
    const next = index < PROJECTS.length - 1 ? PROJECTS[index + 1] : undefined;

    const media = p.image
      ? `<figure class="case__media">
           <img src="${esc(p.image.src)}" alt="${esc(p.image.alt)}" width="${p.image.width}" height="${p.image.height}" loading="lazy" decoding="async" />
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
          <h4>${esc(d.title)}</h4>
          <p>${esc(d.body)}</p>
        </div>`,
      )
      .join('');

    return `
      <article class="case" id="project-${p.slug}" aria-labelledby="project-${p.slug}-title">
        <div class="shell">
          <div class="case__hero">
            <div class="dest__head" style="margin-bottom:0">
              <p class="section-head__label">${DISCIPLINE_LABEL[p.discipline]} · ${esc(p.year)}</p>
              <h3 class="dest__title" id="project-${p.slug}-title">${esc(p.title)}</h3>
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
            <h4>The problem</h4>
            <p>${esc(p.problem)}</p>
          </div>

          <div class="case__section">
            <h4>Approach</h4>
            <p>${esc(p.approach)}</p>
          </div>

          ${arch ? `<div class="case__section"><h4>Architecture</h4>${arch}</div>` : ''}

          <div class="case__section">
            <h4>Decisions and trade-offs</h4>
            <div class="decisions">${decisions}</div>
          </div>

          <div class="case__section">
            <h4>What it does</h4>
            <ul class="case__list">
              ${p.outcomes.map((o) => `<li><span>${esc(o)}</span></li>`).join('')}
            </ul>
          </div>

          <nav class="case__nav" aria-label="Project navigation">
            ${
              prev
                ? `<a class="case__nav-link" href="#project-${prev.slug}">
                     <span class="case__nav-dir">Previous</span>
                     <span class="case__nav-title">${esc(prev.title)}</span>
                   </a>`
                : '<span></span>'
            }
            <a class="case__nav-index" href="#work">All projects</a>
            ${
              next
                ? `<a class="case__nav-link case__nav-link--next" href="#project-${next.slug}">
                     <span class="case__nav-dir">Next</span>
                     <span class="case__nav-title">${esc(next.title)}</span>
                   </a>`
                : '<span></span>'
            }
          </nav>
        </div>
      </article>`;
  }).join('');
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
        <h3 class="pr__title">${esc(c.title)}</h3>
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
    <section class="dest" id="open-source" aria-labelledby="oss-title">
      <div class="shell">
        <div class="section-head">
          <p class="section-head__label">Open-source observatory</p>
          <h2 class="section-head__title" id="oss-title">Work in repositories I don’t own</h2>
          <p class="section-head__lede">
            Two upstream fixes, and a long collaboration on team builds. Counts are from the
            GitHub search API as of ${esc(OSS_TOTALS.asOf)}.
          </p>
        </div>

        <div class="oss-totals">
          <div><b>${OSS_TOTALS.merged}</b><span>Merged pull requests</span></div>
          <div><b>${OSS_TOTALS.repos}</b><span>Repositories</span></div>
          <div><b>${CONTRIBUTIONS.length}</b><span>Upstream fixes</span></div>
        </div>

        <h3 class="section-head__title" style="font-size:var(--step-3);margin-bottom:var(--space-s)">Upstream</h3>
        ${prs}

        <h3 class="section-head__title" style="font-size:var(--step-3);margin-top:var(--space-xl);margin-bottom:var(--space-s)">Collaboration</h3>
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
    <section class="dest" id="security" aria-labelledby="security-title">
      <div class="shell">
        <div class="section-head">
          <p class="section-head__label">Security range</p>
          <h2 class="section-head__title" id="security-title">Twenty-plus events, one habit</h2>
          <p class="section-head__lede">
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
          <h3>What carries over into engineering</h3>
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
      <article class="note" id="note-${n.slug}">
        <p class="note-row__cat">${esc(n.category)} · ${esc(n.date)}</p>
        <h3 class="note-row__title">${esc(n.title)}</h3>
        <p class="note-row__summary">${esc(n.summary)}</p>
        <div class="note-body">
          ${n.body.map((para) => `<p>${esc(para)}</p>`).join('')}
        </div>
      </article>`,
  ).join('');

  return `
    <section class="dest" id="notes" aria-labelledby="notes-title">
      <div class="shell">
        <div class="section-head">
          <p class="section-head__label">Field notes</p>
          <h2 class="section-head__title" id="notes-title">What building these taught me</h2>
          <p class="section-head__lede">
            Short write-ups from actual work. Each one is about a decision that was not obvious
            at the time.
          </p>
        </div>
        <div class="notes">${rows}</div>
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
    <section class="dest mineral" id="person" aria-labelledby="person-title">
      <div class="shell">
        <div class="section-head">
          <p class="section-head__label">The person</p>
          <h2 class="section-head__title" id="person-title">How I got here</h2>
        </div>

        <p class="philosophy">${esc(PROFILE.philosophy)}</p>

        <div class="education">${edu}</div>

        <h3 class="section-head__title" style="font-size:var(--step-3);margin-bottom:var(--space-m)">Timeline</h3>
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
    <section class="dest" id="capabilities" aria-labelledby="cap-title">
      <div class="shell">
        <div class="section-head">
          <p class="section-head__label">Capability map</p>
          <h2 class="section-head__title" id="cap-title">What I actually use</h2>
          <p class="section-head__lede">
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
    <section class="dest" id="archive" aria-labelledby="archive-title">
      <div class="shell">
        <div class="section-head">
          <p class="section-head__label">Archive</p>
          <h2 class="section-head__title" id="archive-title">Earlier work</h2>
          <p class="section-head__lede">
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
    <section class="dest contact" id="contact" aria-labelledby="contact-title">
      <div class="shell">
        <div class="section-head">
          <p class="section-head__label">Contact station</p>
          <h2 class="section-head__title" id="contact-title">Let’s build something real</h2>
          <p class="section-head__lede">
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
