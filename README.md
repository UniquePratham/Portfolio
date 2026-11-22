# Engineering Atlas

Personal portfolio for **Pratham Agarwal** — full stack developer, Kolkata.

Live at [uniquepratham-portfolio.web.app](https://uniquepratham-portfolio.web.app/)

## The idea

The site is an atlas rather than a scrolling page. Nine destinations sit on a
topographic map, and each one opens a real part of the work: systems, applied AI,
product, open source, security, field notes, archive, background, contact.

The terrain is not decoration. `_tools/gen_contours.py` builds a height field from
one peak per destination, contours it with marching squares, simplifies the result
with Ramer–Douglas–Peucker, and writes `src/data/contours.json` — 14 levels, 23
paths, 9.7 kB. The map is a real survey of the content.

## SPA architecture

One document, one application shell, one entry point. Only `#outlet` changes.

**Persistent across navigation:** masthead, monogram, command palette, footer,
Lenis instance, reveal observer, entrance portrait.

**Route lifecycle** (`src/scripts/router.ts`):

1. Save the outgoing scroll position.
2. Run the previous route's cleanup function.
3. Match the new route.
4. Cross-fade the outlet out (130 ms, skipped under `prefers-reduced-motion`).
5. Render, set title + description + OG tags.
6. Restore scroll (remembered for revisited routes, top otherwise).
7. Focus the new `h1` unless a dialog is open.
8. Run the new route's `mount`, which may return a cleanup.

`mount` is where route-specific listeners live. The atlas returns a cleanup that
removes every listener it added, so repeated visits cannot accumulate them.

**History:** real hash entries, so Back and Forward work. Navigating to the route
you are already on scrolls to top instead of pushing a duplicate entry. Scroll
positions are kept in `sessionStorage` per path.

**Invalid routes** render a designed 404 inside the shell with a return link —
they are not silently redirected.

## Stack

- **Vite 6** + **TypeScript** (strict), no framework runtime
- **Lenis** for smooth scrolling, disabled under `prefers-reduced-motion`
- **Newsreader / Manrope / IBM Plex Mono**, self-hosted via Fontsource
- **Firebase Hosting**

Initial JS is **28 kB gzipped**; CSS is **6.9 kB gzipped**.

## Structure

```
├── index.html              # shell, entrance, metadata, JSON-LD
├── src/
│   ├── main.ts             # wiring: router, atlas, palette, entrance
│   ├── data/
│   │   ├── content.ts      # all content, typed
│   │   └── contours.json   # generated terrain
│   ├── scripts/
│   │   ├── router.ts       # hash router, focus management
│   │   ├── views.ts        # one template per route
│   │   ├── atlas.ts        # SVG terrain + markers
│   │   ├── palette.ts      # ⌘K command palette
│   │   └── entrance.ts     # skippable portrait scrub
│   └── styles/
│       ├── tokens.css      # palette, type scale, primitives
│       └── layout.css      # components
├── public/
│   ├── frames/             # 121-frame portrait sequence
│   ├── work/               # project screenshots
│   ├── og.png              # social card
│   ├── robots.txt
│   └── sitemap.xml
└── _tools/                 # generators (not shipped)
```

## Routes

Every destination and case study is a real URL, so links are shareable and the
back button works.

| Route | Content |
| --- | --- |
| `#/` | Atlas |
| `#/work` | Project index with discipline filters |
| `#/work/:slug` | Case study — problem, approach, architecture, decisions |
| `#/open-source` | Merged PRs with diff sizes, plus collaborations |
| `#/security` | CTF record |
| `#/notes`, `#/notes/:slug` | Field notes |
| `#/person` | Education, philosophy, timeline (mineral-light surface) |
| `#/capabilities` | Capability map, grouped by domain |
| `#/archive` | Earlier work |
| `#/contact` | Contact |

## Design

**Midnight Forest.** Ground `#101A16`, secondary `#182720`, elevated `#23372D`,
mineral light `#E9E6DC`, text `#F1F0E8`, muted `#AAB5A9`, accent `#C4DF73`,
clay `#BC8063` used only for deletions and security markers.

The mineral-light surface appears exactly once, on the person route, so it reads
as a change of material rather than a theme toggle. The masthead inverts over it.

## Accessibility

- Single `<h1>` per route; the entrance name is a `role="heading"` so it does not
  compete with the routed heading
- Skip link, visible focus rings, `:focus-visible` throughout
- The atlas SVG is exposed with `role="group"`, a `<title>` and a `<desc>`; its
  markers are focusable buttons that activate on Enter or Space. No focusable
  control sits inside an `aria-hidden` element.
- Breadcrumbs on every internal view, with `aria-current="page"` on the last crumb
- Command palette traps focus, closes on Escape, and never steals focus from a
  route change
- `prefers-reduced-motion` disables Lenis, route transitions, reveals and the
  portrait scrub
- Reveal animations scoped to `.js`, so content survives a script failure
- Every image has `alt`, `width` and `height`

## Performance

The entrance fetches 12 priority frames spread across the sequence, then the rest
at low concurrency. The portrait is a canvas in its own grid column, so there is
no layout shift and no text can overlap it. The atlas is inline SVG with
`vector-effect: non-scaling-stroke`, so it stays crisp at any size without extra
requests.

One Lenis instance, one reveal observer, one animation loop. Route changes do not
create new ones.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run preview
```

## Deploy

```bash
npx firebase-tools login   # once
npm run deploy
```

Project: `uniquepratham-portfolio` (see `.firebaserc`).

## Regenerating assets

```bash
python _tools/gen_contours.py   # terrain -> src/data/contours.json
python _tools/gen_og.py         # social card -> public/og.png
```

## Content provenance

Every claim is traceable: the GitHub profile README, a merged pull request, a live
deployment, or a repository. Contribution counts come from the GitHub search API
(`author:UniquePratham type:pr is:merged -user:UniquePratham`) and are stamped with
the date they were checked. No metrics are estimated.

## License

Content and images © Pratham Agarwal. Code is free to learn from.
