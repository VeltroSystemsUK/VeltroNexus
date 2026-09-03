import { readdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { approveEditorial, reviewEditorialCopy, signOffEditorialCompliance } from "../shared/editorial";
import { canPublishLearn, snapshotLearnPiece } from "../shared/learn";
import { parseLearnCourseMarkdown } from "../shared/learnCourses";
import type { LearnPiece } from "../shared/schema";
import { storage } from "../server/storage";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COURSE_DIR = path.join(ROOT, "scripts", "learn_courses");

function argValue(flag: string): string | undefined {
  const prefix = `${flag}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() || undefined : undefined;
}

function loadCourseFiles() {
  return readdirSync(COURSE_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const raw = readFileSync(path.join(COURSE_DIR, name), "utf8");
      return { name, ...parseLearnCourseMarkdown(raw) };
    });
}

async function resolveUserId(): Promise<string> {
  const requested = argValue("--user-id") || argValue("--user") || process.env.LEARN_INGEST_USER_ID;
  if (requested) {
    const user = (await storage.getUser(requested)) || (await storage.getUserByEmail(requested));
    if (!user) {
      console.error(`User not found: ${requested}`);
      process.exit(1);
    }
    return user.id;
  }
  const users = await storage.getAllUsers();
  const preferred =
    users.find((user) => user.role === "super_admin") ||
    users.find((user) => user.role === "underwriter") ||
    users.find((user) => /admin@/i.test(user.email || "")) ||
    users[0];
  if (!preferred) {
    console.error("No users in storage. Create an admin first, or pass --user-id.");
    process.exit(1);
  }
  return preferred.id;
}

async function main() {
  const force = process.argv.includes("--force");
  const draftOnly = process.argv.includes("--draft");
  const courses = loadCourseFiles();
  const userId = await resolveUserId();
  const existing = await storage.listEditorialPieces(userId);
  const byTitle = new Map(existing.filter((row) => row.type === "blog").map((row) => [row.title, row]));

  for (const course of courses) {
    const review = reviewEditorialCopy({
      userId,
      type: "blog",
      title: course.meta.title,
      topic: course.meta.topic,
      body: course.body,
      notes: [],
      engine: null,
      status: "draft",
      compliance: "pending",
      autoPublish: false,
    });
    if (!review.ok) {
      throw new Error(`${course.meta.slug} failed house policy: ${review.findings.map((item) => item.message).join(" ")}`);
    }

    let piece = byTitle.get(course.meta.title);
    if (piece?.id != null) {
      if (!force) {
        throw new Error(`Refusing to overwrite existing editorial without --force: ${course.meta.title}`);
      }
      const updated = await storage.updateEditorialPiece(piece.id, userId, {
        title: course.meta.title,
        topic: course.meta.topic,
        body: course.body,
      });
      if (!updated) throw new Error(`Failed to update ${course.meta.title}`);
      piece = updated;
    } else {
      const created = await storage.createEditorialPiece(
        { type: "blog", title: course.meta.title, topic: course.meta.topic },
        userId,
      );
      if (!created.id) throw new Error(`Failed to create ${course.meta.title}`);
      const filled = await storage.updateEditorialPiece(created.id, userId, {
        title: course.meta.title,
        topic: course.meta.topic,
        body: course.body,
      });
      if (!filled) throw new Error(`Failed to fill ${course.meta.title}`);
      piece = filled;
      byTitle.set(course.meta.title, piece);
    }

    if (draftOnly) {
      console.log(`Draft #${piece.id}: ${course.meta.title}`);
      continue;
    }

    const approved = approveEditorial(piece);
    const cleared = signOffEditorialCompliance({ ...piece, ...approved });
    const gated = await storage.updateEditorialPiece(piece.id!, userId, {
      status: cleared.status,
      compliance: cleared.compliance,
    });
    if (!gated) throw new Error(`Failed to gate ${course.meta.title}`);

    const gate = canPublishLearn({
      status: gated.status,
      compliance: gated.compliance,
      autoPublish: gated.autoPublish !== false,
      kind: "article",
      type: gated.type,
      title: gated.title,
      excerpt: course.meta.excerpt,
      body: gated.body,
    });
    if (!gate.ok) throw new Error(`${course.meta.slug}: ${gate.error}`);

    const snapshot = snapshotLearnPiece({
      kind: "article",
      slug: course.meta.slug,
      title: gated.title,
      excerpt: course.meta.excerpt,
      body: gated.body,
      durationLabel: course.meta.durationLabel,
      pathPosition: null,
      source: { desk: "editorial", id: gated.id! },
      userId,
    });
    const live = await storage.upsertLiveLearnPiece(snapshot as LearnPiece);
    console.log(`Live #${live.id} /read/${course.meta.slug}: ${course.meta.title}`);
  }

  if (draftOnly) {
    console.log("");
    console.log("Drafts only. Not approved, not published.");
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
