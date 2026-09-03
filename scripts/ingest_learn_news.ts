import { readdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { approveEditorial, reviewEditorialCopy, signOffEditorialCompliance } from "../shared/editorial";
import { canPublishLearn, snapshotLearnPiece } from "../shared/learn";
import type { LearnPiece } from "../shared/schema";
import { storage } from "../server/storage";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEWS_DIR = path.join(ROOT, "scripts", "learn_news");

type Meta = {
  slug: string;
  title: string;
  excerpt: string;
  durationLabel: string;
  topic: string;
};

function parseFile(raw: string): { meta: Meta; body: string } {
  const match = raw.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error("News post needs YAML frontmatter.");
  const fields: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const meta = {
    slug: fields.slug || "",
    title: fields.title || "",
    excerpt: fields.excerpt || "",
    durationLabel: fields.durationLabel || "",
    topic: fields.topic || "learn-news",
  };
  if (!meta.slug || !meta.title || !meta.excerpt) throw new Error("Frontmatter needs slug, title, excerpt.");
  return { meta, body: match[2]!.trim() };
}

async function resolveUserId(): Promise<string> {
  const users = await storage.getAllUsers();
  const preferred =
    users.find((user) => user.role === "super_admin") ||
    users.find((user) => user.role === "underwriter") ||
    users[0];
  if (!preferred) throw new Error("No users in storage.");
  return preferred.id;
}

async function main() {
  const force = process.argv.includes("--force");
  const userId = await resolveUserId();
  const existing = await storage.listEditorialPieces(userId);
  const byTitle = new Map(existing.filter((row) => row.type === "news").map((row) => [row.title, row]));

  for (const name of readdirSync(NEWS_DIR).filter((file) => file.endsWith(".md")).sort()) {
    const parsed = parseFile(readFileSync(path.join(NEWS_DIR, name), "utf8"));
    const review = reviewEditorialCopy({
      userId,
      type: "news",
      title: parsed.meta.title,
      topic: parsed.meta.topic,
      body: parsed.body,
      notes: [],
      engine: null,
      status: "draft",
      compliance: "pending",
      autoPublish: false,
    });
    if (!review.ok) throw new Error(`${parsed.meta.slug} failed house policy`);

    let piece = byTitle.get(parsed.meta.title);
    if (piece?.id != null) {
      if (!force) throw new Error(`Refusing to overwrite without --force: ${parsed.meta.title}`);
      piece = await storage.updateEditorialPiece(piece.id, userId, {
        title: parsed.meta.title,
        topic: parsed.meta.topic,
        body: parsed.body,
      });
    } else {
      const created = await storage.createEditorialPiece(
        { type: "news", title: parsed.meta.title, topic: parsed.meta.topic },
        userId,
      );
      piece = await storage.updateEditorialPiece(created.id!, userId, {
        title: parsed.meta.title,
        topic: parsed.meta.topic,
        body: parsed.body,
      });
    }
    if (!piece?.id) throw new Error(`Failed to save ${parsed.meta.title}`);

    const approved = approveEditorial(piece);
    const cleared = signOffEditorialCompliance({ ...piece, ...approved });
    const gated = await storage.updateEditorialPiece(piece.id, userId, {
      status: cleared.status,
      compliance: cleared.compliance,
    });
    if (!gated) throw new Error(`Failed to gate ${parsed.meta.title}`);
    const gate = canPublishLearn({
      status: gated.status,
      compliance: gated.compliance,
      autoPublish: gated.autoPublish !== false,
      kind: "news",
      type: "news",
      title: gated.title,
      excerpt: parsed.meta.excerpt,
      body: gated.body,
    });
    if (!gate.ok) throw new Error(gate.error);
    const live = await storage.upsertLiveLearnPiece(
      snapshotLearnPiece({
        kind: "news",
        slug: parsed.meta.slug,
        title: gated.title,
        excerpt: parsed.meta.excerpt,
        body: gated.body,
        durationLabel: parsed.meta.durationLabel,
        pathPosition: null,
        source: { desk: "editorial", id: gated.id! },
        userId,
      }) as LearnPiece,
    );
    console.log(`Live news #${live.id} /news/${parsed.meta.slug}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
