/** Isla's Craft / SWELL operator brief. Help shows it. Isla reads it. Do not duplicate in MKT-2. */

export const CRAFT_MANUAL_NAV = ["laws", "week", "motion", "stacks", "desk", "gaps"] as const;
export type CraftManualNav = (typeof CRAFT_MANUAL_NAV)[number];

export type CraftDaySlot =
  | "monday-two-beat"
  | "tuesday-stamp"
  | "wednesday-voice"
  | "thursday-redact"
  | "friday-number"
  | "saturday-object"
  | "sunday-silence";

export type CraftMotionRole = "atmosphere" | "overlay" | "device" | "type" | "click";

export type CraftManualLaw = { title: string; rule: string };
export type CraftMotionUse = {
  id: string;
  name: string;
  group: "Atmosphere" | "Graphic devices" | "Structure" | "Occasional";
  role: CraftMotionRole;
  job: string;
};
export type CraftWeekPlaybook = {
  slot: CraftDaySlot;
  day: string;
  idea: string;
  must: string;
  forbidden: string;
  stack: string[];
  copy: string;
};
export type CraftManualStack = {
  id: string;
  title: string;
  outcome: string;
  plates: string[];
  law: string;
};
export type CraftManualBlock = { heading: string; body: string };
export type CraftManualSection = {
  id: CraftManualNav;
  title: string;
  lead: string;
  blocks: CraftManualBlock[];
};

export const CRAFT_OVERLAY_PRESETS = ["cinematic-hook-slam", "viral-hook-drop"] as const;

export const CRAFT_MANUAL_LAWS: CraftManualLaw[] = [
  {
    title: "Idea before board",
    rule: "Truth, tension, thought, platform — then open Craft. A handsome template with nothing in it is a failed board.",
  },
  {
    title: "Named slots are law",
    rule: "Hook 1, Hook 2, Deck, CTA, Hashtags, Links, Media frame or Visual, Identity, logo slot. Names bind copy. Rename and the week desk goes blind.",
  },
  {
    title: "Inspector adds, right-click replaces",
    rule: "Motion inspector click adds a new plate. Right-click a plate and pick a look to replace that plate. Same look on the selected plate replays it. Do not stack every preset on one node.",
  },
  {
    title: "Atmosphere under overlay",
    rule: "Opaque atmosphere is the ground. cinematic-hook-slam and viral-hook-drop are transparent overlays. Put glass down first, then slam the hook. An opaque card hides what is underneath.",
  },
  {
    title: "Live cap 8",
    rule: "Eight plates can run live. Prefer two: ground + overlay. Capture a still for email and Learn. GIF first frame must read as a poster.",
  },
  {
    title: "Packager, not lender",
    rule: "Copy must make it impossible to think Strata lends. No rates, APR, guaranteed, payday, we lend. Identity line in Mono. You export nothing; Shaun ships.",
  },
  {
    title: "Week file vs blank vs email",
    rule: "Week is seven li-landscape boards from grammar. Do not spawn story/square/OG onto a week file. Blank is studio. Email is the 600px letter with merge tags, captured stills only.",
  },
  {
    title: "One look system",
    rule: "One mask, one image look, one node motion, one shadow. Hard offset (4px) is the house shadow. Gold under 10% of area. No gradients, pills, glass orbs, or fifth accent.",
  },
];

