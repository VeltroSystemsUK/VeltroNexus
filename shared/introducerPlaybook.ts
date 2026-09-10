import { compiledHasStopLine } from "./slfOutreach";

export const INTRODUCER_PANEL_ONE_LINER =
  "You keep the client. We pack the CDFI / stacked-debt file against panel and report back to you.";

export const INTRODUCER_STOP_LINE = "If this isn't useful, reply stop and we won't email again.";

export type IntroducerPlaybookFields = {
  introducerFirm: string;
  introducerFirstNameOrRole: string;
  panelOneLiner: string;
  senderName: string;
  senderFirm: string;
  senderPhone?: string;
  sourceExplanation: string;
  introducerType?: string | null;
};

export type IntroducerCompileOk = {
  ok: true;
  step: string;
  channel: "email" | "linkedin_staged";
  subject: string;
  text: string;
  purpose: string;
  final?: boolean;
};

export type IntroducerCompileFail = { ok: false; reason: "playbook_gap" | "wrong_pipeline_pack" | "no_stop_line" };

function leak(text: string): boolean {
  return /\b(acme|mill lane|opening_line|hypothesis|gazette|winding-?up petition)\b/i.test(text);
}

export function compileIntroducerStep(
  step: "intro_1" | "intro_linkedin" | "intro_mid" | "intro_2" | string,
  fields: IntroducerPlaybookFields
): IntroducerCompileOk | IntroducerCompileFail {
  const firm = fields.introducerFirm.trim();
  const who = fields.introducerFirstNameOrRole.trim() || "the directors";
  const panel = fields.panelOneLiner.trim();
  const sender = fields.senderName.trim();
  const senderFirm = fields.senderFirm.trim();
  const source = fields.sourceExplanation.trim();

  if (step === "intro_1") {
    if (!panel || !source || !firm || !sender || !senderFirm) return { ok: false, reason: "playbook_gap" };
    const accountant = !fields.introducerType || fields.introducerType === "accountant";
    const open = accountant
      ? `Hello ${who},\n\nI am ${sender} at ${senderFirm}. We pack CDFI and stacked-debt refinance for accountancy practices that do not want a packing desk of their own.\n\n${panel}\n\nIf a client is carrying expensive short-term facilities or HMRC pressure, send us the outline. You stay the adviser of record.`
      : `Hello ${who},\n\nI am ${sender} at ${senderFirm}. We pack CDFI and stacked-debt refinance for introducers rather than competing for the client.\n\n${panel}\n\nIf you have a file that is taking too much packing time, send it over and we will work it under your introduction.\n\nYou keep the relationship. We keep you copied.`;
    const text = `${open}\n\n${INTRODUCER_STOP_LINE}\nThis address was taken from ${source}.`;
    if (leak(text)) return { ok: false, reason: "wrong_pipeline_pack" };
    if (!compiledHasStopLine(text)) return { ok: false, reason: "no_stop_line" };
    return {
      ok: true,
      step: "intro_1",
      channel: "email",
      subject: `CDFI packaging — ${firm}`,
      text,
      purpose: "Stream B day 1 — packager open. You keep the client.",
    };
  }

  if (step === "intro_linkedin") {
    if (!firm || !senderFirm) return { ok: false, reason: "playbook_gap" };
    const text = `${who} — we pack CDFI / stacked-debt refinance for introducers at ${senderFirm}. You keep the client; we pack the file. If ${firm} has a client sitting outside a high-street box, I am happy to take the packaging off you.`;
    if (leak(text)) return { ok: false, reason: "wrong_pipeline_pack" };
    return {
      ok: true,
      step: "intro_linkedin",
      channel: "linkedin_staged",
      subject: `LinkedIn (introducer): ${firm}`,
      text,
      purpose: "Stream B LinkedIn staged. Owner posts. Does not block email.",
    };
  }

  if (step === "intro_mid") {
    if (!panel || !firm) return { ok: false, reason: "playbook_gap" };
    const text = `Hello ${who},\n\nShort version of how this works if ${firm} sends a CDFI or stacked-debt file:\n\n1. You send the outline — facilities live, HMRC if any, what good looks like.\n2. We pack against panel and come back to you, not around you.\n3. You stay on the thread with the client.\n\nIf that is useful, reply with one file you do not want to live in this month. If not, ignore this.\n\n${INTRODUCER_STOP_LINE}`;
    if (leak(text)) return { ok: false, reason: "wrong_pipeline_pack" };
    if (!compiledHasStopLine(text)) return { ok: false, reason: "no_stop_line" };
    return {
      ok: true,
      step: "intro_mid",
      channel: "email",
      subject: `How we take a file from ${firm}`,
      text,
      purpose: "Stream B day 5 — how a file moves. Still no live SME.",
    };
  }

  if (step === "intro_2") {
    if (!firm || !senderFirm) return { ok: false, reason: "playbook_gap" };
    const phone = fields.senderPhone?.trim();
    const call = phone ? ` or call ${phone}` : "";
    const text = `Hello ${who},\n\nI will not keep filling up the ${firm} inbox.\n\nIf a stacked-debt or HMRC-pressure file lands that you would rather hand to a packager, send it to me at this address${call}.\n\n${INTRODUCER_STOP_LINE}`;
    if (leak(text)) return { ok: false, reason: "wrong_pipeline_pack" };
    if (!compiledHasStopLine(text)) return { ok: false, reason: "no_stop_line" };
    return {
      ok: true,
      step: "intro_2",
      channel: "email",
      subject: `Last note from ${senderFirm}`,
      text,
      purpose: "Stream B day 10 — last automated letter. Queue partner call.",
      final: true,
    };
  }

  return { ok: false, reason: "playbook_gap" };
}
