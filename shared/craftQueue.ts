import { copyFromAmmo, visualForTrack } from "./craftDirector";
import { scanWeek, type CreativeAmmoBrief } from "./craftScout";

export const CRAFT_CHANNELS = [
  "linkedin",
  "instagram",
  "facebook",
  "tiktok",
] as const;

export const AD_CHANNELS = ["linkedin_ads", "meta_ads"] as const;

export type SocialChannel = (typeof CRAFT_CHANNELS)[number];
export type AdChannel = (typeof AD_CHANNELS)[number];
export type ChannelId = SocialChannel | AdChannel;
export type PostTrack = "borrower" | "introducer";
export type PostStatus = "draft" | "approved" | "rejected" | "exported";
export type ComplianceStatus = "pending" | "cleared" | "blocked";
export type ChannelStatus = "not_connected" | "connected" | "needs_reauth";

export type CraftChannel = {
  id: ChannelId;
  label: string;
  handle: string;
  url: string;
  accountId: string;
  status: ChannelStatus;
};

export type CraftPost = {
  id: string;
  date: string;
  weekday: string;
  track: PostTrack;
  status: PostStatus;
  compliance: ComplianceStatus;
  autoPublish: false;
  primaryChannel: "linkedin";
  channels: SocialChannel[];
  presetId: string;
  extraPresets: Partial<Record<SocialChannel, string>>;
  title: string;
  eyebrow: string;
  hook: string;
  hook2: string;
  body: string;
  cta: string;
  links: string[];
  hashtags: string[];
  adsDraft: boolean;
  visual?: {
    stockId: string;
    query: string;
    prompt: string;
  };
  weekId?: string;
  route?: string;
  daySlot?: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const BANNED =
  /\b(guaranteed|instant approval|payday|0%\s*apr|apr\b|consumer loan|no credit check|guaranteed funding|we will lend|we lend)\b/i;

export const RATE_CLAIM = /\bfrom\s+\d+(\.\d+)?%|\b\d+(\.\d+)?%\s*(apr|p\.?a\.?|interest|per year)\b/i;

export const PACKAGER_IDENTITY = /\b(do not lend|don't lend|does not lend|packager)\b/i;

export const COPY_LIMITS = {
  eyebrow: 36,
  hook: 40,
  hook2: 36,
  body: 120,
  cta: 28,
  hashtags: 3,
  links: 2,
} as const;

export function defaultEyebrow(track: PostTrack): string {
  return track === "introducer" ? "INTRODUCERS  ·  STRATA" : "SME DIRECTORS  ·  STRATA";
}

const DANGLING = /\b(the|a|an|to|your|our|for|of|and|or|with|we|more)$/i;

export function lineDangles(text: string): boolean {
  return DANGLING.test(text.replace(/\s+/g, " ").trim());
}

/** Fit a line to max without ending mid-word or on a dangling article. */
export function completeLine(text: string, max: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= max && !lineDangles(trimmed.replace(/\s+/g, " "))) return trimmed;
  const t = trimmed.replace(/\s+/g, " ");
  const cut = t.slice(0, max);
  const sentence = cut.match(/^[\s\S]*?[.!?]/);
  if (sentence) {
    const line = sentence[0]!.trim();
    if (line.length >= 12 && !lineDangles(line)) return line;
  }
  const parts = (cut.lastIndexOf(" ") > 0 ? cut.slice(0, cut.lastIndexOf(" ")) : cut).trim().split(/\s+/);
  while (parts.length && lineDangles(parts.join(" "))) parts.pop();
  return parts.join(" ");
}

function clipHook(text: string, max: number): string {
  return completeLine(text, max);
}

/** Split a hero into two colourable punches. */
export function splitHookLines(text: string): { hook: string; hook2: string } {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return { hook: "", hook2: "" };
  const punct = t.match(/^(.{6,40}?)(?:[:—.–]|\s[—–-]\s)\s*(.+)$/);
  if (punct) {
    return { hook: clipHook(punct[1]!, COPY_LIMITS.hook), hook2: clipHook(punct[2]!, COPY_LIMITS.hook2) };
  }
  if (t.length <= COPY_LIMITS.hook) return { hook: t, hook2: "" };
  const budget = Math.min(COPY_LIMITS.hook, Math.max(12, Math.ceil(t.length * 0.48)));
  const cut = t.slice(0, budget);
  const sp = cut.lastIndexOf(" ");
  const a = (sp >= 8 ? cut.slice(0, sp) : cut).trim();
  const b = t.slice(a.length).trim();
  return { hook: clipHook(a, COPY_LIMITS.hook), hook2: clipHook(b, COPY_LIMITS.hook2) };
}

const PRESETS: Record<SocialChannel, string> = {
  linkedin: "og",
  instagram: "square",
  facebook: "og",
  tiktok: "story",
};

const CHANNEL_LABELS: Record<ChannelId, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  linkedin_ads: "LinkedIn Ads",
  meta_ads: "Meta Ads",
};



