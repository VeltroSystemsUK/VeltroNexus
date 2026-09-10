import { storage } from "../server/storage";
import { approveEditorial, reviewEditorialCopy, signOffEditorialCompliance } from "../shared/editorial";
import {
  NEWS_CATEGORY_LABELS,
  canPublishLearn,
  isNewsCategory,
  slugifyLearnTitle,
  snapshotLearnPiece,
  type NewsCategory,
} from "../shared/learn";
import type { LearnPiece } from "../shared/schema";

function categoryFromTitle(title: string): NewsCategory | null {
  for (const [category, label] of Object.entries(NEWS_CATEGORY_LABELS) as Array<[NewsCategory, string]>) {
    if (title.startsWith(`${label} —`) || title.startsWith(`${label} -`)) return category;
  }
  return null;
}

function excerptFrom(body: string, fallback: string): string {
  const line = body
    .replace(/^#.*$/m, "")
    .split(/\n+/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith("#") && !part.startsWith("Source:"));
  if (!line) return fallback;
  return line.length > 180 ? `${line.slice(0, 177)}…` : line;
}

async function main() {
  const users = await storage.getAllUsers();
  const user =
    users.find((row) => row.role === "super_admin") ||
    users.find((row) => row.role === "underwriter") ||
    users[0];
  if (!user) throw new Error("No users in storage.");
  const drafts = (await storage.listEditorialPieces(user.id)).filter((row) => row.type === "news");
  for (const draft of drafts) {
    if (!draft.id) continue;
    const category = categoryFromTitle(draft.title);
    if (!isNewsCategory(category)) {
      console.log(`Skip #${draft.id} ${draft.title}: no news section`);
      continue;
    }
    const review = reviewEditorialCopy({ ...draft, autoPublish: false });
    if (!review.ok) {
      console.log(`Skip #${draft.id} ${draft.title}: ${review.findings.map((item) => item.message).join(" ")}`);
      continue;
    }
    const approved = approveEditorial(draft);
    const cleared = signOffEditorialCompliance({ ...draft, ...approved });
    const gated = await storage.updateEditorialPiece(draft.id, user.id, {
      status: cleared.status,
      compliance: cleared.compliance,
    });
    if (!gated) throw new Error(`Failed to gate ${draft.title}`);
    const excerpt = excerptFrom(gated.body, gated.title);
    const gate = canPublishLearn({
      status: gated.status,
      compliance: gated.compliance,
      autoPublish: gated.autoPublish !== false,
      kind: "news",
      type: "news",
      category,
      title: gated.title,
      excerpt,
      body: gated.body,
    });
    if (!gate.ok) {
      console.log(`Skip #${draft.id} ${draft.title}: ${gate.error}`);
      continue;
    }
    const live = await storage.upsertLiveLearnPiece(
      snapshotLearnPiece({
        kind: "news",
        slug: slugifyLearnTitle(gated.title),
        title: gated.title,
        excerpt,
        body: gated.body,
        pathPosition: null,
        category,
        source: { desk: "editorial", id: gated.id! },
        userId: user.id,
      }) as LearnPiece,
    );
    console.log(`Live news #${live.id} /news/${live.slug}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