export const CRAFT_WEEK_PLAYBOOKS: CraftWeekPlaybook[] = [
  {
    slot: "monday-two-beat",
    day: "Monday",
    idea: "Inversion. Hook 2 is the correction, not a slogan echo.",
    must: "Hook 1 + Hook 2 both visible. Identity present. Two-beat type.",
    forbidden: "A single slogan. Stock handshake. One line pretending to be two.",
    stack: ["horizon-shift", "cinematic-hook-slam"],
    copy: "Hook 1 is a complete-feeling half-truth. Hook 2 turns it. If Hook 2 can be deleted without pain, rewrite.",
  },
  {
    slot: "tuesday-stamp",
    day: "Tuesday",
    idea: "Identity is the object. The mark, the stamp, the lockup — not decoration around a photo.",
    must: "Stamp or lockup as the visual. Gold only here or on Light Leak.",
    forbidden: "Gold as fill. Decorative foil soup. A still of a building with a logo in the corner.",
    stack: ["stamp-pulse", "light-leak"],
    copy: "The line is issued, filed, stamped. Ledger Ticket pairing. Short.",
  },
  {
    slot: "wednesday-voice",
    day: "Wednesday",
    idea: "A named introducer sentence or a filed quote. Brand is the frame, not the speaker.",
    must: "A real voice. Brand frames it.",
    forbidden: "Fake headshot. Invented firm. You speaking as the introducer.",
    stack: ["grain-breath", "vellum-crease"],
    copy: "Borrowed authority. Attribution in Mono. No stock smile.",
  },
  {
    slot: "thursday-redact",
    day: "Thursday",
    idea: "Category myth exists only as artwork. Copy fields hold the correction only.",
    must: "Redact device on the myth. Copy never contains a banned phrase.",
    forbidden: "Banned words inside Hook, Body, or CTA. Myth as the headline you ship.",
    stack: ["redact-sweep", "declassified-text"],
    copy: "The correction is the line. The myth is a bar, a lift, a strike — not a quote.",
  },
  {
    slot: "friday-number",
    day: "Friday",
    idea: "One integer or count that is a policy or a desk fact. Not a rate.",
    must: "One count. DataTicker or odometer. Mono.",
    forbidden: "% APR from rate tables. From X%. Confetti numbers.",
    stack: ["ledger-ticker", "odometer-roll"],
    copy: "One number Casey verified. If the bite is missing, the board is silence plus process, not an invented stat.",
  },
  {
    slot: "saturday-object",
    day: "Saturday",
    idea: "One object witness. A letter, a file, a stamp on manila. The object testifies.",
    must: "Media frame holds a Kit still or a captured plate. Object, not a person performing.",
    forbidden: "Glass tower, lawn, handshake, skyline, phone-in-hand.",
    stack: ["vapor-drift"],
    copy: "Caption documentary. Inter in the margin. The object is the hook.",
  },
  {
    slot: "sunday-silence",
    day: "Sunday",
    idea: "Leave the board empty enough. Max eight words. No still required.",
    must: "Hook 1 only, or the empty board. Hide CTA, still, Hook 2, eyebrow.",
    forbidden: "Panic-fill. Extra CTAs. A week-recap paragraph.",
    stack: ["breathing-monument"],
    copy: "Eight words or fewer. Japanese Ma. If it needs a deck, it is not Sunday.",
  },
];

export const CRAFT_MANUAL_STACKS: CraftManualStack[] = [
  {
    id: "glass-slam",
    title: "Scroll-stop GIF",
    outcome: "Dark glass, transparent hook slam, you record the GIF.",
    plates: ["liquid-glass-shift", "cinematic-hook-slam"],
    law: "Recipe hook-gif. Double-click the slam, type the hook, Record GIF yourself. First frame is a poster.",
  },
  {
    id: "vapor-still",
    title: "Artwork still",
    outcome: "Mist captured into the kit as photography.",
    plates: ["vapor-drift"],
    law: "Recipe still-art. Capture still. Email and Learn hang the bitmap, never the live sim.",
  },
  {
    id: "stamp-leak",
    title: "Tuesday identity",
    outcome: "Stamp as object, gold as a needle leak.",
    plates: ["stamp-pulse", "light-leak"],
    law: "Gold under 10%. Identity is the visual. Not foil soup.",
  },
  {
    id: "redact-myth",
    title: "Thursday correction",
    outcome: "Myth as artwork, truth as copy.",
    plates: ["redact-sweep", "declassified-text"],
    law: "Banned words never persist in Hook/Body/CTA. copyExempt on the sweep.",
  },
  {
    id: "ticker-count",
    title: "Friday count",
    outcome: "One integer moving in Mono.",
    plates: ["ledger-ticker", "odometer-roll"],
    law: "No rates. If Casey has no number, do not invent one.",
  },
  {
    id: "two-beat-glass",
    title: "Monday turn",
    outcome: "Horizon lean under a slammed two-beat hook.",
    plates: ["horizon-shift", "cinematic-hook-slam"],
    law: "Hook 2 is the correction. Type the slam; do not leave FILE FIRST on a week board.",
  },
  {
    id: "object-mist",
    title: "Saturday witness",
    outcome: "Kit object on paper, optional vapor then capture.",
    plates: ["vapor-drift"],
    law: "Hang Kit first. Grok second. Licence on the ImageNode. No grey frame.",
  },
  {
    id: "sunday-monument",
    title: "Sunday Ma",
    outcome: "Huge type breathing, or the empty board.",
    plates: ["breathing-monument"],
    law: "Max eight words. Hide the still. Do not panic-fill.",
  },
  {
    id: "drip-word",
    title: "Word as liquid",
    outcome: "The hook pours into being.",
    plates: ["dripping-text"],
    law: "Beautiful Insane only. Set Word on plate. Honey for patience, ink for filing, water for speed. Capture or GIF. Not the default week visual.",
  },
  {
    id: "repair-gold",
    title: "Kintsugi mend",
    outcome: "The word cracks and heals in gold — layer by layer as craft, not as slogan.",
    plates: ["kintsugi-mend"],
    law: "Gold is the seam, not the fill. Brand idea, not a texture pack.",
  },
];

