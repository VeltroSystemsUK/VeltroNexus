export const CRAFT_HELP_ACTION_TYPES = [
  "ensureDoc",
  "applyTemplate",
  "addMotion",
  "replaceMotionPreset",
  "addText",
  "captureMotionStill",
  "spawnPackPages",
] as const;

export type CraftHelpActionType = (typeof CRAFT_HELP_ACTION_TYPES)[number];

export type CraftHelpAction =
  | { type: "ensureDoc"; mode: "blank" | "email-letter" }
  | { type: "applyTemplate"; templateId: string }
  | { type: "addMotion"; presetId: string }
  | { type: "replaceMotionPreset"; presetId: string }
  | { type: "addText"; style?: "heading" | "body" | "caption"; text?: string }
  | { type: "captureMotionStill" }
  | { type: "spawnPackPages" };

export type CraftHelpStep = {
  title: string;
  body: string;
  action?: CraftHelpAction;
  hint?: string;
};

export const CRAFT_HELP_RECIPE_IDS = [
  "week-post",
  "hook-gif",
  "still-art",
  "stack-layers",
  "email-letter",
] as const;

export type CraftHelpRecipeId = (typeof CRAFT_HELP_RECIPE_IDS)[number];

export type CraftHelpRecipe = {
  id: CraftHelpRecipeId;
  title: string;
  outcome: string;
  steps: CraftHelpStep[];
};

export type CraftHelpNav = "desk" | "recipes" | "rules";

export const CRAFT_HELP_DESK: { title: string; body: string }[] = [
  {
    title: "What this desk is",
    body: "SWELL is a canvas compositor plus the week pipeline. You place type, stills, shapes, and living motion plates on a page, then export PNG, a size pack, or a GIF. Email uses the same canvas as a 600px letter.",
  },
  {
    title: "Week vs blank vs email",
    body: "The queue opens seven house boards from Casey ammo and Isla copy. A blank is a studio file. Email is the letter preset with merge tags. Do not spawn story/square/OG onto a week file.",
  },
  {
    title: "Motion is a node",
    body: "A motion plate is a layer, like an image. Inspector click adds a new plate. Right-click a plate to change that plate's look. Overlay plates (hook slam, viral hook) are transparent so atmosphere can show through.",
  },
  {
    title: "Export is a decision",
    body: "Week posts need marketing approve then compliance sign-off. Recipes never download files. You click PNG, Export pack, or Record GIF yourself.",
  },
];

export const CRAFT_HELP_RULES: { title: string; body: string }[] = [
  {
    title: "Packager, not lender",
    body: "Strata packages. Strata does not lend. Copy needs the packager identity. Never write rates, APR, guaranteed, payday, or we lend.",
  },
  {
    title: "Layers",
    body: "Inspector adds a plate. Right-click replaces this plate. Same look on the selected plate replays it. Up to eight plates can run live.",
  },
  {
    title: "Overlays and mist",
    body: "Hook slam and viral hook sit on glass as transparent type. Vapor Drift is soft mist, not ellipses.",
  },
  {
    title: "No auto-publish",
    body: "Shaun ships. Recipes do not save, delete, or post.",
  },
];