export function defaultChannels(): CraftChannel[] {
  const ids: ChannelId[] = [...CRAFT_CHANNELS, ...AD_CHANNELS];
  return ids.map((id) => ({
    id,
    label: CHANNEL_LABELS[id],
    handle: "",
    url: "",
    accountId: "",
    status: "not_connected",
  }));
}

export function parseChannelPatch(input: unknown): Partial<CraftChannel> {
  if (!input || typeof input !== "object") throw new Error("Invalid channel");
  const raw = input as Record<string, unknown>;
  if ("password" in raw || "secret" in raw || "token" in raw) {
    throw new Error("Password, secret, and token fields are not stored. Use a public URL or OAuth connect.");
  }
  const patch: Partial<CraftChannel> = {};
  if (typeof raw.handle === "string") patch.handle = raw.handle.trim();
  if (typeof raw.url === "string") patch.url = raw.url.trim();
  if (typeof raw.accountId === "string") patch.accountId = raw.accountId.trim();
  if (raw.status === "not_connected" || raw.status === "connected" || raw.status === "needs_reauth") {
    patch.status = raw.status;
  }
  return patch;
}

function mondayOf(isoDate: string): Date {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid week start");
  const day = d.getUTCDay(); // 0 Sun
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type WeekGenerateMode = "replace" | "keep_approved" | "selected";

export function parseWeekGenerate(input: unknown): {
  from: string;
  mode: WeekGenerateMode;
  selectedId?: string;
  stamp?: string;
} {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const from = typeof raw.from === "string" && raw.from ? raw.from : new Date().toISOString().slice(0, 10);
  const mode: WeekGenerateMode =
    raw.mode === "keep_approved" || raw.mode === "selected" || raw.mode === "replace" ? raw.mode : "replace";
  const selectedId = typeof raw.selectedId === "string" && raw.selectedId ? raw.selectedId : undefined;
  const stamp = typeof raw.stamp === "string" && raw.stamp ? raw.stamp.replace(/[^a-z0-9-]/gi, "").slice(0, 16) : undefined;
  if (mode === "selected" && !selectedId) throw new Error("Pick a post to replace.");
  return { from, mode, selectedId, stamp };
}

export function heldPost(post: CraftPost): boolean {
  if (post.status === "rejected") return false;
  return (
    post.status === "approved" ||
    post.status === "exported" ||
    post.compliance === "cleared" ||
    post.compliance === "blocked"
  );
}

export function mergeGeneratedWeek(
  existing: CraftPost[],
  generated: CraftPost[],
  mode: WeekGenerateMode,
  selectedId?: string,
): CraftPost[] {
  if (mode === "replace" || existing.length === 0) return generated;
  if (mode === "selected") {
    const idx = existing.findIndex((post) => post.id === selectedId);
    if (idx < 0) throw new Error("Post not found");
    const current = existing[idx]!;
    const fresh =
      generated[idx] ??
      generated.find((post) => post.weekday === current.weekday) ??
      generated[0]!;
    return existing.map((post, i) =>
      i === idx
        ? {
            ...fresh,
            id: current.id,
            date: current.date,
            weekday: current.weekday,
          }
        : post,
    );
  }
  return generated.map((fresh, i) => {
    const prev = existing[i];
    if (prev && heldPost(prev)) return prev;
    return prev
      ? { ...fresh, id: prev.id, date: prev.date, weekday: prev.weekday }
      : fresh;
  });
}

export function weekDesignWipeIds(
  existing: CraftPost[],
  mode: WeekGenerateMode,
  selectedId?: string,
): string[] {
  if (mode === "replace") return existing.map((post) => post.id);
  if (mode === "selected") return selectedId ? [selectedId] : [];
  return existing.filter((post) => !heldPost(post)).map((post) => post.id);
}

export function shapePostToDay(post: CraftPost): CraftPost {
  if (!post.daySlot) return post;
  if (post.daySlot === "sunday-silence") {
    const words = post.hook.split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
    return { ...post, hook: words, body: "", cta: "", hashtags: [], eyebrow: "" };
  }
  if (
    post.daySlot === "tuesday-stamp" ||
    post.daySlot === "wednesday-voice" ||
    post.daySlot === "thursday-redact" ||
    post.daySlot === "saturday-object"
  ) {
    return { ...post, cta: "" };
  }
  return post;
}

export function stampAmmoOnPost(post: CraftPost, brief: CreativeAmmoBrief): CraftPost {
  const copy = copyFromAmmo(brief, post.daySlot);
  const visual = visualForTrack(copy.track, copy.stockId);
  return {
    ...post,
    track: copy.track,
    title: copy.title,
    eyebrow: defaultEyebrow(copy.track),
    hook: copy.hook,
    hook2: copy.hook2,
    body: copy.body,
    cta: copy.cta,
    hashtags: [...copy.hashtags],
    visual: {
      ...visual,
      prompt: brief.imagePrompt || visual.prompt,
    },
    status: "draft",
    compliance: "pending",
  };
}

export function applyAmmoToWeek(week: CraftPost[], briefs: CreativeAmmoBrief[]): CraftPost[] {
  return week.map((post, i) => {
    if (heldPost(post)) return post;
    const brief = briefs[i];
    if (!brief) return post;
    return stampAmmoOnPost(post, brief);
  });
}

export function generateWeek(fromIso: string, ammo: CreativeAmmoBrief[] = scanWeek(), stamp?: string): CraftPost[] {
  const start = mondayOf(fromIso);
  const briefs = ammo.length === 7 ? ammo : scanWeek();
  const tag = stamp ? `-${stamp}` : "";
  return WEEKDAYS.map((weekday, i) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    const copy = copyFromAmmo(briefs[i]!);
    const visual = visualForTrack(copy.track, copy.stockId);
    return {
      id: `mkt-${isoDay(date)}-${copy.track}${tag}`,
      date: isoDay(date),
      weekday,
      track: copy.track,
      status: "draft",
      compliance: "pending",
      autoPublish: false,
      primaryChannel: "linkedin",
      channels: [...CRAFT_CHANNELS],
      presetId: "li-landscape",
      extraPresets: { instagram: PRESETS.instagram, facebook: PRESETS.facebook, tiktok: PRESETS.tiktok },
      title: copy.title,
      eyebrow: defaultEyebrow(copy.track),
      hook: copy.hook,
      hook2: copy.hook2,
      body: copy.body,
      cta: copy.cta,
      links: [],
      hashtags: [...copy.hashtags],
      adsDraft: false,
      visual: {
        ...visual,
        prompt: briefs[i]!.imagePrompt || visual.prompt,
      },
    };
  });
}

