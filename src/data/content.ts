/**
 * Content data.
 *
 * Every claim here is traceable to a public artefact: the GitHub profile
 * README, a merged pull request, a live deployment, or a repository. Nothing
 * is estimated. Where a number could drift, it is marked with `asOf` so the
 * UI can show when it was last checked.
 */

export type Discipline = 'systems' | 'ai' | 'product' | 'tools' | 'security';

export interface Project {
  slug: string;
  title: string;
  discipline: Discipline;
  /** One sentence, plain. */
  summary: string;
  /** What problem it exists to solve. */
  problem: string;
  /** Why it was built this way. */
  approach: string;
  /** What I actually did. */
  role: string;
  stack: string[];
  /** Verified, observable outcomes only. */
  outcomes: string[];
  /** Notable engineering decisions and trade-offs. */
  decisions: Array<{ title: string; body: string }>;
  links: Array<{ label: string; href: string }>;
  image?: { src: string; alt: string; width: number; height: number };
  /** Architecture layers, rendered as a diagram. */
  architecture?: Array<{ label: string; detail: string }>;
  year: string;
}

export const PROJECTS: Project[] = [
  {
    slug: 'terminator',
    title: 'Terminator',
    discipline: 'systems',
    year: '2025',
    summary:
      'A Linux terminal emulator and shell written from scratch in C, with an X11 interface.',
    problem:
      'Terminal emulators hide their own machinery. Building one from the syscall boundary up is the only way to understand what a shell actually does between a keystroke and a process.',
    approach:
      'No PTY and no shell delegation. The program owns the window, parses the command line, forks and execs the child, and manages the job table itself.',
    role: 'Sole author — windowing, parser, process control, job control, build.',
    stack: ['C', 'X11', 'POSIX', 'pthreads'],
    outcomes: [
      'Runs as a native Linux X11 application',
      'Independent tabs, each with its own process group',
      'Pipelines and job control implemented directly',
      'Thread and process execution modes',
    ],
    decisions: [
      {
        title: 'No PTY',
        body: 'Skipping the pseudo-terminal removes a layer of indirection, which makes the fork/exec and signal path explicit. The cost is that full-screen curses programs are out of scope.',
      },
      {
        title: 'Two execution modes',
        body: 'Thread mode keeps the shell responsive while a child runs; process mode isolates each command. Having both made the trade-off between responsiveness and isolation concrete rather than theoretical.',
      },
      {
        title: 'X11 directly',
        body: 'No toolkit. Every widget is drawn, which keeps the binary small and forces the event loop to be understood rather than inherited.',
      },
    ],
    links: [
      { label: 'Project page', href: 'https://uniquepratham.github.io/Terminator/' },
      { label: 'Source', href: 'https://github.com/UniquePratham/Terminator' },
    ],
    image: {
      src: '/work/terminator.webp',
      alt: 'Terminator project page showing a shell running inside an X11 window',
      width: 1600,
      height: 1000,
    },
    architecture: [
      { label: 'X11 window', detail: 'Event loop, key mapping, glyph rendering' },
      { label: 'Line editor', detail: 'Buffer, history, cursor movement' },
      { label: 'Parser', detail: 'Tokenise, expand, split on pipes and redirection' },
      { label: 'Job table', detail: 'Process groups, foreground/background, signals' },
      { label: 'fork / exec', detail: 'Child creation, fd wiring, waitpid' },
    ],
  },
  {
    slug: 'locally-uncensored',
    title: 'Locally Uncensored',
    discipline: 'ai',
    year: '2026',
    summary:
      'A local-first AI desktop application for chat, agent mode, and image or video generation.',
    problem:
      'Most AI tooling assumes a cloud account and an API key. Running models on your own machine should not require Docker, a Python environment, or a network connection.',
    approach:
      'A single executable that detects which local inference backends are already installed and talks to them directly, so the app is a control surface rather than a runtime.',
    role: 'Contributor — header responsiveness and layout stability across Chat, Create and Compare views.',
    stack: ['TypeScript', 'Ollama', 'Desktop'],
    outcomes: [
      'Auto-detects 12 local backends',
      'Ships as a single executable — no Docker, no cloud, no API keys',
      'Merged upstream: 196 additions, 102 deletions across 4 files',
    ],
    decisions: [
      {
        title: 'Detect, do not bundle',
        body: 'Shipping the inference runtime would multiply the download and pin users to one backend. Detecting what is already installed keeps the app small and lets people keep the stack they chose.',
      },
      {
        title: 'Header as the hard part',
        body: 'The contribution was layout stability in the header across three views. A header that reflows between modes makes the whole app feel unreliable, so the fix was structural rather than cosmetic.',
      },
    ],
    links: [
      { label: 'Live', href: 'https://locallyuncensored.com' },
      { label: 'Source', href: 'https://github.com/PurpleDoubleD/locally-uncensored' },
      { label: 'My pull request', href: 'https://github.com/PurpleDoubleD/locally-uncensored/pull/60' },
    ],
    image: {
      src: '/work/locally-uncensored.webp',
      alt: 'Locally Uncensored landing page with a Windows download panel',
      width: 1600,
      height: 1000,
    },
    architecture: [
      { label: 'Desktop shell', detail: 'Single executable, local state' },
      { label: 'Backend detection', detail: 'Probe 12 local inference runtimes' },
      { label: 'Chat / Create / Compare', detail: 'Three modes over one session model' },
      { label: 'Local models', detail: 'Ollama and compatible backends' },
    ],
  },
  {
    slug: 'tigergraph-fraud',
    title: 'TigerGraph Fraud Platform',
    discipline: 'ai',
    year: '2026',
    summary:
      'An agentic fraud investigation console that traverses a transaction graph and grounds its findings in evidence.',
    problem:
      'Fraud analysts work from a queue of alerts with no shared context. Each case is investigated from scratch, and the reasoning behind a decision is rarely recorded in a form a regulator accepts.',
    approach:
      'Two-hop graph traversal finds the ring; GraphRAG grounds each claim in a retrieved fact; a dual-stage next-best-action decides what to do; the output is a FinCEN-style SAR narrative.',
    role: 'Built at HH Goa — investigation flow, evidence record, and the console interface.',
    stack: ['Python', 'TigerGraph', 'GraphRAG', 'LLM'],
    outcomes: [
      'Live investigation console with a case queue and ego-net graph',
      'Every finding carries a source and a confidence value',
      'Generates SAR-style narrative output',
    ],
    decisions: [
      {
        title: 'Evidence before inference',
        body: 'Each entry in the record is labelled observed fact or inference, with the query or knowledge base that produced it. A conclusion without a traceable source is not shown.',
      },
      {
        title: 'Two hops, not all hops',
        body: 'Two-hop traversal captures shared devices and mule rings without exploding into the whole graph. The limit is a deliberate trade between recall and query cost.',
      },
    ],
    links: [{ label: 'Live', href: 'https://web-console-three.vercel.app/' }],
    image: {
      src: '/work/tigergraph.webp',
      alt: 'TigerGraph fraud console showing a case queue, investigation progression and an ego-net graph',
      width: 1600,
      height: 1000,
    },
    architecture: [
      { label: 'Case queue', detail: 'Ranked by model risk score' },
      { label: 'Graph traversal', detail: 'Two-hop neighbourhood over transactions' },
      { label: 'GraphRAG', detail: 'Retrieve grounding facts per claim' },
      { label: 'Evidence record', detail: 'Observed fact vs inference, with source' },
      { label: 'SAR narrative', detail: 'Regulatory-format output' },
    ],
  },
  {
    slug: 'revenueos',
    title: 'RevenueOS',
    discipline: 'product',
    year: '2026',
    summary:
      'A merchant revenue console that reconciles payments, gates risk, and forecasts cash flow.',
    problem:
      'A merchant sees settlements arrive without knowing which orders they cover, what was held back, or what next week looks like. Reconciliation is done in a spreadsheet after the fact.',
    approach:
      'Model the money as a loop — order, payment, settlement, reconciliation — and put a controller over it that can act within bounded policy.',
    role: 'Product design and full-stack implementation, including the Razorpay integration.',
    stack: ['TypeScript', 'Razorpay', 'Fintech'],
    outcomes: [
      'Live dashboard with reconciliation match and revenue-at-risk',
      'Monte Carlo cash-flow projection adjusted for T+2 settlement',
      'Bounded merchant autonomy policies',
    ],
    decisions: [
      {
        title: 'Bounded autonomy',
        body: 'Automated actions are constrained by explicit policy limits. An agent that can move money without a ceiling is not shippable, so the ceiling is part of the model rather than a setting.',
      },
      {
        title: 'Show the uncertainty',
        body: 'The forecast is a band, not a line. A single projected number implies precision the data does not support.',
      },
    ],
    links: [
      { label: 'Live', href: 'https://revenue-os-razorpay.vercel.app' },
      { label: 'Source', href: 'https://github.com/UniquePratham/RevenueOS' },
    ],
    image: {
      src: '/work/revenueos.webp',
      alt: 'RevenueOS dashboard with revenue metrics, a cash-flow projection band and a finance brief',
      width: 1600,
      height: 1000,
    },
    architecture: [
      { label: 'Order intake', detail: 'Commerce events, order state' },
      { label: 'Payment gateway', detail: 'Razorpay capture and refunds' },
      { label: 'Reconciliation', detail: 'Bank vs gateway vs ledger' },
      { label: 'Risk gate', detail: 'Defensive checks before settlement' },
      { label: 'Controller', detail: 'Policy-bounded actions and forecasts' },
    ],
  },
  {
    slug: 'expenseflow',
    title: 'ExpenseFlow',
    discipline: 'product',
    year: '2026',
    summary:
      'Expense management built around multi-level approvals and conditional workflow rules.',
    problem:
      'Expense tools model submission well and approval badly. Real organisations have conditional chains — amount thresholds, cost centres, delegate approvers — that a fixed two-step flow cannot express.',
    approach:
      'Treat the approval chain as data. Rules evaluate against the claim, and the resulting chain is materialised per submission rather than hardcoded per form.',
    role: 'Full-stack implementation — workflow engine, OCR receipt intake, interface.',
    stack: ['TypeScript', 'OCR', 'Workflow'],
    outcomes: [
      'Live application with conditional approval routing',
      'OCR receipt scanning into structured line items',
      'Multi-currency support',
    ],
    decisions: [
      {
        title: 'Rules as data',
        body: 'Encoding approval logic in code means every policy change is a deploy. Evaluating rules against the claim keeps the chain inspectable and lets an admin see why a claim routed where it did.',
      },
      {
        title: 'OCR at intake',
        body: 'Extracting line items at upload means the approver reviews structured data instead of an image, which is where most of the time is actually spent.',
      },
    ],
    links: [
      { label: 'Live', href: 'https://expense-flow-project.vercel.app' },
      { label: 'Source', href: 'https://github.com/UniquePratham/ExpenseFlow' },
    ],
    image: {
      src: '/work/expenseflow.webp',
      alt: 'ExpenseFlow landing page with a recent expenses panel showing approved and pending claims',
      width: 1600,
      height: 1000,
    },
    architecture: [
      { label: 'Receipt intake', detail: 'Upload, OCR, line-item extraction' },
      { label: 'Claim', detail: 'Structured expense with currency' },
      { label: 'Rule engine', detail: 'Thresholds, cost centres, delegates' },
      { label: 'Approval chain', detail: 'Materialised per submission' },
    ],
  },
  {
    slug: 'gpu-poor',
    title: 'gpu_poor',
    discipline: 'tools',
    year: '2025',
    summary:
      'Calculates GPU memory and token throughput for any LLM across common quantisation schemes.',
    problem:
      'Deciding whether a model fits on your hardware means reading four different quantisation formats and doing the arithmetic yourself. The answer changes with context length, batch size and training method.',
    approach:
      'One form, one answer. Model size, quantisation, context length and hardware feed a memory model that reports what fits and what it will cost in throughput.',
    role: 'Sole author — memory model, quantisation tables, interface.',
    stack: ['JavaScript', 'LLM', 'Quantisation'],
    outcomes: [
      'Covers llama.cpp, GGML, bnb and QLoRA quantisation',
      'Reports memory requirement, token/s and training time',
      'Runs entirely in the browser',
    ],
    decisions: [
      {
        title: 'Client-side only',
        body: 'The calculation is arithmetic over a small table. A server would add latency and a privacy question for no benefit.',
      },
      {
        title: 'Name the uncertainty',
        body: 'Throughput depends on kernels and drivers, so the tool reports an estimate and the assumptions behind it rather than a single authoritative number.',
      },
    ],
    links: [
      { label: 'Live', href: 'https://uniquepratham.github.io/gpu_poor/' },
      { label: 'Source', href: 'https://github.com/UniquePratham/gpu_poor' },
    ],
    image: {
      src: '/work/gpu_poor.webp',
      alt: 'GPU Poor calculator with model configuration and token generation panels',
      width: 1600,
      height: 1000,
    },
  },
];