export const CRAFT_MANUAL_MOTION: CraftMotionUse[] = [
  { id: "ledger-current", name: "Ledger Current", group: "Atmosphere", role: "atmosphere", job: "Default living ground. Silk current. Use when motion must exist without becoming the joke." },
  { id: "paper-sparks", name: "Paper Sparks", group: "Atmosphere", role: "atmosphere", job: "After-hours dust over a desk. Night Underwriting. Not confetti." },
  { id: "grain-breath", name: "Grain Breath", group: "Atmosphere", role: "atmosphere", job: "Almost still. Paper tooth. Wednesday, email captures, reduced-motion cousin." },
  { id: "after-hours-warp", name: "After-hours Warp", group: "Atmosphere", role: "atmosphere", job: "Heat distortion after closing. Canvas house look — do not load Three.js onto a LinkedIn board." },
  { id: "vapor-drift", name: "Vapor Drift", group: "Atmosphere", role: "atmosphere", job: "Slow mist across paper, not a grid of ellipses. Capture stills from this." },
  { id: "static-shiver", name: "Static Shiver", group: "Atmosphere", role: "atmosphere", job: "CRT noise. Surveillance, myth, declassified. Pair with redact, not with a handshake still." },
  { id: "vignette-breathing", name: "Vignette Breathing", group: "Atmosphere", role: "atmosphere", job: "Edge pulse. Quiet authority. Lets type sit." },
  { id: "horizon-shift", name: "Horizon Shift", group: "Atmosphere", role: "atmosphere", job: "Lean between panes. Monday two-beat ground." },
  { id: "carbon-weave", name: "Carbon Weave", group: "Atmosphere", role: "atmosphere", job: "Parallax depth. Introducer structure without drawing a fake network." },
  { id: "parchment-heat", name: "Parchment Heat", group: "Atmosphere", role: "atmosphere", job: "Haze over filing. Paper Audit world." },
  { id: "liquid-quartz", name: "Liquid Quartz", group: "Atmosphere", role: "atmosphere", job: "Surface tension. Premium, hover. Not a fintech blob." },
  { id: "liquid-glass-shift", name: "Liquid Glass Shift", group: "Atmosphere", role: "atmosphere", job: "Dark glass with a moving sheen. Atmosphere under hook slam. Default GIF ground." },
  { id: "thermal-heat-bloom", name: "Thermal Heat Bloom", group: "Atmosphere", role: "atmosphere", job: "Warmth over a long draft. Support plate, never the idea." },
  { id: "dynamic-focal-vignette", name: "Dynamic Focal Vignette", group: "Atmosphere", role: "atmosphere", job: "Density tightens around the line. Deck-led boards." },
  { id: "vellum-hysteresis", name: "Vellum Hysteresis", group: "Atmosphere", role: "atmosphere", job: "Lag, memory, patience. The file that took time." },
  { id: "gravitational-field", name: "Gravitational Field", group: "Atmosphere", role: "atmosphere", job: "Pull toward a point. GIF loops without a cursor — do not make mousemove the only idea." },
  { id: "breathing-monument", name: "Breathing Monument", group: "Atmosphere", role: "type", job: "Huge type breathing. Sunday, fame, the pause after a dense week." },
  { id: "vanishing-point-tunnel", name: "Vanishing Point Tunnel", group: "Atmosphere", role: "atmosphere", job: "Portal. Beautiful Insane only. Not Safe Distinctive." },
  { id: "sundial-shadow", name: "Sundial Type", group: "Atmosphere", role: "atmosphere", job: "Time of day as light. Waiting, hours, Friday without a rate." },

  { id: "stamp-pulse", name: "Stamp Pulse", group: "Graphic devices", role: "device", job: "Tuesday. Identity slam. Gold needle. Click replays." },
  { id: "redact-sweep", name: "Redact Sweep", group: "Graphic devices", role: "device", job: "Thursday. Bar over the myth. Never writes copy. Keep copyExempt." },
  { id: "ink-bleed", name: "Ink Bleed", group: "Graphic devices", role: "device", job: "Letterpress squash. Handcraft Folk Press. One genuine impression." },
  { id: "light-leak", name: "Light Leak", group: "Graphic devices", role: "device", job: "One optical flare. Gold Needle world. The only other gold besides Tuesday stamp." },
  { id: "ledger-fracture", name: "Ledger Fracture", group: "Graphic devices", role: "click", job: "Crack on click. Decline, break, then structure. Not a default week visual." },
  { id: "cybernetic-scanline", name: "Cybernetic Scanline", group: "Graphic devices", role: "device", job: "Scan sweep. Use sparingly — Strata is paper, not HUD." },
  { id: "ledger-margin-glow", name: "Ledger Margin Glow", group: "Graphic devices", role: "device", job: "Soft active edge. Support, not hero." },
  { id: "resin-gloss-sweep", name: "Resin Gloss Sweep", group: "Graphic devices", role: "device", job: "One gloss pass across glass. Quiet luxury. Not a gradient fill." },
  { id: "holographic-foil", name: "Holographic Foil", group: "Graphic devices", role: "device", job: "Sheen on hover. Easy to overdo. One object, then stop." },
  { id: "vellum-crease", name: "Vellum Crease", group: "Graphic devices", role: "device", job: "Fold catching desk light. Wednesday paper. Documentary Britain." },
  { id: "prismatic-focal-shift", name: "Prismatic Focal Shift", group: "Graphic devices", role: "click", job: "RGB fringe on focus change. Occasional, not house default." },
  { id: "magnetic-edge-snap", name: "Magnetic Edge Snap", group: "Graphic devices", role: "click", job: "Dock recoil. Grid discipline made visible." },
  { id: "kinetic-stencil-punch", name: "Kinetic Stencil Punch", group: "Graphic devices", role: "type", job: "Cutout letters with depth. Swiss Brutal. One word can be the ad." },
  { id: "guilloche-wave", name: "Guilloche Wave", group: "Graphic devices", role: "device", job: "Security-paper rosette. Trust as engraving, not as a padlock icon." },
  { id: "origami-unfold", name: "Origami Unfold", group: "Graphic devices", role: "device", job: "Document unfolding. The pack arriving. One cycle, then rest." },
  { id: "isometric-extrusion", name: "Isometric Extrusion", group: "Graphic devices", role: "device", job: "Blueprint rising. Structure taking shape. Layer by layer, literally." },
  { id: "mechanical-escapement", name: "Mechanical Escapement", group: "Graphic devices", role: "device", job: "Gear interlock. Precision, filing, the underwriter's clock." },
  { id: "glowing-pill-pulse", name: "Glowing Pill Pulse", group: "Graphic devices", role: "device", job: "Lead-gen capsule only. House law hates pills — use as the exception that names a capture, not as UI chrome." },
  { id: "redact-highlight", name: "Redact Highlight", group: "Graphic devices", role: "device", job: "Wipe across the hook. Thursday cousin of the sweep. Correction remains." },
  { id: "stroke-reveal-check", name: "Stroke Reveal Check", group: "Graphic devices", role: "device", job: "A tick drawing itself. Progress Green Hour. File complete, not 'approved'." },
  { id: "telemetry-ghost", name: "Telemetry Ghost", group: "Graphic devices", role: "device", job: "Scan overlay hunting a lock. Use on a word, then get out. Not a dashboard screenshot." },
  { id: "reality-buffering", name: "Reality Buffering", group: "Graphic devices", role: "device", job: "The chrome fails; the word stays. Banks that stall. The wait is the product." },
  { id: "slow-fax", name: "Slow Fax", group: "Graphic devices", role: "type", job: "Thermal print, line by line. Patience. HMRC paper. Not a loading spinner." },
  { id: "halftone-lamp", name: "Halftone Lamp", group: "Graphic devices", role: "device", job: "Dots relit by a lamp. Print, press, night desk. Cursor-follow is a studio extra, not the GIF idea." },

  { id: "corporate-ribbon", name: "Corporate Ribbon", group: "Structure", role: "atmosphere", job: "Strata wave, blue on paper. Geology as flag. House structure when you need a band, not a stripe." },
  { id: "perspective-grid", name: "Perspective Grid", group: "Structure", role: "atmosphere", job: "Vanishing paper city. Use if the thought is distance, not if you miss a skyline still." },
  { id: "network-map", name: "Network Map", group: "Structure", role: "device", job: "Introducer nodes. Thin edges. Never a hex-and-orb 'ecosystem' graphic." },
  { id: "hook-turn", name: "Hook Turn", group: "Structure", role: "type", job: "Kinetic two-beat. Reads sibling Hook 1 / Hook 2. Monday's type instrument." },
  { id: "ledger-ticker", name: "Ledger Ticker", group: "Structure", role: "type", job: "Mono numerals. Friday. LEDGER, ON TIME, FILE — never APR." },
  { id: "dripping-text", name: "Dripping Text", group: "Structure", role: "type", job: "Liquid pours into the word. Inspector: liquid, drop shape, drip motion, gravity, interact. Set Word on plate. Beautiful Insane, not the week default." },
  { id: "elastic-spring", name: "Elastic Spring", group: "Structure", role: "device", job: "Card reveal. One overshoot, then settle. Not jelly bounce on every node." },
  { id: "kinetic-squeeze", name: "Kinetic Squeeze", group: "Structure", role: "type", job: "Type stretch. Pressure. The squeeze before a decision." },
  { id: "crosshair-grid-track", name: "Crosshair Grid Track", group: "Structure", role: "device", job: "Cursor lag on a grid. Studio only. GIFs need a self-running loop." },
  { id: "typewriter-cursor", name: "Typewriter Cursor", group: "Structure", role: "type", job: "Blink on the active file. Filing, drafting, the memo." },
  { id: "ledger-stitch", name: "Ledger Stitch", group: "Structure", role: "device", job: "Seam drawing around the card. Binding the pack." },
  { id: "kinetic-momentum-glide", name: "Kinetic Momentum Glide", group: "Structure", role: "device", job: "Heavy glass panel with weight. Quiet luxury motion." },
  { id: "acoustic-waveform-pulse", name: "Acoustic Waveform Pulse", group: "Structure", role: "device", job: "Listening. Voice notes, Wednesday quote, transcription as metaphor — not a podcast ad." },
  { id: "resonance-blur", name: "Resonance Blur", group: "Structure", role: "device", job: "Typing velocity made visible. Use once. First frame still has to read." },
  { id: "topographic-contour", name: "Topographic Contour", group: "Structure", role: "atmosphere", job: "Word-density as geology. Brand idea as map." },
  { id: "elastic-threading", name: "Elastic Threading", group: "Structure", role: "device", job: "Spring lines between points. Introducer to packager to lender — structure, not a org-chart." },
  { id: "voronoi-partition", name: "Voronoi Partition", group: "Structure", role: "device", job: "Cells across the grid. Layers as territory. One accent." },
  { id: "liquid-text-mask", name: "Liquid Text Mask", group: "Structure", role: "type", job: "Gradient moving through the hook. Kinetic Type Culture. Keep gold under 10%." },
  { id: "odometer-roll", name: "Odometer Roll", group: "Structure", role: "type", job: "Mechanical digits. Friday counts. Word on plate is the number." },
  { id: "kinetic-word-press", name: "Kinetic Word Press", group: "Structure", role: "type", job: "Letters as pistons. The press. Folk press school with force." },
  { id: "kinetic-assembly", name: "Kinetic Assembly", group: "Structure", role: "type", job: "Letters fly in and lock. Building the file. Layer by layer as type." },
  { id: "kintsugi-mend", name: "Kintsugi Mend", group: "Structure", role: "type", job: "Crack, then gold seam. Repair. Brand idea without saying the metaphor." },
  { id: "hourglass-countdown", name: "Hourglass Countdown", group: "Structure", role: "type", job: "Loops a demo span. Not a real deadline, not scarcity marketing. Waiting, not urgency-spam." },
  { id: "pendulum-letters", name: "Pendulum Letters", group: "Structure", role: "type", job: "Letters on threads. Time, patience, the long wait at the bank." },

  { id: "goo-merge", name: "Goo Merge", group: "Occasional", role: "occasional", job: "Lawful blob on paper. Rare. Not slime for its own sake." },
  { id: "shatter-plate", name: "Shatter Plate", group: "Occasional", role: "click", job: "Crack on click. Decline as break. Then the correction in type." },
  { id: "ink-splash-bloom", name: "Ink Splash Bloom", group: "Occasional", role: "click", job: "Press bloom. One hit. Folk press." },
  { id: "quantum-glitch", name: "Quantum Glitch", group: "Occasional", role: "occasional", job: "RGB split burst. Banks that stall, systems that hiccup. Not a default texture." },
  { id: "ink-ripple", name: "Ink Ripple", group: "Occasional", role: "click", job: "Distortion from a click. A decision landing." },
  { id: "focus-pull", name: "Focus Pull", group: "Occasional", role: "occasional", job: "Rack focus into the plate. Documentary. Let the object arrive." },
  { id: "magnetic-ripple", name: "Magnetic Ripple", group: "Occasional", role: "click", job: "Pop ring when a block locks. File complete." },
  { id: "kinetic-strobe-pulse", name: "Kinetic Strobe Pulse", group: "Occasional", role: "occasional", job: "Ultra-subtle flicker. Easy to make cheap. Keep opacity low or skip." },
  { id: "anode-flicker-decay", name: "Anode Flicker Decay", group: "Occasional", role: "occasional", job: "Dim as the workspace closes. Endframe, Sunday, after hours." },
  { id: "phosphor-burn-in", name: "Phosphor Burn-In", group: "Occasional", role: "occasional", job: "Ghost of high-contrast type. Memory of a line. Night Underwriting." },
  { id: "quantum-entanglement", name: "Quantum Entanglement", group: "Occasional", role: "occasional", job: "Linked nodes pulse together. Introducer and director, same file." },
  { id: "viral-hook-drop", name: "Viral Hook Drop", group: "Occasional", role: "overlay", job: "Transparent overshoot overlay for reels. Stack on atmosphere. Type the word. Not the week default." },
  { id: "cinematic-hook-slam", name: "Cinematic Hook Slam", group: "Occasional", role: "overlay", job: "Transparent strobe-scale slam. Glass then slam. Recipe hook-gif. Double-click to type." },
  { id: "word-vortex", name: "Word Vortex", group: "Occasional", role: "type", job: "Copies of the word spinning. Kinetic Type. Beautiful Insane. Keep it readable on frame one." },
  { id: "chromatic-misregister", name: "Chromatic Misregister", group: "Occasional", role: "occasional", job: "Misregistered duplicates. Letterpress error as craft. Folk press, not a glitch-core poster." },
  { id: "icon-weather-system", name: "Icon Weather System", group: "Occasional", role: "occasional", job: "Symbols raining. Easy to look like clip-art weather. Skip unless the thought is climate of paperwork." },
  { id: "stillness-static", name: "Stillness Static", group: "Occasional", role: "type", job: "Word resolves out of noise. Recognition arriving. Then it can scramble again." },
  { id: "declassified-text", name: "Declassified Text", group: "Occasional", role: "type", job: "Redacted paragraph lifts word by word. Thursday. Myth as artwork." },
  { id: "ferrofluid-pull", name: "Ferrofluid Pull", group: "Occasional", role: "occasional", job: "Magnetic spikes. Occasional object. Not a default texture on a week card." },
  { id: "murmuration", name: "Murmuration", group: "Occasional", role: "occasional", job: "Flock collapsing into the word. Beautiful Insane. Heavy. One board, not seven." },
  { id: "favicon-escape", name: "Tab Escape", group: "Occasional", role: "type", job: "Letters climb into a mock browser tab and return. Attention leaving the feed. Occasional, not a week default." },
  { id: "absence-bloom", name: "Moss Bloom", group: "Occasional", role: "type", job: "Moss grows over the word, then clears. Time passing on an unworked file. Patience, not decay-porn." },
  { id: "selection-ink", name: "Ink Pileup", group: "Occasional", role: "type", job: "Collected words fall in as pills and stack. Evidence accumulating. Not a tag cloud." },
];