export function assertCopyLimits(
  post: Pick<CraftPost, "hook" | "hook2" | "body" | "cta" | "hashtags" | "links"> & { eyebrow?: string },
): void {
  if ((post.eyebrow ?? "").length > COPY_LIMITS.eyebrow) {
    throw new Error(`Eyebrow must be ${COPY_LIMITS.eyebrow} characters or fewer.`);
  }
  if (post.hook.length > COPY_LIMITS.hook) {
    throw new Error(`Hook 1 must be ${COPY_LIMITS.hook} characters or fewer.`);
  }
  if ((post.hook2 ?? "").length > COPY_LIMITS.hook2) {
    throw new Error(`Hook 2 must be ${COPY_LIMITS.hook2} characters or fewer.`);
  }
  if (post.body.length > COPY_LIMITS.body) {
    throw new Error(`Body must be ${COPY_LIMITS.body} characters or fewer.`);
  }
  if (post.cta.length > COPY_LIMITS.cta) {
    throw new Error(`CTA must be ${COPY_LIMITS.cta} characters or fewer.`);
  }
  if ((post.hashtags ?? []).length > COPY_LIMITS.hashtags) {
    throw new Error(`Use at most ${COPY_LIMITS.hashtags} hashtags.`);
  }
  if ((post.links ?? []).length > COPY_LIMITS.links) {
    throw new Error(`Use at most ${COPY_LIMITS.links} links.`);
  }
}

