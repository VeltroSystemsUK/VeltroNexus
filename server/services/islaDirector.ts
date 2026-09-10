import { COPY_LIMITS, lineDangles, splitHookLines } from "@shared/craftQueue";
import type { CreativeAmmoBrief } from "@shared/craftScout";
import { CRAFT_WEEK_PLAYBOOKS, weekPlaybook } from "@shared/craftManual";
import { houseAsk } from "./caseyScout";

type IslaAsk = (prompt: string, model?: string, system?: string) => Promise<string>;

type IslaCard = { hook: string; hook2: string; body: string; cta: string };

/** Week-desk system prompt. The full v3 persona is too large for a two-field JSON pass and was being ignored. */
export const ISLA_WEEK_SYSTEM = `Role Identifier: CreativeDirector_MarketingExec_v3
You are Isla Quinn, ECD (MKT-2) at Strata Finance. Frankie owns the feed. You own the line.

WEEK ARGUMENT — seven beats, one thought. Do not write seven unrelated slogans. Each day continues the last:
Mon inversion (two-beat). Tue stamp (issued). Wed named voice. Thu correction only. Fri one count. Sat object caption. Sun eight words.

CARD JSON: {"hook":"","hook2":"","body":"","cta":""}
Complete sentences only. Never end on a, the, to, your, our, for, of, and, or, with, we, more. Never mid-word.
hook <= ${COPY_LIMITS.hook - 1} chars. hook2 <= ${COPY_LIMITS.hook2 - 1}. body <= ${COPY_LIMITS.body - 2}. cta <= ${COPY_LIMITS.cta - 2} or "".
Body continues the hook as one spoken thought. Do not bolt "We do not lend" into body — identity is already on the board.
CTA only Monday and Friday. Other days "cta" is "".
Sunday: hook <= 8 words, hook2 "", body "", cta "".
Friday: hook or hook2 contains an integer or count word. No %, no APR. If Casey marked MISSING, write process, not a fake number.
Wednesday: hook is the spoken line. hook2 is attribution or the turn.
Monday: Hook 2 is the correction. If Hook 2 can be deleted, rewrite.

HOUSE POLICY: Strata packages. Strata does not lend. No rates, APR, guarantees, approved, payday, consumer credit, or "we lend". No invented numbers. Never name a client. No jargon (unlock, empower, seamless, journey, elevate). No em dashes. No emojis. UK spelling.

VOICE: dry, incisive. Hook 1 recognition (ink). Hook 2 the turn (gold). Never a question the reader can answer no to.

PROCESS: from Casey extract a human truth; find the tension with the category cliche; write one thought a director could repeat in a pub; THEN write the card. Do not publish Casey's socialAngle untouched.

TRACK: one audience. Borrower or introducer, never both.

BANNED: generic AI copy, Casey pasted as a headline, "elevate".`;

/**
 * The second creative pass. Casey's brief is raw analyst material — coreFact, smeImpact,
 * trigger, freshAngle — never meant to land on a board verbatim (her own prompt says so).
 * This is where Isla's actual voice/agency-frame rules run over that material to produce
 * the two-part hook and body craftDirector.copyFromAmmo() then formats onto the template.
 */
export function islaUserPrompt(brief: CreativeAmmoBrief, daySlot?: string): string {
  const hookMax = COPY_LIMITS.hook - 2;
  const hook2Max = COPY_LIMITS.hook2 - 2;
  const play = weekPlaybook(daySlot);
  const board = play
    ? `TODAY'S BOARD (${play.day}, ${play.slot}): ${play.idea}
Must: ${play.must}
Forbidden: ${play.forbidden}
Craft stack if you were opening the file: ${play.stack.join(" then ")}.
Copy job: ${play.copy}
Write the hook as if that board already exists.
`
    : "";
  return `Craft ONE Strata Finance post from this Creative Ammo Brief. Track: ${brief.track}.
${board}
RESEARCH FROM CASEY WREN (facts only — do not quote her angle, do not invent a number):
Headline: ${brief.headline}
Core fact: ${brief.coreFact}
SME impact (raw): ${brief.smeImpact}
Trigger: ${brief.trigger}
Fresh angle: ${brief.freshAngle}
Data bites: ${brief.dataBites.join(" | ")}

Do not quote Casey. Write the turn yourself.

${copyJobForSlot(daySlot, hookMax, hook2Max)}

Return ONLY a JSON object: {"hook":"...","hook2":"...","body":"...","cta":"..."}. No commentary, no markdown fences, no other keys.`;
}