const DESK_BLOCKS: CraftManualBlock[] = [
  {
    heading: "What you are operating",
    body: "SWELL is a canvas compositor plus the week pipeline. One document: pages, nodes (text, shape, image, motion), brand kit, history. Social mode is /craft. Email mode is the same canvas as a 600×900 letter. Editorial is a different desk — Markdown, not this compositor.",
  },
  {
    heading: "Tools and keys",
    body: "V select, T text, S shape, I image. Arrows nudge 1px (Shift 10). Cmd/Ctrl+D duplicate, Z undo, Shift+Z redo, S save, Enter edits text or motion caption, Delete removes, Escape deselects, ? opens this studio. Space-drag pans. Cmd-scroll zooms 0.08×–8×. Right-click is the context menu: shape swap, frame mask, shadow, opacity, motion presets, z-order, duplicate, replace image, Record GIF on a plate.",
  },
  {
    heading: "Inspector",
    body: "Page (size, background). Merge (email chips: firstName, companyName, senderName, senderCompany, unsubscribeLink). Images (Yaffle still; 'Describe a current' patches or inserts Ledger Current). Brand (name, logo, six roles, heading/body, Apply / Save kit / Use kit). Size (17 presets; spawn story/square/OG — skip on a week file). Templates (16 house boards — start here, mutate). Shapes (18, grouped). Motion (87 house plates — click adds). Selection (per-node: name, opacity, shadow, type styles, frame, look, drip controls when the plate is Dripping Text). Export (PNG, pack, formats — locked on mkt- until marketing approve and compliance). History (jump checkpoints).",
  },
  {
    heading: "Motion plate controls",
    body: "Word on plate beats sibling Hook 1 for that node. Texture: solid, scanlines, grid, dots, waves, noise, paper. Four filament colours. Physics sliders. Trigger / blend / fps. Capture still. Record GIF. Replay pour. Advanced JSON is last-resort. Dripping Text also: liquids honey/water/slime/wax/ink/gel, drop shapes, drip motions, gravity/drift/viscosity/chaos, font, interact none/ripple/attract/repel/stretch.",
  },
  {
    heading: "Type, mask, look, shadow",
    body: "Text styles: Eyebrow, Heading, Subhead, Body, Caption, Stat. House trio: Unbounded hook, Inter deck, JetBrains Mono identity and numbers. Masks: Rect, Round, Arch, Diamond, Hex, Polaroid, Ticket, Star, Triangle, Heart, Speech, Banner, Cloud, Chevron. Looks: Plain through Punch (17). Shadows: None, Soft, Drop, Hard — house week wants hard offset 4px. Node CSS motion (not MotionNode): Still, Fade in, Slide in, Pop, Pulse, Hook turn, Stamp down. One per board unless the weekday contract says otherwise.",
  },
  {
    heading: "Templates and sizes",
    body: "Week boards are li-landscape 1200×627 from materialiseWeek. House templates: Introducer Post, Full-Bleed Story, Read the Small Print, Decline Autopsy, The Monthly Numbers, HMRC Actually, Open Graph Rail, LinkedIn Cover, LinkedIn landscape, Email Mast, Strata Layer Email, Caption GIF, Strata Explains, The Lender's Checklist, Introducer Testimonial, Founder Card, Learn Tools Menu. Start from a template. Mutate. Do not rebuild the house from empty boxes unless the idea needs a new format.",
  },
  {
    heading: "Copy limits (counted, not estimated)",
    body: "Eyebrow 36, Hook 1 40, Hook 2 36, Deck 120, CTA 28, ≤3 hashtags, ≤2 https links. Write 39/34. CTA is a verb and a destination. Two-beat: Hook 1 ink, Hook 2 gold. Deck: mechanism, then packager identity — never the reverse.",
  },
  {
    heading: "Export and persistence",
    body: "Week posts lock until approved and compliance-cleared. Recipes never download. You click PNG, Export pack, or Record GIF. Copy follows the account. The polished board lives in this browser (IndexedDB nexus-craft). Say that plainly. Do not spawn pack pages onto a week file — the desk already has extraPresets for story/square/OG.",
  },
];