export interface Contribution {
  repo: string;
  repoUrl: string;
  title: string;
  problem: string;
  change: string;
  status: 'merged' | 'open' | 'closed';
  prUrl: string;
  date: string;
  /** Diff size, from the GitHub API. */
  diff?: { additions: number; deletions: number; files: number };
  kind: 'upstream' | 'collaboration';
}

export const CONTRIBUTIONS: Contribution[] = [
  {
    repo: 'ollama/ollama',
    repoUrl: 'https://github.com/ollama/ollama',
    title: 'Resolve OpenClaw gateway launch timeout on Windows',
    problem:
      'On Windows, the Node daemon bound to the IPv4 loopback while the Go health check probed `localhost`, which resolves to IPv6 first. The 500 ms probe expired before the IPv4 fallback, so Ollama reported that OpenClaw needed WSL2 when it was already running.',
    change:
      'Enforce the address family on the health check so the probe reaches the socket the daemon actually bound.',
    status: 'merged',
    prUrl: 'https://github.com/ollama/ollama/pull/15726',
    date: '2026-05-01',
    diff: { additions: 3, deletions: 3, files: 2 },
    kind: 'upstream',
  },
  {
    repo: 'PurpleDoubleD/locally-uncensored',
    repoUrl: 'https://github.com/PurpleDoubleD/locally-uncensored',
    title: 'Fix header responsiveness and layout stability',
    problem:
      'The Memory panel could render compressed and unusable, and the header reflowed between the Chat, Create and Compare views, which made the application feel unstable.',
    change:
      'Restructured the header layout and repositioned the Memory toggle so the panel keeps a usable size across all three views.',
    status: 'merged',
    prUrl: 'https://github.com/PurpleDoubleD/locally-uncensored/pull/60',
    date: '2026-06-12',
    diff: { additions: 196, deletions: 102, files: 4 },
    kind: 'upstream',
  },
];

