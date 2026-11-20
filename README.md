# Portfolio

Personal portfolio for **Pratham Agarwal** — full stack developer, Kolkata.

Live at [uniquepratham-portfolio.web.app](https://uniquepratham-portfolio.web.app/)

## What's in here

A single-page site built around a scroll-scrubbed frame sequence and a real-time
3D avatar. No page builder, no template, no framework runtime — Vite compiles
TypeScript and CSS down to static files that Firebase Hosting serves.

| Section | What it does |
| --- | --- |
| Hero | Editorial type, bronze-on-obsidian palette sampled from the portrait |
| Sequence | 121 frames decoded to `ImageBitmap` and painted to a canvas, scrubbed by scroll |
| About | Resume-derived facts, no invented biography |
| Work | Four shipped projects with live links and source |
| Lab | Three.js avatar, Meshopt-compressed, three-point studio lighting |
| Skills | Grouped by what the work actually needs |
| Contact | Direct mail, phone, and social links |

## Stack

- **Vite 6** + **TypeScript** (strict)
- **Three.js** for the avatar, loaded lazily via dynamic `import()`
- **Lenis** for smooth scrolling, disabled under `prefers-reduced-motion`
- **Instrument Serif / Instrument Sans / JetBrains Mono**, self-hosted via Fontsource
- **Firebase Hosting** for delivery

## Performance notes

The initial JS payload is **8.5 kB gzipped**. Three.js (130 kB gzipped) is only
fetched when the Lab section comes within 600 px of the viewport, so it never
competes with the frame sequence for bandwidth on first paint.

Frames are served in two tiers:

| Tier | Dimensions | Total |
| --- | --- | --- |
| Desktop | 1554 × 1000 | 5.3 MB |
| Mobile | 732 × 1000 (portrait crop) | 3.4 MB |

Frames load coarse-to-fine — every 8th, then every 4th, then the rest — so the
first paint happens after a handful of requests and the scrub never stalls on a
missing frame. `paint()` falls back to the nearest decoded neighbour.

The avatar ships at **1.0 MB**, down from 9.6 MB, via Meshopt geometry
compression and WebP textures at 1024 px.

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

The source material — a 121-frame video sequence at 7608 × 2448 and a 9.6 MB
GLB — is not committed. It was processed once into the files under `public/`:

- Frames cropped to the alpha union bbox `(1455, 125, 5066, 2448)`, then
  resized and encoded to WebP. The mobile tier uses a narrower portrait crop
  centred on the subject.
- Avatar run through `@gltf-transform/cli optimize` with `--compress meshopt
  --texture-compress webp --texture-size 1024`.
- Project screenshots re-encoded to WebP at 1600 px wide.

## Structure

```
├── index.html            # markup and content
├── src/
│   ├── main.ts           # entry: fonts, styles, Lenis, module wiring
│   ├── scripts/
│   │   ├── sequence.ts   # scroll-scrubbed canvas
│   │   ├── avatar.ts     # Three.js viewer (lazy)
│   │   └── ui.ts         # nav, reveals, scroll spy
│   └── styles/
│       ├── tokens.css    # design tokens, reset, utilities
│       └── layout.css    # components and responsive rules
├── public/
│   ├── frames/           # desktop + mobile WebP tiers
│   ├── models/avatar.glb
│   ├── work/             # project screenshots
│   └── Pratham_Agarwal.pdf
└── firebase.json
```

## License

Content and images © Pratham Agarwal. Code is free to learn from.