const GAP_BLOCKS: CraftManualBlock[] = [
  {
    heading: "Not a drawer",
    body: "INSERT_COMPONENTS (caption bars, CTA pill, badge, quote stack, and the rest) are defined in templates.ts and are not wired to a visible inspector button. Do not fail a board for skipping them. Build the equivalent with named text and shape nodes.",
  },
  {
    heading: "No pen tool",
    body: "PathNode renders. Nothing in the UI creates one. Do not invent a pen.",
  },
  {
    heading: "Motion Lab",
    body: "/motion-lab is a preset playground, not a shipping surface. Learn a look there, then put it on a Craft board.",
  },
  {
    heading: "What you do not own",
    body: "Posting, ads, lender choice, invented numbers, client names. SOCIAL-1 owns the feed. Casey owns research. Kit owns stills. Shaun ships.",
  },
];

export const CRAFT_MANUAL_SECTIONS: CraftManualSection[] = [
  {
    id: "laws",
    title: "Studio laws",
    lead: "You are Isla Quinn. This is the licence. Skip a law and the board is decoration.",
    blocks: CRAFT_MANUAL_LAWS.map((item) => ({ heading: item.title, body: item.rule })),
  },
  {
    id: "week",
    title: "Week — seven-day machine",
    lead: "One platform line. Seven jobs. If Monday and Thursday look like the same template with a swapped noun, the week is not done.",
    blocks: CRAFT_WEEK_PLAYBOOKS.map((play) => ({
      heading: `${play.day} — ${play.slot}`,
      body: `${play.idea} Must: ${play.must} Forbidden: ${play.forbidden} Stack: ${play.stack.join(" → ")}. Copy: ${play.copy}`,
    })),
  },
  {
    id: "motion",
    title: "Motion plates",
    lead: "Every house preset, with a job. Inspector adds a layer. Right-click replaces this plate. Overlays sit on atmosphere. Live cap 8.",
    blocks: CRAFT_MANUAL_MOTION.map((item) => ({
      heading: `${item.name} (${item.id})`,
      body: `${item.group} · ${item.role}. ${item.job}`,
    })),
  },
  {
    id: "stacks",
    title: "How a board becomes famous",
    lead: "A week that never produces a hook GIF or a Saturday object is incomplete. Point at a stack. Then mutate.",
    blocks: CRAFT_MANUAL_STACKS.map((item) => ({
      heading: item.title,
      body: `${item.outcome} Plates: ${item.plates.join(" + ")}. ${item.law}`,
    })),
  },
  {
    id: "desk",
    title: "The desk itself",
    lead: "Every control is an instrument. Using only a template and a text box is FM-15.",
    blocks: DESK_BLOCKS,
  },
  {
    id: "gaps",
    title: "Do not pretend",
    lead: "If it is not shipped, do not stage it as shipped.",
    blocks: GAP_BLOCKS,
  },
];

