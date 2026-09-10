import { Readable } from "stream";
import PDFDocument from "pdfkit";
import { xaiBearer } from "@shared/craftYaffle";
import {
  BBB_BUSINESS_PLAN_SECTIONS,
  BBB_PLAN_DISCLAIMER,
  type BbbBusinessPlanSection,
} from "@shared/bbbBusinessPlan";

type Env = Record<string, string | undefined>;

export type BusinessPlanContext = {
  companyName: string;
  companyNumber?: string | null;
  registeredAddress?: string | null;
  companyStatus?: string | null;
  sicDescription?: string | null;
  contacts?: string[];
  background?: string | null;
  fundingReason?: string | null;
  researchProfile?: string | null;
  documents?: string[];
  loanAmount?: number | null;
  termMonths?: number | null;
};

const GROK_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = "grok-4.6";

export function buildBusinessPlanPrompt(ctx: BusinessPlanContext): string {
  const facts = [
    `Company: ${ctx.companyName}`,
    ctx.companyNumber ? `Company number: ${ctx.companyNumber}` : "",
    ctx.registeredAddress ? `Registered address: ${ctx.registeredAddress}` : "",
    ctx.companyStatus ? `Status: ${ctx.companyStatus}` : "",
    ctx.sicDescription ? `SIC: ${ctx.sicDescription}` : "",
    ctx.contacts?.length ? `People on file: ${ctx.contacts.join("; ")}` : "",
    ctx.loanAmount ? `Facility discussed: £${ctx.loanAmount.toLocaleString("en-GB")}` : "",
    ctx.termMonths ? `Term discussed: ${ctx.termMonths} months` : "",
    ctx.fundingReason ? `Funding reason on file: ${ctx.fundingReason}` : "",
    ctx.background ? `Background notes: ${ctx.background}` : "",
    ctx.researchProfile ? `Website research: ${ctx.researchProfile}` : "",
    ctx.documents?.length ? `Documents on file: ${ctx.documents.join(", ")}` : "Documents on file: none listed",
  ]
    .filter(Boolean)
    .join("\n");

  const outline = BBB_BUSINESS_PLAN_SECTIONS.map((section) => `${section.id}: ${section.heading}`).join("\n");

  return `Write a business plan for a British Business Bank Growth Guarantee Scheme / CDFI accredited lender.
Use ONLY the facts below. If a fact is missing, write "Unknown — not on the client file." Do not invent turnover, profit, balances, forecasts, or customer names.

FACTS
${facts}

Return JSON only:
{"sections":[{"id":"${BBB_BUSINESS_PLAN_SECTIONS[0].id}","body":""}]}

Required section ids:
${outline}

Keep each body to 1-3 short paragraphs in plain British English. No marketing language.`;
}

export function parseBusinessPlanSections(raw: unknown): BbbBusinessPlanSection[] {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const incoming = Array.isArray(rec.sections) ? rec.sections : [];
  const byId = new Map<string, string>();
  for (const row of incoming) {
    if (!row || typeof row !== "object") continue;
    const id = String((row as Record<string, unknown>).id || "").trim();
    const body = String((row as Record<string, unknown>).body || "").trim();
    if (id && body) byId.set(id, body);
  }
  return BBB_BUSINESS_PLAN_SECTIONS.map((section) => ({
    id: section.id,
    heading: section.heading,
    body: byId.get(section.id) || "Unknown — not on the client file.",
  }));
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*|\s*```$/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Grok did not return a business plan");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

async function grokPlan(prompt: string, env: Env): Promise<string> {
  const key = xaiBearer(env);
  if (!key) throw new Error("XAI_API_KEY is not configured on the server");
  const res = await fetch(GROK_CHAT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.XAI_MODEL?.trim() || GROK_MODEL,
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "You are Grok compiling a factual business plan for a UK CDFI / British Business Bank lender. JSON only. Do not invent figures.",
        },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 400) || `Grok plan failed (${res.status})`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Grok returned an empty business plan");
  return text;
}

export async function generateBusinessPlanPdf(input: {
  companyName: string;
  companyNumber?: string | null;
  sections: BbbBusinessPlanSection[];
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fillColor("#2E5096").font("Helvetica-Bold").fontSize(16).text("STRATA FINANCE");
  doc.font("Helvetica").fontSize(9).fillColor("#5C6673").text("Business plan for a British Business Bank / CDFI accredited lender");
  doc.moveDown(0.6);
  doc.fillColor("#12141A").font("Helvetica-Bold").fontSize(18).text(input.companyName);
  if (input.companyNumber) {
    doc.font("Helvetica").fontSize(10).fillColor("#5C6673").text(`Company number ${input.companyNumber}`);
  }
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(9).fillColor("#5C6673").text(BBB_PLAN_DISCLAIMER, { align: "left" });
  doc.moveDown(1);

  for (const section of input.sections) {
    doc.fillColor("#2E5096").font("Helvetica-Bold").fontSize(12).text(section.heading);
    doc.moveDown(0.25);
    doc.fillColor("#181A1E").font("Helvetica").fontSize(10).text(section.body, { align: "justify" });
    doc.moveDown(0.8);
  }

  doc.end();
  return done;
}

export async function generateBbbBusinessPlan(
  ctx: BusinessPlanContext,
  env: Env = process.env
): Promise<{ pdf: Buffer; fileName: string; sections: BbbBusinessPlanSection[] }> {
  const prompt = buildBusinessPlanPrompt(ctx);
  const raw = await grokPlan(prompt, env);
  const sections = parseBusinessPlanSections(parseJsonObject(raw));
  const pdf = await generateBusinessPlanPdf({
    companyName: ctx.companyName,
    companyNumber: ctx.companyNumber,
    sections,
  });
  const slug = ctx.companyName.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return {
    pdf,
    fileName: `${slug || "company"}-BBB-business-plan.pdf`,
    sections,
  };
}

export function pdfToStream(pdf: Buffer): Readable {
  return Readable.from(pdf);
}