export interface Collaboration {
  repo: string;
  url: string;
  what: string;
  merged: number;
}

export const COLLABORATIONS: Collaboration[] = [
  {
    repo: 'subhro1530/urbanmotion',
    url: 'https://github.com/subhro1530/urbanmotion',
    what: 'Car rental platform — dashboard, booking flow, payments, UI fixes',
    merged: 45,
  },
  {
    repo: 'HealthPlus',
    url: 'https://github.com/UniquePratham/HealthPlus',
    what: 'Health assistant front end and triage flows',
    merged: 26,
  },
  {
    repo: 'subhro1530/VitalityAI',
    url: 'https://github.com/subhro1530/VitalityAI',
    what: 'IoT health monitoring interface and alerting',
    merged: 15,
  },
  {
    repo: 'subhro1530/pangea-news',
    url: 'https://github.com/subhro1530/pangea-news',
    what: 'News reader — category routing and search',
    merged: 10,
  },
  {
    repo: 'subhro1530/acns-v4',
    url: 'https://github.com/subhro1530/acns-v4',
    what: 'Next.js application with Stripe payments and email',
    merged: 10,
  },
];

/** Totals verified against the GitHub search API. */
export const OSS_TOTALS = {
  merged: 169,
  repos: 18,
  asOf: '2026-11-22',
};

