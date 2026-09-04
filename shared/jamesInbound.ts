import { classifyInboundMail } from "./mailDesk";
import { parseAddressList } from "./imapInbox";
import { replySubject } from "./smeOpenFollowUp";

export const JAMES_CLASSES = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
] as const;

export type JamesClass = (typeof JAMES_CLASSES)[number];

export type JamesPriority = "P0" | "P1" | "P2" | "P3" | "none";

export type JamesInboundMail = {
  id?: string;
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
  createdAt?: string;
};

export const JAMES_SIGNATURE = `James Hale
Business Consultant
Strata Finance

enquiries@stratafinance.co.uk
https://stratafinance.co.uk

Strata Finance packages commercial finance for UK limited companies. We do not lend. We are not authorised or regulated by the FCA. Most finance to limited companies sits outside FCA regulation. If you would rather not hear from us, reply STOP.`;

const CLASS_PRIORITY: Record<JamesClass, JamesPriority> = {
  A: "P1",
  B: "P1",
  C: "P1",
  D: "P1",
  E: "P1",
  F: "P3",
  G: "P2",
  H: "P0",
  I: "P1",
  J: "P0",
  K: "none",
  L: "P3",
  M: "P2",
};

const CLASS_LABEL: Record<JamesClass, string> = {
  A: "Hot borrower",
  B: "Warm borrower",
  C: "Introducer",
  D: "Documents supplied",
  E: "Scheduling",
  F: "Not now / not right",
  G: "Wrong fit",
  H: "Distress",
  I: "Complaint or hostility",
  J: "Stop / unsubscribe",
  K: "Auto-reply / bounce / OOO",
  L: "Lender, broker, vendor, recruiter",
  M: "Unclear",
};

export function jamesPriority(cls: JamesClass): JamesPriority {
  return CLASS_PRIORITY[cls];
}

export function jamesClassLabel(cls: JamesClass): string {
  return CLASS_LABEL[cls];
}

export function jamesShouldDraft(cls: JamesClass): boolean {
  return cls !== "J" && cls !== "K" && cls !== "L";
}

function bodyOf(mail: JamesInboundMail): string {
  const html = String(mail.html || "").replace(/<[^>]+>/g, " ");
  return `${mail.subject || ""} ${mail.text || ""} ${html}`.toLowerCase();
}

