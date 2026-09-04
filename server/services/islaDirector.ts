import { MARKETING_DIRECTOR_PROMPT } from "@shared/craftDirector";
import { COPY_LIMITS, splitHookLines } from "@shared/craftQueue";
import type { CreativeAmmoBrief } from "@shared/craftScout";
import { houseAsk } from "./caseyScout";

type IslaAsk = (prompt: string, model?: string, system?: string) => Promise<string>;

/**
 * The second creative pass. Casey's brief is raw analyst material — coreFact, smeImpact,
 * trigger, freshAngle — never meant to land on a board verbatim (her own prompt says so).
 * This is where Isla's actual voice/agency-frame rules run over that material to produce
 * the two-part hook and body craftDirector.copyFromAmmo() then formats onto the template.
 */
function islaUserPrompt(brief: CreativeAmmoBrief): string {
  const hookMax = COPY_LIMITS.hook - 2; // headroom below the 40-char hard limit
  const hook2Max = COPY_LIMITS.hook2 - 2; // headroom below the 36-char hard limit
  return `Craft ONE Strata Finance post from this Creative Ammo Brief. Track: ${brief.track}.

RESEARCH FROM CASEY WREN (raw analyst notes — do not alter the facts, do not invent a number):
Headline: ${brief.headline}
Core fact: ${brief.coreFact}
SME impact (raw): ${brief.smeImpact}
Trigger: ${brief.trigger}
Fresh angle: ${brief.freshAngle}
Data bites: ${brief.dataBites.join(" | ")}

Write it as a punchy two-part hook, not a report sentence. socialAngle must be ONE sentence with a clear break near the middle — a colon, a dash, or two short clauses split by a full stop — so it splits cleanly into Hook 1 (recognition, ink) then Hook 2 (the turn, gold) on the board. This is a headline, not a summary: cut every word that doesn't earn its place.

HARD LIMITS, no exceptions — go over and your half gets silently cut mid-word on the board, which reads worse than writing short in the first place:
- First half (Hook 1): ${hookMax} characters MAX.
- Second half (Hook 2): ${hook2Max} characters MAX.

Match this length and punch exactly — count the characters before you answer:
"The bank took eight weeks to say no." (37) / "Here is what happened in week one." (35)
"Declined is a decision by one lender." (38) / "It is not a verdict." (21)

- socialAngle: the full two-part sentence built from those two short halves.
- smeImpact: the body line — one sentence, the mechanism or the turn (what the reader can do, ask, or refuse), in your voice. Do not add "We do not lend" — that identity line is appended automatically. Under ${COPY_LIMITS.body - 30} characters.

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
    const text = await ask(islaUserPrompt(brief), undefined, MARKETING_DIRECTOR_PROMPT);
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
