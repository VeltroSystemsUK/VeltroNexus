import { COPY_LIMITS, splitHookLines } from "@shared/craftQueue";
import type { CreativeAmmoBrief } from "@shared/craftScout";
import { houseAsk } from "./caseyScout";

type IslaAsk = (prompt: string, model?: string, system?: string) => Promise<string>;

/** Week-desk system prompt. The full v3 persona is too large for a two-field JSON pass and was being ignored. */
export const ISLA_WEEK_SYSTEM = `Role Identifier: CreativeDirector_MarketingExec_v3
You are Isla Quinn, Marketing Director and Executive Creative Director (MKT-2) at Strata Finance. Brand strategy first, art direction second, copy third. Frankie Doyle owns the feed. You own the line.

This pass is the week desk only. You are not opening Craft. You are writing the two-beat hook and the deck that land on a house template. The template is not the idea. If the idea needs a paragraph, it is not an idea.

HOUSE POLICY: Strata packages. Strata does not lend. No rates, APR, guarantees, approved, payday, consumer credit, or "we lend". No invented numbers. Never name a client. No jargon (unlock, empower, seamless, journey, elevate). No em dashes. No emojis. UK spelling. If copy would need an FCA risk warning, kill it.

VOICE: confident, incisive, dry. Hook 1 is a complete-feeling half-truth (recognition, ink). Hook 2 is the packager correction, the human cost, or the dry joke (gold). If Hook 2 can be deleted without pain, there is no turn. Never a question the reader can answer no to and scroll on.

PROCESS: from Casey's notes extract a human truth; find the tension with the category cliche (spray-and-pray brokers, from X% APR, glass towers); write one thought a director could repeat in a pub; THEN write the hook pair. Do not publish Casey's socialAngle untouched.

TRACK: one audience. Borrower or introducer, never both.

PACKAGER IDENTITY: the deck must make it impossible to think Strata lends. Prefer a sharper identity line than the default. "We do not lend" is appended later if you omit it.

BANNED: generic AI copy, Casey pasted as a headline, "elevate", Swiss-navy-Inter as a reflex.`;

/**
 * The second creative pass. Casey's brief is raw analyst material — coreFact, smeImpact,
 * trigger, freshAngle — never meant to land on a board verbatim (her own prompt says so).
 * This is where Isla's actual voice/agency-frame rules run over that material to produce
 * the two-part hook and body craftDirector.copyFromAmmo() then formats onto the template.
 */
export function islaUserPrompt(brief: CreativeAmmoBrief): string {
  const hookMax = COPY_LIMITS.hook - 2;
  const hook2Max = COPY_LIMITS.hook2 - 2;
  return `Craft ONE Strata Finance post from this Creative Ammo Brief. Track: ${brief.track}.

RESEARCH FROM CASEY WREN (facts only — do not quote her angle, do not invent a number):
Headline: ${brief.headline}
Core fact: ${brief.coreFact}
SME impact (raw): ${brief.smeImpact}
Trigger: ${brief.trigger}
Fresh angle: ${brief.freshAngle}
Data bites: ${brief.dataBites.join(" | ")}

Do not quote Casey. Write the turn yourself.

socialAngle is TWO short clauses split by a full stop so they become Hook 1 (ink, recognition) then Hook 2 (gold, the packager correction). Count characters.
- Hook 1: ${hookMax} characters MAX.
- Hook 2: ${hook2Max} characters MAX.

Length and punch to beat:
"The bank took eight weeks to say no." (37) / "Here is what happened in week one." (35)
"Declined is a decision by one lender." (38) / "It is not a verdict." (21)

- socialAngle: Hook 1. Hook 2.
- smeImpact: two short sentences. Sentence one is the mechanism. Sentence two is packager identity. Do not add "We do not lend" — that is appended later. Under ${COPY_LIMITS.body - 30} characters.

Return ONLY a JSON object: {"socialAngle": "...", "smeImpact": "..."}. No commentary, no markdown fences, no other keys.`;
}

function parseIslaCraft(text: string): { socialAngle: string; smeImpact: string } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as Record<string, unknown>;
    const socialAngle = typeof obj.socialAngle === "string" ? obj.socialAngle.trim() : "";
    const smeImpact = typeof obj.smeImpact === "string" ? obj.smeImpact.trim() : "";
    if (socialAngle && smeImpact) return { socialAngle, smeImpact };
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * True if this socialAngle will actually split clean on the board — both halves inside the
 * hard limits and a real second half found (an empty hook2 means splitHookLines() fell back
 * to its blunt percentage cut because there was no punctuation break, which is exactly the
 * "wordy and truncated" failure mode this whole pass exists to prevent).
 */
function splitsClean(socialAngle: string): boolean {
  const { hook, hook2 } = splitHookLines(socialAngle);
  return Boolean(hook) && Boolean(hook2) && hook.length <= COPY_LIMITS.hook && hook2.length <= COPY_LIMITS.hook2;
}

/** Crafts one brief. Falls back to Casey's raw angle untouched if the pass fails or overshoots — never blocks the week, never ships a mid-word cut. */
export async function craftBrief(brief: CreativeAmmoBrief, ask: IslaAsk = houseAsk): Promise<CreativeAmmoBrief> {
  try {
    const text = await ask(islaUserPrompt(brief), undefined, ISLA_WEEK_SYSTEM);
    const crafted = parseIslaCraft(text);
    if (!crafted) return brief;
    if (!splitsClean(crafted.socialAngle)) {
      console.warn(`[Isla] craft pass overshot the hook length for "${brief.headline}", using Casey's raw angle`);
      return brief;
    }
    return { ...brief, socialAngle: crafted.socialAngle, smeImpact: crafted.smeImpact };
  } catch (error) {
    console.warn(`[Isla] craft pass failed for "${brief.headline}", using Casey's raw angle`, error);
    return brief;
  }
}

export async function craftWeek(briefs: CreativeAmmoBrief[], ask?: IslaAsk): Promise<CreativeAmmoBrief[]> {
  return Promise.all(briefs.map((brief) => craftBrief(brief, ask)));
}