export function weekCopyIsClean(post: CraftPost): boolean {
  const text = `${post.title} ${post.eyebrow} ${post.hook} ${post.hook2} ${post.body} ${post.cta} ${(post.links ?? []).join(" ")} ${post.hashtags.join(" ")}`;
  return !BANNED.test(text) && !RATE_CLAIM.test(text);
}

export type CraftCopyPatch = {
  title?: string;
  eyebrow?: string;
  hook?: string;
  hook2?: string;
  body?: string;
  cta?: string;
  links?: string[] | string;
  hashtags?: string[] | string;
  status?: PostStatus;
  compliance?: ComplianceStatus;
};

export type ComplianceFinding = {
  level: "block" | "warn";
  code: string;
  message: string;
};

export type ComplianceReview = {
  ok: boolean;
  findings: ComplianceFinding[];
};

export function reviewMarketingCopy(post: CraftPost): ComplianceReview {
  const text = `${post.title} ${post.eyebrow} ${post.hook} ${post.hook2} ${post.body} ${post.cta} ${(post.links ?? []).join(" ")} ${post.hashtags.join(" ")}`;
  const findings: ComplianceFinding[] = [];
  if (BANNED.test(text) || RATE_CLAIM.test(text)) {
    findings.push({
      level: "block",
      code: "house_policy",
      message: "Copy fails house policy — no rates, guarantees, consumer-credit claims, or lending.",
    });
  }
  if (!PACKAGER_IDENTITY.test(text)) {
    findings.push({
      level: "block",
      code: "identity",
      message: "Say plainly that Strata packages and does not lend.",
    });
  }
  if (post.autoPublish !== false) {
    findings.push({
      level: "block",
      code: "autopost",
      message: "Auto-publish is not allowed.",
    });
  }
  if (post.adsDraft) {
    findings.push({
      level: "warn",
      code: "ads",
      message: "Ads stay draft-only. Do not spend.",
    });
  }
  return { ok: findings.every((item) => item.level !== "block"), findings };
}

export function canExportPost(post: CraftPost): boolean {
  return post.status === "approved" && post.compliance === "cleared" && reviewMarketingCopy(post).ok && post.autoPublish === false;
}

export function signOffCompliance(post: CraftPost): CraftPost {
  if (post.status !== "approved") {
    throw new Error("Marketing must approve the copy before compliance can sign off.");
  }
  const review = reviewMarketingCopy(post);
  if (!review.ok) {
    const msg = review.findings
      .filter((item) => item.level === "block")
      .map((item) => item.message)
      .join(" ");
    throw new Error(msg || "Copy failed compliance review.");
  }
  return { ...post, autoPublish: false, compliance: "cleared" };
}

export function normalizePost(post: CraftPost): CraftPost {
  const compliance =
    post.compliance === "cleared" || post.compliance === "blocked" ? post.compliance : "pending";
  const hook2 = typeof post.hook2 === "string" ? post.hook2 : "";
  const longHero = !hook2 && post.hook.length > COPY_LIMITS.hook;
  const split = longHero ? splitHookLines(post.hook) : { hook: post.hook, hook2 };
  return {
    ...post,
    autoPublish: false,
    compliance,
    eyebrow: typeof post.eyebrow === "string" ? post.eyebrow : defaultEyebrow(post.track),
    hook: split.hook,
    hook2: split.hook2,
    links: Array.isArray(post.links) ? post.links : [],
    weekId: typeof post.weekId === "string" ? post.weekId : undefined,
    route: typeof post.route === "string" ? post.route : undefined,
    daySlot: typeof post.daySlot === "string" ? post.daySlot : undefined,
  };
}

export function parseLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Link must be a valid http(s) URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http(s) links are allowed.");
  }
  return url.toString();
}

export function parseLinks(value: string | string[]): string[] {
  const parts = Array.isArray(value) ? value : value.split(/[\s,]+/);
  return parts.map((part) => parseLink(part)).filter(Boolean).slice(0, COPY_LIMITS.links);
}

export function parseHashtags(value: string | string[]): string[] {
  const parts = Array.isArray(value) ? value : value.split(/[\s,]+/);
  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith("#") ? s : `#${s}`))
    .slice(0, COPY_LIMITS.hashtags);
}