export interface TimelineEntry {
  year: string;
  title: string;
  detail: string;
  kind: 'education' | 'project' | 'open-source' | 'security' | 'award';
}

export const TIMELINE: TimelineEntry[] = [
  {
    year: '2022',
    title: 'B.Tech, Computer Science and Engineering',
    detail: 'University of Calcutta',
    kind: 'education',
  },
  {
    year: '2024',
    title: 'Urban Motion and Vitality AI',
    detail: 'Long-running collaboration on a car rental platform and an IoT health system',
    kind: 'project',
  },
  {
    year: '2025',
    title: 'Terminator',
    detail: 'A terminal emulator and shell written from scratch in C',
    kind: 'project',
  },
  {
    year: '2025',
    title: 'DEADFACE CTF',
    detail: 'Verified competitor, issued by Cyber Hacktics',
    kind: 'security',
  },
  {
    year: '2025',
    title: 'boroCTF — 104th, Open Division',
    detail: 'One of 20+ CTF events played',
    kind: 'security',
  },
  {
    year: '2026',
    title: 'ollama/ollama',
    detail: 'Merged a fix for the OpenClaw gateway launch timeout on Windows',
    kind: 'open-source',
  },
  {
    year: '2026',
    title: 'Oracle Agentic AI Foundations Associate',
    detail: 'Oracle certification',
    kind: 'award',
  },
  {
    year: '2026',
    title: 'M.Tech, Computer Science and Engineering',
    detail: 'IIT Kharagpur',
    kind: 'education',
  },
];