export const CRAFT_HELP: CraftHelpRecipe[] = [
  {
    id: "week-post",
    title: "High-quality social post",
    outcome: "Branded board with named copy, a visual decision, and a spawned pack. You export.",
    steps: [
      {
        title: "Open a studio file",
        body: "Week desk is Casey ammo then Isla copy. A blank is for one-off artwork. Do not invent rates.",
        action: { type: "ensureDoc", mode: "blank" },
      },
      {
        title: "Start from Introducer Post",
        body: "Named slots (eyebrow, hook, body, CTA) are law. Mutate the template. Do not rebuild from empty boxes.",
        action: { type: "applyTemplate", templateId: "announce-post" },
      },
      {
        title: "Decide the visual",
        body: "A living Ledger Current plate is one option. Kit photography is also valid. Do not stack every preset on one node.",
        action: { type: "addMotion", presetId: "ledger-current" },
      },
      {
        title: "Spawn the pack",
        body: "Story, square, and OG. Inspect the 9:16 safe zone. Reflow is not a crop. Skip this on a week file (the desk will say so).",
        action: { type: "spawnPackPages" },
      },
      {
        title: "You export",
        body: "PNG or Export pack in the top bar. Week posts stay locked until marketing approve and compliance sign-off.",
        hint: "You click PNG or Export pack. The recipe will not download a file.",
      },
    ],
  },
  {
    id: "hook-gif",
    title: "Scroll-stop GIF",
    outcome: "Dark glass under a transparent hook slam. You type the line and record the GIF.",
    steps: [
      {
        title: "Open a studio file",
        body: "A blank square is enough. First frame of the GIF must still read as a poster.",
        action: { type: "ensureDoc", mode: "blank" },
      },
      {
        title: "Lay the glass",
        body: "Liquid Glass Shift is a dark plate with a moving sheen. This is the atmosphere layer.",
        action: { type: "addMotion", presetId: "liquid-glass-shift" },
      },
      {
        title: "Slam the hook on top",
        body: "Inspector adds a second plate. Cinematic Hook Slam is a transparent overlay, not a card that covers the glass.",
        action: { type: "addMotion", presetId: "cinematic-hook-slam" },
      },
      {
        title: "Type, then you record",
        body: "Double-click the slam, type the hook, click off.",
        hint: "Right-click the plate and choose Record GIF, or use Record GIF in the inspector.",
      },
    ],
  },
  {
    id: "still-art",
    title: "Artwork still",
    outcome: "One living plate captured into the kit as photography.",
    steps: [
      {
        title: "Open a studio file",
        body: "Email and Learn use the captured still, not the live sim.",
        action: { type: "ensureDoc", mode: "blank" },
      },
      {
        title: "Drop vapor",
        body: "Vapor Drift is slow mist across paper, not a grid of ellipses. Other atmosphere plates are valid after this.",
        action: { type: "addMotion", presetId: "vapor-drift" },
      },
      {
        title: "Capture the still",
        body: "The frame hangs as a kit asset on this document.",
        action: { type: "captureMotionStill" },
      },
    ],
  },
  {
    id: "stack-layers",
    title: "Motion as layers",
    outcome: "Two live plates. Overlay readable on atmosphere.",
    steps: [
      {
        title: "How plates stack",
        body: "Inspector click adds a new plate. Right-click a plate replaces that plate's look. Same look on the selected plate replays it.",
      },
      {
        title: "Atmosphere",
        body: "Glass (or any Atmosphere look) is the ground.",
        action: { type: "addMotion", presetId: "liquid-glass-shift" },
      },
      {
        title: "Overlay",
        body: "Hook slam and viral hook are transparent. An opaque card hides what is underneath.",
        action: { type: "addMotion", presetId: "cinematic-hook-slam" },
      },
      {
        title: "Eight live",
        body: "Up to eight plates can run. Right-click Send back to grab the plate underneath.",
      },
    ],
  },
  {
    id: "email-letter",
    title: "Email from the same file",
    outcome: "600px letter with merge tags. No living WebGL.",
    steps: [
      {
        title: "Open the letter",
        body: "Strata Layer Email is 600 by 900 with merge tags already wired.",
        action: { type: "ensureDoc", mode: "email-letter" },
      },
      {
        title: "Merge tags",
        body: "Click chips in the inspector onto selected text. Same document, calmer board. No Three.js. If a motion plate is present, capture a still before send.",
      },
      {
        title: "You send from campaigns",
        body: "Email HTML export lives on the campaign, not as a social PNG.",
        hint: "Do not use Export pack here. Use the email campaign send path.",
      },
    ],
  },
];

export function craftHelpRecipe(id: string): CraftHelpRecipe | undefined {
  return CRAFT_HELP.find((item) => item.id === id);
}

export function craftHelpStep(id: string, index: number): CraftHelpStep | undefined {
  return craftHelpRecipe(id)?.steps[index];
}
