# Portfolio

Personal portfolio for **Pratham Agarwal** — full stack developer, Kolkata.

Live at [uniquepratham-portfolio.web.app](https://uniquepratham-portfolio.web.app/)

## What's in here

A single-page site built around a scroll-scrubbed portrait sequence. Vite compiles
TypeScript and CSS down to static files that Firebase Hosting serves.

| Section | Content |
| --- | --- |
| Hero | Positioning line, location, current study |
| Sequence | 121 frames scrubbed by scroll, subject anchored to the bottom edge |
| About | Background, focus areas, quick facts |
| Work | Six shipped projects with live links |
| Open source | 169 merged pull requests across 18 repositories |
| Skills | Grouped by what the work actually needs |
| Recognition | Certifications and CTF results |
| Contact | Direct mail, phone, social links |

## Stack

- **Vite 6** + **TypeScript** (strict)
- **Lenis** for smooth scrolling, disabled under `prefers-reduced-motion`
- **Instrument Serif / Instrument Sans / JetBrains Mono**, self-hosted via Fontsource
- **Firebase Hosting** for delivery

No framework runtime. The initial JS payload is **7.6 kB gzipped**.

## Design

Warm paper ground (`#f2efe8`) with a single vermilion accent (`#c8401e`). The
sequence is the only dark plate, so the portrait reads as a full-bleed photograph
rather than a component. The nav slides out while the plate is pinned and returns
when it releases.

## Performance notes

Frames are served in two tiers:

| Tier | Dimensions | Total |
| --- | --- | --- |
| Desktop | 1554 × 1000 | 5.3 MB |
| Mobile | 732 × 1000 (portrait crop) | 3.4 MB |

Frames load coarse-to-fine — every 8th, then every 4th, then the rest — so the
first paint happens after a handful of requests and the scrub never stalls on a
missing frame. `paint()` falls back to the nearest decoded neighbour.

## Accessibility

- Single `<h1>`, ordered heading levels, `lang` set
- Skip link to `#main`
- Every image has meaningful `alt` text
- `prefers-reduced-motion` disables Lenis, reveal transitions, and the scroll hint
- Reveal animations are scoped to `.js`, so content stays visible without scripting
- Focus-visible outlines on all interactive elements

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the built output
```

## Deploy

```bash
npx firebase-tools login   # once
npm run deploy             # build + firebase deploy --only hosting
```

The Firebase project is `uniquepratham-portfolio` (see `.firebaserc`).

## Asset pipeline

The source material — a 121-frame video sequence at 7608 × 2448 — is not
committed. It was processed once into the files under `public/frames/`:

- Cropped to the alpha union bbox `(1455, 125, 5066, 2448)`, then resized and
  encoded to WebP. The mobile tier uses a narrower portrait crop centred on the
  subject.
- Project screenshots captured from the live deployments and re-encoded to WebP
  at 1600 px wide.

## Structure

```
├── index.html            # markup and content
├── src/
│   ├── main.ts           # entry: fonts, styles, Lenis, module wiring
│   ├── scripts/
│   │   ├── sequence.ts   # scroll-scrubbed canvas + nav hiding
│   │   └── ui.ts         # nav, reveals, scroll spy
│   └── styles/
│       ├── tokens.css    # design tokens, reset, utilities
│       └── layout.css    # components and responsive rules
├── public/
│   ├── frames/           # desktop + mobile WebP tiers
│   ├── work/             # project screenshots
│   └── favicon.svg
└── firebase.json
```

## License

Content and images © Pratham Agarwal. Code is free to learn from.