export interface Capability {
  domain: string;
  blurb: string;
  items: Array<{ name: string; usedIn?: string }>;
}

export const CAPABILITIES: Capability[] = [
  {
    domain: 'Systems',
    blurb: 'Where the abstractions come off.',
    items: [
      { name: 'C', usedIn: 'Terminator' },
      { name: 'C++' },
      { name: 'POSIX', usedIn: 'Terminator' },
      { name: 'X11', usedIn: 'Terminator' },
      { name: 'Go' },
      { name: 'Linux' },
    ],
  },
  {
    domain: 'Front end',
    blurb: 'Interfaces that hold their shape.',
    items: [
      { name: 'TypeScript', usedIn: 'RevenueOS' },
      { name: 'React' },
      { name: 'Next.js' },
      { name: 'CSS' },
      { name: 'Tailwind' },
      { name: 'Three.js' },
    ],
  },
  {
    domain: 'Back end',
    blurb: 'Services, streams and boundaries.',
    items: [
      { name: 'Node.js' },
      { name: 'Express' },
      { name: 'FastAPI' },
      { name: 'REST' },
      { name: 'SSE', usedIn: 'TigerGraph Fraud Platform' },
    ],
  },
  {
    domain: 'Data',
    blurb: 'Storage chosen for the query, not the fashion.',
    items: [
      { name: 'PostgreSQL' },
      { name: 'MongoDB' },
      { name: 'TigerGraph', usedIn: 'TigerGraph Fraud Platform' },
    ],
  },
  {
    domain: 'Applied AI',
    blurb: 'Models as components, not as products.',
    items: [
      { name: 'PyTorch' },
      { name: 'Hugging Face' },
      { name: 'Ollama', usedIn: 'Locally Uncensored' },
      { name: 'GraphRAG', usedIn: 'TigerGraph Fraud Platform' },
      { name: 'Computer vision' },
    ],
  },
  {
    domain: 'Security',
    blurb: 'Reading systems rather than using them.',
    items: [
      { name: 'CTF', usedIn: '20+ events' },
      { name: 'Linux tooling' },
      { name: 'Network analysis' },
    ],
  },
];