export function weekPlaybook(slot: string | undefined): CraftWeekPlaybook | undefined {
  if (!slot) return undefined;
  return CRAFT_WEEK_PLAYBOOKS.find((item) => item.slot === slot);
}

export function craftManualSection(id: string): CraftManualSection | undefined {
  return CRAFT_MANUAL_SECTIONS.find((item) => item.id === id);
}

export function islaStudioBrief(): string {
  const laws = CRAFT_MANUAL_LAWS.map((item) => `- ${item.title}: ${item.rule}`).join("\n");
  const week = CRAFT_WEEK_PLAYBOOKS.map(
    (play) => `${play.day} (${play.slot}): ${play.must} Stack ${play.stack.join(" + ")}. Forbidden: ${play.forbidden}`,
  ).join("\n");
  return `ISLA STUDIO BRIEF — SWELL / Craft operator licence. Full file: shared/craftManual.ts. Recipes: shared/craftHelp.ts. If live Craft disagrees, obey the live app.

You are Isla Quinn (MKT-2). Idea before board. Named slots: Hook 1, Hook 2, Deck, CTA, Hashtags, Links, Media frame|Visual, Identity, logo. Inspector click ADDS a motion plate. Right-click REPLACES that plate. Overlays (transparent): cinematic-hook-slam, viral-hook-drop. Put atmosphere down first. Live cap 8. Email/Learn: capture still. GIF first frame reads as a poster. Recipes never export. Shaun ships. Packager, not lender.

LAWS
${laws}

WEEK
${week}

DRIP: dripping-text is a liquid sim (honey/water/ink…). Set Word on plate. Not the week default.

Do not use the insertable-component drawer — it is not wired. Build with named nodes. Path tool is not shipped.`;
}
