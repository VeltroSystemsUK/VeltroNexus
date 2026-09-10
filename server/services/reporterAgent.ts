import cron from "node-cron";
import { storage } from "../storage";
import { formatCaseyNotes, type CaseyNote } from "@shared/craftScout";
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABELS, type NewsCategory } from "@shared/learn";
import { houseAskWithEngine, researchTopic } from "./caseyScout";

const TIMEZONE = "Europe/London";

const CATEGORY_SEARCH_QUERY: Record<NewsCategory, string> = {
  uk_commercial_finance: "UK commercial finance and SME lending news this week",
  uk_economy: "UK economy news today interest rates inflation Bank of England",
  uk_politics: "UK politics news today Westminster government",
};

export const REPORTER_DIGEST_PROMPT = `You are the Reporter at Strata Finance, curating a short daily UK news digest for Strata Learn's News channel. You do not post. You do not invent stories, facts, or source URLs — never invent. If the notes below don't cover something, leave it out.`;

export function reporterUserPrompt(category: NewsCategory, notes: CaseyNote[], today: string): string {
  const crawled = formatCaseyNotes(notes);
  const ground = crawled
    ? `Use ONLY these notes for stories and source URLs. Do not invent a story or a URL that is not in the notes below.\nNOTES:\n${crawled}`
    : "No notes landed today. Write a single short paragraph saying there is nothing to report and why, rather than inventing stories.";
  const politicsShape =
    category === "uk_politics"
      ? "One desk note, not a Westminster ticker. Pick ONE story that would change what a UK director or introducer does, fears, or trusts. Do not list Farage/Reform/Dover as five near-identical bullets."
      : "One desk note. Lead with the story, not the section name. Two items maximum if they actually differ.";
  return `Write one desk note in Markdown for the "${NEWS_CATEGORY_LABELS[category]}" section of Strata Learn.
Today (UK): ${today}

Shape:
# <the story headline — never "${NEWS_CATEGORY_LABELS[category]} — ${today}">
Short standfirst (one sentence)
Then 1-2 ## items, each a distinct headline, a short paragraph, and a plain-text source line ("Source: <name>, <url>")
${politicsShape}

${ground}

House policy: Strata Finance packages UK SME distress-refinance files; it does not lend. Close with a one-line plain packager-identity sentence. No rates, APR, guarantees, payday, consumer-credit, or "we lend" claims about Strata itself. Markdown only.`;
}

async function resolveOwnerUserId(): Promise<string> {
  const users = await storage.getAllUsers();
  const shaun = users.find((user) => (user.email || "").toLowerCase() === "shaun@veltro.co.uk");
  if (shaun) return shaun.id;
  const admin = users.find((user) => user.role === "super_admin");
  if (admin) return admin.id;
  if (users[0]) return users[0].id;
  throw new Error("No owner user available for the Reporter agent");
}

function todayTitle(category: NewsCategory, today: string): string {
  return `${NEWS_CATEGORY_LABELS[category]} — ${today}`;
}

async function draftCategoryDigest(userId: string, category: NewsCategory, today: string): Promise<{ skipped: boolean; id?: number }> {
  const title = todayTitle(category, today);
  const existing = await storage.listEditorialPieces(userId);
  if (existing.some((row) => row.type === "news" && row.title === title)) {
    return { skipped: true };
  }
  const created = await storage.createEditorialPiece(
    { type: "news", title, topic: CATEGORY_SEARCH_QUERY[category] },
    userId,
  );
  const research = await researchTopic(CATEGORY_SEARCH_QUERY[category]);
  await storage.updateEditorialPiece(created.id!, userId, { notes: research.notes });
  const { text, engine } = await houseAskWithEngine(
    reporterUserPrompt(category, research.notes, today),
    undefined,
    REPORTER_DIGEST_PROMPT,
  );
  await storage.updateEditorialPiece(created.id!, userId, {
    body: text,
    engine,
    status: "draft",
    compliance: "pending",
  });
  return { skipped: false, id: created.id };
}

export async function runDailyReporterDigest(): Promise<{ drafted: number; skipped: number }> {
  const userId = await resolveOwnerUserId();
  const today = new Date().toISOString().slice(0, 10);
  let drafted = 0;
  let skipped = 0;
  for (const category of NEWS_CATEGORIES) {
    try {
      const result = await draftCategoryDigest(userId, category, today);
      if (result.skipped) skipped++;
      else drafted++;
    } catch (error) {
      console.error(`[Reporter] Failed to draft ${category} digest:`, error);
    }
  }
  return { drafted, skipped };
}

class ReporterAgentService {
  private started = false;

  start() {
    if (this.started) return;
    this.started = true;
    // 06:00 — drafts land before the desk day starts, for you to review and Publish to Learn
    cron.schedule(
      "0 6 * * *",
      () => {
        runDailyReporterDigest()
          .then((result) => console.log(`[Reporter] Daily digest drafted=${result.drafted} skipped=${result.skipped}`))
          .catch((error) => console.error("[Reporter] Daily digest failed:", error));
      },
      { timezone: TIMEZONE },
    );
    console.log("[Reporter] Daily news digest scheduled (06:00 Europe/London).");
  }
}

export const reporterAgentService = new ReporterAgentService();