export interface FieldNote {
  slug: string;
  title: string;
  category: 'Systems' | 'Applied AI' | 'Security' | 'Open source';
  date: string;
  summary: string;
  body: string[];
}

export const FIELD_NOTES: FieldNote[] = [
  {
    slug: 'no-pty',
    title: 'What removing the PTY taught me about shells',
    category: 'Systems',
    date: '2025-11-02',
    summary:
      'Building Terminator without a pseudo-terminal made the fork/exec and signal path explicit — and made one limitation unavoidable.',
    body: [
      'A pseudo-terminal is the standard way to give a shell a terminal to talk to. It handles line discipline, echo, and the control sequences that full-screen programs depend on. Removing it means the program has to own all of that.',
      'The benefit is that nothing is hidden. When a keystroke arrives, the path from X11 event to line buffer to parsed command to forked child is all in the same codebase, and every step can be inspected.',
      'The cost is real: without a PTY, curses-style programs cannot run correctly. That is a deliberate scope boundary rather than an oversight, and it is the clearest example I have of a design decision that buys understanding at the price of compatibility.',
    ],
  },
  {
    slug: 'localhost-ipv6',
    title: 'Why `localhost` broke a health check on Windows',
    category: 'Open source',
    date: '2026-05-01',
    summary:
      'A 500 ms probe failed because `localhost` resolved to IPv6 first while the daemon had bound IPv4.',
    body: [
      'The daemon bound to `127.0.0.1`. The health check dialled `localhost`. On modern Windows, `localhost` resolves to `::1` before `127.0.0.1`, so the probe hit a closed port.',
      'With a generous timeout the client would have fallen back to IPv4 and succeeded. At 500 ms it gave up first, and the failure surfaced as a misleading message about needing WSL2.',
      'The fix was three lines: enforce the address family on the dial. The lesson is that a short timeout turns a resolution-order difference into an apparent product failure, and the error message pointed at the wrong subsystem entirely.',
    ],
  },
  {
    slug: 'evidence-grounding',
    title: 'Labelling inference as inference',
    category: 'Applied AI',
    date: '2026-08-14',
    summary:
      'In an investigation tool, the difference between an observed fact and a model inference has to be visible in the interface.',
    body: [
      'When an agent produces a finding, the useful question is not only what it concluded but what it was looking at. In the fraud console, every entry in the evidence record carries a label: observed fact, or inference.',
      'Observed facts cite the query that produced them. Inferences cite the knowledge base and a confidence value. Neither is presented as the other.',
      'This is a small interface decision with a large effect on trust. A reviewer can disagree with an inference without having to re-derive the underlying data, and the record stays auditable.',
    ],
  },
  {
    slug: 'bounded-autonomy',
    title: 'An agent that moves money needs a ceiling',
    category: 'Applied AI',
    date: '2026-09-20',
    summary:
      'Autonomy in a payments system is a policy problem before it is a model problem.',
    body: [
      'RevenueOS can act on a merchant account: retry a failed payment, flag a risk, reconcile a settlement. Each of those is a decision with a financial consequence.',
      'The design constraint was that no automated action may exceed an explicit policy limit. The limit is part of the data model, not a configuration flag, so an action that would breach it cannot be constructed.',
      'Making the invalid state unrepresentable is more reliable than checking for it later. It also makes the system easier to explain to someone who has to approve it.',
    ],
  },
];