export function classifyJamesInbound(mail: JamesInboundMail): JamesClass {
  const desk = classifyInboundMail({
    from: mail.from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  if (desk.kind === "stop") return "J";
  if (desk.kind === "bounce") return "K";
  if (desk.kind === "spam") return "K";

  const from = parseAddressList(mail.from);
  const text = bodyOf(mail);

  if (/\b(out of office|automatic reply|auto-reply|autoreply)\b/i.test(text)) return "K";
  if (/\b(losing the house|not sleeping|bailiff|winding-?up hearing|suicide|can't go on)\b/i.test(text)) return "H";
  if (/\b(report you|ico|solicitors? letter|harassment|spam|how dare)\b/i.test(text) && /anger|complaint|report|ico|solicitor/i.test(text))
    return "I";
  if (/\b(buy to let|b2l|btl|personal loan|mortgage|development finance|equity raise|crypto)\b/i.test(text)) return "G";
  if (/\b(partnership opportunity|white.?label|we lend to your clients|recruit)\b/i.test(text)) return "L";
  if (/\b(my client|our client|i am (an )?accountant|as their (broker|adviser|solicitor))\b/i.test(text)) return "C";
  if (/\b(attached|please find|bank statements?|accounts attached|documents? (attached|enclosed))\b/i.test(text)) return "D";
  if (/\b(tuesday|thursday|can we (talk|speak|call)|what time|book a call|call me)\b/i.test(text)) return "E";
  if (/\b(not for us|we're fine|we are fine|maybe next year|no thank you)\b/i.test(text)) return "F";
  if (/\b(let's start|lets start|what do you need|please proceed|yes,? interested|i want to go ahead)\b/i.test(text))
    return "A";
  if (/\b(are you a lender|fca|what does it cost|what is a cdfi|personal guarantee|how long does it take|will i be approved)\b/i.test(text))
    return "B";
  if (desk.kind === "responsive") return "A";
  if (from && desk.kind === "other") return "M";
  return "M";
}

export function composeJamesDraft(mail: JamesInboundMail, cls: JamesClass): string {
  const first = (mail.text || "").trim().split(/\n+/)[0] || String(mail.subject || "").trim();
  const asked = first.slice(0, 220);
  const bodies: Record<Exclude<JamesClass, "J" | "K" | "L">, string> = {
    A: `${asked ? `Thank you for writing. ` : ""}Yes — we can do the first picture by email.

A short overview is enough to start: what the money is for, roughly what you are servicing and how often it is collected, whether there is an HMRC Time to Pay or arrears, and whether you would rather stay on email or book a call.

Strata packages the case. We do not lend, and we do not decide credit. The assessment exists to find out whether a case can be built.`,
    B: `Strata packages commercial finance for UK limited companies. We do not lend and we are not authorised or regulated by the FCA.

There is no charge for the initial assessment. If a case can be built, Shaun sets out the fee arrangement in writing before anything is started.

If useful, send a short written overview, or take the four-question assessment at https://explore.stratanexus.co.uk.`,
    C: `Thank you for getting in touch on your client's behalf.

Strata packages the case and presents it. We do not lend, and we do not poach the relationship. Shaun assesses; Sterling makes the lender recommendation once the file is built. There is no charge for the initial read.

A one-page picture of the situation is enough to start, or a call with Shaun if you would rather talk it through.`,
    D: `Thank you — the files are in. Shaun will read them against the pack. This email is only an acknowledgement, not an assessment.

I will list what still looks outstanding on the next note, item by item.`,
    E: `A call is fine. Shaun will confirm a time from the draft I have put in front of him — I will not book the diary until he has approved it.

If you would rather stay on email, say so and we will.`,
    F: `Understood. I will leave this here. If circumstances change, the same address will reach us.`,
    G: `This is not what Strata does. We package non-regulated commercial finance for UK limited companies, not that product.

A regulated adviser or your accountant is the honest next step. Business Debtline is 0800 197 6026 if personal debt is part of the picture.`,
    H: `I have read this. Shaun will take it from here today.

If personal debt or the house is in play, Business Debtline is 0800 197 6026. You do not have to wait on us for that number.`,
    I: `I am sorry this landed badly. You will not get another marketing email from us.

Shaun has this. I will not argue the outreach.`,
    M: `I want to answer the right thing. Two useful paths from here: a short written overview of the facilities you are servicing, or one question you want answered first.

Which would you rather?`,
  };
  const main = cls === "J" || cls === "K" || cls === "L" ? "" : bodies[cls];
  return `${main}\n\n${JAMES_SIGNATURE}`.trim();
}

export function jamesReplySubject(subject?: string): string {
  return replySubject(subject || "");
}

export type JamesPacketInput = {
  mail: JamesInboundMail;
  cls: JamesClass;
  draft: string;
  receivedAt: string;
  draftReadyAt: string;
  sla: "met" | "missed";
  prior?: string;
};

export function jamesPacketMarkdown(input: JamesPacketInput): string {
  const { mail, cls, draft, receivedAt, draftReadyAt, sla, prior } = input;
  const from = parseAddressList(mail.from);
  const flags =
    cls === "A"
      ? "HOT"
      : cls === "D"
        ? "DOCS IN"
        : cls === "H"
          ? "DISTRESS"
          : cls === "I"
            ? "COMPLAINT"
            : "NONE";
  return `## Thread: ${mail.subject || "(no subject)"} | From: ${from} | Class: ${cls} ${jamesClassLabel(cls)} | Priority: ${jamesPriority(cls)}
Received: ${receivedAt} | Draft ready: ${draftReadyAt} | SLA: ${sla}

### What they said (three lines, James's words)
${(mail.text || mail.subject || "").trim().split(/\n/).slice(0, 3).join("\n") || "(empty)"}

### What they were sent before (cold email date, follow-up date, any prior replies)
${prior || "Not in the packet. Check Agent Mail if this sender has a thread."}

### What the draft does (one line)
Class ${cls} reply from the answer bank. Shaun sends or deletes.

### Anything Shaun must check before sending (fees, a claim, a name, a date)
Fees and timings marked SHAUN TO CONFIRM stay as "Shaun will set that out".

### Pack status (Class A/D only): stage reached, items received / outstanding
${cls === "A" || cls === "D" ? "See intake.md. Not assessed in this draft." : "n/a"}

### Flags: ${flags}
### Suggested next step after send (calendar, docs list, hand to David, nothing)
${cls === "A" ? "Wait for the overview." : cls === "E" ? "Shaun confirms the slot." : "Nothing unless they reply."}

---
${draft}
---
`;
}

export function jamesRfc822(opts: {
  fromAddress: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}): string {
  const lines = [
    `From: ${opts.fromName} <${opts.fromAddress}>`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
  ];
  if (opts.inReplyTo) {
    lines.push(`In-Reply-To: ${opts.inReplyTo}`);
    lines.push(`References: ${opts.inReplyTo}`);
  }
  return `${lines.join("\r\n")}\r\n\r\n${opts.body.replace(/\n/g, "\r\n")}\r\n`;
}
