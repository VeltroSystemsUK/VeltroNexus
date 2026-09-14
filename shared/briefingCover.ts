import { CONVERT_STOP_LINE } from "./smeConvert";

export function buildCoverEmail(opts: {
  companyName: string;
  firstName?: string;
  briefingUrl: string;
}): {
  subject: string;
  html: string;
} {
  const name = opts.companyName || "your company";
  const hi = opts.firstName ? `Hi ${opts.firstName},` : "Hi,";
  return {
    subject: `A private note for the directors of ${name}`,
    html: `<p>${hi}</p><p>I put together a short private briefing for ${name}. The link isn't published — it's for you.</p><p><a href="${opts.briefingUrl}">Open your briefing</a></p><p>If this is in the right area, reply and I'll put a file together.</p><p>${CONVERT_STOP_LINE}</p>`,
  };
}