export interface AtlasDestination {
  id: string;
  label: string;
  /** Position in the 1000x640 atlas viewBox. */
  x: number;
  y: number;
  /** Short line shown on hover. */
  hint: string;
  /** What is inside. */
  contents: string[];
  href: string;
}

export const DESTINATIONS: AtlasDestination[] = [
  {
    id: 'systems',
    label: 'Systems Lab',
    x: 168,
    y: 196,
    hint: 'C, POSIX, and what happens below the shell',
    contents: ['Terminator', 'Process and job control', 'X11'],
    href: '#/systems',
  },
  {
    id: 'intelligence',
    label: 'Intelligence Lab',
    x: 392,
    y: 118,
    hint: 'Applied AI, agents, and grounded inference',
    contents: ['Locally Uncensored', 'TigerGraph Fraud Platform', 'GraphRAG'],
    href: '#/intelligence',
  },
  {
    id: 'product',
    label: 'Product Studio',
    x: 640,
    y: 214,
    hint: 'Full-stack systems with money and approvals in them',
    contents: ['RevenueOS', 'ExpenseFlow'],
    href: '#/product',
  },
  {
    id: 'open-source',
    label: 'Open-Source Observatory',
    x: 846,
    y: 132,
    hint: 'Merged work in repositories I do not own',
    contents: ['ollama/ollama', 'locally-uncensored', '169 merged pull requests'],
    href: '#/open-source',
  },
  {
    id: 'security',
    label: 'Security Range',
    x: 300,
    y: 452,
    hint: 'CTF history and security tooling',
    contents: ['20+ CTF events', 'DEADFACE CTF', 'boroCTF 104th'],
    href: '#/security',
  },
  {
    id: 'notes',
    label: 'Field Notes',
    x: 556,
    y: 486,
    hint: 'What building these things actually taught me',
    contents: ['Systems', 'Applied AI', 'Open source'],
    href: '#/notes',
  },
  {
    id: 'archive',
    label: 'Archive',
    x: 790,
    y: 430,
    hint: 'Earlier projects and experiments',
    contents: ['Collaborations', 'Prototypes', 'Coursework'],
    href: '#/archive',
  },
  {
    id: 'person',
    label: 'The Person',
    x: 128,
    y: 520,
    hint: 'Education, timeline, and how I work',
    contents: ['B.Tech, Calcutta', 'M.Tech, IIT Kharagpur', 'Timeline'],
    href: '#/person',
  },
  {
    id: 'contact',
    label: 'Contact Station',
    x: 900,
    y: 540,
    hint: 'Where to reach me',
    contents: ['Email', 'GitHub', 'LinkedIn'],
    href: '#/contact',
  },
];

export const PROFILE = {
  name: 'Pratham Agarwal',
  role: 'Full stack developer',
  location: 'Kolkata, West Bengal, India',
  email: 'gargpratham71@gmail.com',
  phone: '+91 78966 65564',
  github: 'https://github.com/UniquePratham',
  linkedin: 'https://www.linkedin.com/in/uniquepratham',
  x: 'https://x.com/unique_pratham',
  instagram: 'https://www.instagram.com/unique_pratham',
  education: [
    { degree: 'M.Tech, Computer Science and Engineering', school: 'IIT Kharagpur', year: '2026' },
    {
      degree: 'B.Tech, Computer Science and Engineering',
      school: 'University of Calcutta',
      year: '2022',
    },
  ],
  philosophy:
    'I like knowing how a thing works underneath. That has meant writing a shell in C, wiring a payment reconciliation loop, and grounding an agent’s claims in evidence. The common thread is building the whole system rather than one layer of it, and being able to explain every decision in it.',
};