function copyJobForSlot(daySlot: string | undefined, hookMax: number, hook2Max: number): string {
  if (daySlot === "sunday-silence") {
    return `Sunday is silence. socialAngle is ONE line, max 8 words, max ${hookMax} characters. No second clause. No CTA. No deck.
smeImpact: one packager-identity sentence only, under ${COPY_LIMITS.body - 30} characters.
Example: "Leave the board empty enough."`;
  }
  if (daySlot === "friday-number") {
    return `Friday is a count. socialAngle is Hook 1 (an integer or written count, no %, no APR) then Hook 2 the packager correction.
- Hook 1: ${hookMax} characters MAX and must contain a number or count word.
- Hook 2: ${hook2Max} characters MAX.
smeImpact: one short sentence plus packager identity. Under ${COPY_LIMITS.body - 30} characters. Do not add "We do not lend" — that is appended later.
Example: "Twenty-two things on the file. Then a decision."`;
  }
  if (daySlot === "wednesday-voice") {
    return `Wednesday is a named voice. socialAngle is ONE introducer sentence (a role or a filed quote), not a slogan pair. A short Hook 2 correction is allowed but not required.
- Hook 1: ${hookMax} characters MAX.
- Hook 2: ${hook2Max} characters MAX if present.
smeImpact: the quote or the named sentence, then packager identity. Under ${COPY_LIMITS.body - 30} characters. Do not add "We do not lend" — that is appended later.
Never invent a firm or a headshot.`;
  }
  if (daySlot === "tuesday-stamp") {
    return `Tuesday is identity as the object. socialAngle is a stamp line, not a photo caption.
- Hook 1: ${hookMax} characters MAX.
- Hook 2: ${hook2Max} characters MAX.
smeImpact: issued, filed, stamped. Under ${COPY_LIMITS.body - 30} characters. Do not add "We do not lend" — that is appended later.`;
  }
  if (daySlot === "thursday-redact") {
    return `Thursday copy is the correction only. Never put a banned myth in socialAngle or smeImpact.
- Hook 1: ${hookMax} characters MAX.
- Hook 2: ${hook2Max} characters MAX.
smeImpact: the correction, then packager identity. Under ${COPY_LIMITS.body - 30} characters. Do not add "We do not lend" — that is appended later.`;
  }
  return `socialAngle is TWO short clauses split by a full stop so they become Hook 1 (ink, recognition) then Hook 2 (gold, the packager correction). Count characters.
- Hook 1: ${hookMax} characters MAX.
- Hook 2: ${hook2Max} characters MAX.

Length and punch to beat:
"The bank took eight weeks to say no." (37) / "Here is what happened in week one." (35)
"Declined is a decision by one lender." (38) / "It is not a verdict." (21)

- socialAngle: Hook 1. Hook 2.
- smeImpact: two short sentences. Sentence one is the mechanism. Sentence two is packager identity. Do not add "We do not lend" — that is appended later. Under ${COPY_LIMITS.body - 30} characters.`;
}

function asCard(obj: Record<string, unknown>): IslaCard | null {
  const hook = typeof obj.hook === "string" ? obj.hook.trim() : "";
  const hook2 = typeof obj.hook2 === "string" ? obj.hook2.trim() : "";
  const body = typeof obj.body === "string" ? obj.body.trim() : "";
  const cta = typeof obj.cta === "string" ? obj.cta.trim() : "";
  if (hook) return { hook, hook2, body, cta };
  const socialAngle = typeof obj.socialAngle === "string" ? obj.socialAngle.trim() : "";
  const smeImpact = typeof obj.smeImpact === "string" ? obj.smeImpact.trim() : "";
  if (!socialAngle) return null;
  const split = splitHookLines(socialAngle);
  return { hook: split.hook, hook2: split.hook2, body: smeImpact, cta: "" };
}

function parseIslaCraft(text: string): IslaCard | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as Record<string, unknown>;
    return asCard(obj);
  } catch {
    return null;
  }
}

function parseIslaWeek(text: string): IslaCard[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const rows = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(rows) || rows.length !== 7) return null;
    const cards = rows.map((row) => (row && typeof row === "object" ? asCard(row as Record<string, unknown>) : null));
    if (cards.some((card) => !card)) return null;
    return cards as IslaCard[];
  } catch {
    return null;
  }
}

/**
 * True if this socialAngle will actually split clean on the board — both halves inside the
 * hard limits and a real second half found (an empty hook2 means splitHookLines() fell back
 * to its blunt percentage cut because there was no punctuation break, which is exactly the
 * "wordy and truncated" failure mode this whole pass exists to prevent).
 */