export function parseCopyPatch(input: unknown): CraftCopyPatch {
  if (!input || typeof input !== "object") throw new Error("Invalid patch");
  const raw = input as Record<string, unknown>;
  const patch: CraftCopyPatch = {};
  if (typeof raw.title === "string") patch.title = raw.title;
  if (typeof raw.eyebrow === "string") patch.eyebrow = raw.eyebrow;
  if (typeof raw.hook === "string") patch.hook = raw.hook;
  if (typeof raw.hook2 === "string") patch.hook2 = raw.hook2;
  if (typeof raw.body === "string") patch.body = raw.body;
  if (typeof raw.cta === "string") patch.cta = raw.cta;
  if (typeof raw.links === "string" || Array.isArray(raw.links)) {
    patch.links = raw.links as string | string[];
  }
  if (typeof raw.hashtags === "string" || Array.isArray(raw.hashtags)) {
    patch.hashtags = raw.hashtags as string | string[];
  }
  if (
    raw.status === "draft" ||
    raw.status === "approved" ||
    raw.status === "rejected" ||
    raw.status === "exported"
  ) {
    patch.status = raw.status;
  } else if (raw.status !== undefined) {
    throw new Error("Invalid status");
  }
  if (raw.compliance === "pending" || raw.compliance === "cleared" || raw.compliance === "blocked") {
    patch.compliance = raw.compliance;
  } else if (raw.compliance !== undefined) {
    throw new Error("Invalid compliance state");
  }
  return patch;
}

export function applyCopyPatch(post: CraftPost, patch: CraftCopyPatch): CraftPost {
  const copyChanged =
    patch.title !== undefined ||
    patch.eyebrow !== undefined ||
    patch.hook !== undefined ||
    patch.hook2 !== undefined ||
    patch.body !== undefined ||
    patch.cta !== undefined ||
    patch.links !== undefined ||
    patch.hashtags !== undefined;

  const next: CraftPost = { ...normalizePost(post) };
  if (typeof patch.title === "string") next.title = patch.title.trim();
  if (typeof patch.eyebrow === "string") next.eyebrow = patch.eyebrow.trim();
  if (typeof patch.hook === "string") next.hook = patch.hook.trim();
  if (typeof patch.hook2 === "string") next.hook2 = patch.hook2.trim();
  if (typeof patch.body === "string") next.body = patch.body.trim();
  if (typeof patch.cta === "string") next.cta = patch.cta.trim();
  if (patch.links !== undefined) next.links = parseLinks(patch.links);
  if (patch.hashtags !== undefined) next.hashtags = parseHashtags(patch.hashtags);

  if (patch.status) {
    next.status = patch.status;
  } else if (copyChanged && (post.status === "approved" || post.status === "exported")) {
    next.status = "draft";
  }

  if (copyChanged) next.compliance = "pending";
  if (patch.compliance === "cleared") return signOffCompliance(next);
  if (patch.compliance === "pending" || patch.compliance === "blocked") next.compliance = patch.compliance;

  if (next.status === "exported" && !canExportPost({ ...next, status: "approved" })) {
    throw new Error("Compliance must sign off before export.");
  }

  assertCopyLimits(next);

  if (!weekCopyIsClean(next)) {
    throw new Error("Copy fails house policy — no rates, guarantees, or consumer-credit claims.");
  }
  if (next.daySlot === "friday-number" && /%|\bAPR\b|\bfrom\b|\d+(\.\d+)?%/i.test(`${next.body} ${next.hook} ${next.hook2} ${next.cta}`)) {
    throw new Error("Friday — ticker and body reject %, APR, and from-rates.");
  }
  return next;
}

export function approvePost(week: CraftPost[], id: string): CraftPost[] {
  return week.map((p) =>
    p.id === id ? { ...p, status: "approved", compliance: p.compliance === "cleared" ? "cleared" : "pending" } : p
  );
}

export function rejectPost(week: CraftPost[], id: string): CraftPost[] {
  return week.map((p) => (p.id === id ? { ...p, status: "rejected", compliance: "pending" } : p));
}

export function exportablePosts(week: CraftPost[]): CraftPost[] {
  return week.filter((p) => canExportPost(p));
}

export function applyChannelHandles(post: CraftPost, channels: CraftChannel[]): CraftPost {
  const linkedin = channels.find((c) => c.id === "linkedin");
  if (!linkedin?.url) return post;
  if (post.body.includes(linkedin.url)) return post;
  return { ...post, body: `${post.body}\n\n${linkedin.url}` };
}