function wordCount(text: string): number {
  return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

function cardFits(card: IslaCard, daySlot?: string): boolean {
  if (!card.hook || card.hook.length > COPY_LIMITS.hook) return false;
  if (card.hook2.length > COPY_LIMITS.hook2) return false;
  if (card.body.length > COPY_LIMITS.body) return false;
  if (card.cta.length > COPY_LIMITS.cta) return false;
  if (lineDangles(card.hook) || lineDangles(card.hook2) || lineDangles(card.body)) return false;
  if (/%|\bAPR\b/i.test(`${card.hook} ${card.hook2} ${card.body}`)) return false;
  if (daySlot === "sunday-silence") {
    return wordCount(card.hook) >= 1 && wordCount(card.hook) <= 8;
  }
  if (daySlot === "monday-two-beat") return Boolean(card.hook2);
  return true;
}

function stampCard(brief: CreativeAmmoBrief, card: IslaCard, daySlot?: string): CreativeAmmoBrief {
  if (daySlot === "sunday-silence") {
    return {
      ...brief,
      socialAngle: card.hook,
      smeImpact: card.body,
      hook: card.hook,
      hook2: "",
      body: "",
      cta: "",
    };
  }
  return {
    ...brief,
    socialAngle: [card.hook, card.hook2].filter(Boolean).join(". "),
    smeImpact: card.body || brief.smeImpact,
    hook: card.hook,
    hook2: card.hook2,
    body: card.body,
    cta: card.cta,
  };
}

/** Crafts one brief. Falls back to Casey's raw angle untouched if the pass fails or overshoots — never blocks the week, never ships a mid-word cut. */
export async function craftBrief(brief: CreativeAmmoBrief, ask: IslaAsk = houseAsk, daySlot?: string): Promise<CreativeAmmoBrief> {
  try {
    const text = await ask(islaUserPrompt(brief, daySlot), undefined, ISLA_WEEK_SYSTEM);
    const crafted = parseIslaCraft(text);
    if (!crafted) return brief;
    if (!cardFits(crafted, daySlot)) {
      console.warn(`[Isla] craft pass overshot the hook length for "${brief.headline}", using Casey's raw angle`);
      return brief;
    }
    return stampCard(brief, crafted, daySlot);
  } catch (error) {
    console.warn(`[Isla] craft pass failed for "${brief.headline}", using Casey's raw angle`, error);
    return brief;
  }
}

function islaWeekPrompt(briefs: CreativeAmmoBrief[]): string {
  const days = briefs
    .map((brief, i) => {
      const play = weekPlaybook(CRAFT_WEEK_PLAYBOOKS[i]?.slot);
      return `DAY ${i + 1} ${play?.slot ?? ""} (${play?.day ?? ""}), track ${brief.track}.
Board: ${play?.idea ?? ""} Must: ${play?.must ?? ""} Forbidden: ${play?.forbidden ?? ""} Copy job: ${play?.copy ?? ""}
Headline: ${brief.headline}
Core fact: ${brief.coreFact}
SME impact (raw): ${brief.smeImpact}
Trigger: ${brief.trigger}
Fresh angle: ${brief.freshAngle}
Data bites: ${brief.dataBites.join(" | ")}`;
    })
    .join("\n\n");
  return `Write the week as ONE week argument — seven beats, not seven isolated slogans.
Casey research (facts only — do not quote her angle, do not invent a number):

${days}

Do not quote Casey. Write the turn yourself.
Return ONLY a JSON array of 7 cards in Mon-Sun order: [{"hook":"...","hook2":"...","body":"...","cta":"..."}]. No commentary, no markdown fences.`;
}

export async function craftWeek(briefs: CreativeAmmoBrief[], ask: IslaAsk = houseAsk): Promise<CreativeAmmoBrief[]> {
  if (briefs.length === 7) {
    try {
      const text = await ask(islaWeekPrompt(briefs), undefined, ISLA_WEEK_SYSTEM);
      const cards = parseIslaWeek(text);
      if (cards) {
        return briefs.map((brief, i) => {
          const card = cards[i]!;
          const slot = CRAFT_WEEK_PLAYBOOKS[i]?.slot;
          return cardFits(card, slot) ? stampCard(brief, card, slot) : brief;
        });
      }
    } catch (error) {
      console.warn("[Isla] week pass failed, falling back to one card at a time", error);
    }
  }
  return Promise.all(briefs.map((brief, i) => craftBrief(brief, ask, CRAFT_WEEK_PLAYBOOKS[i]?.slot)));
}
