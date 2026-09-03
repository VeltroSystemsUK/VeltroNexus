import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { storage } from "../server/storage";
import { LEARN_VIDEO_PUBLIC_PREFIX } from "../shared/learn";

const DESCRIPTION_STUB = "Strata packages UK SME distress-refinance files. We do not lend.";

type CorpusEntry = {
  inboxFile: string;
  title: string;
  topic: string;
  slug: string;
  pathPosition: number | null;
  durationLabel: string;
  excerpt?: string;
};

type Corpus = {
  hero: CorpusEntry;
  videos: CorpusEntry[];
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS_PATH = path.join(ROOT, "scripts", "learn_corpus.json");
const INBOX_DIR = path.join(ROOT, "uploads", "learn", "inbox");
const VIDEOS_DIR = path.join(ROOT, "uploads", "learn", "videos");

function argValue(flag: string): string | undefined {
  const prefix = `${flag}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() || undefined : undefined;
}

function loadCorpus(): Corpus {
  const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8")) as Corpus;
  return corpus;
}

function corpusEntries(corpus: Corpus): CorpusEntry[] {
  return [corpus.hero, ...corpus.videos];
}

function safeInboxFile(name: string): string {
  const base = path.basename(name);
  if (base !== name || name.includes("..") || !name.toLowerCase().endsWith(".mp4")) {
    throw new Error(`Unsafe inbox filename: ${name}`);
  }
  return base;
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

function descriptionFor(title: string): string {
  return `${DESCRIPTION_STUB} ${title}`;
}

async function ingestEntry(
  entry: CorpusEntry,
  userId: string,
  existingByTitle: Map<string, { id?: number; title: string }>,
  force: boolean,
): Promise<void> {
  const inboxFile = safeInboxFile(entry.inboxFile);
  const from = path.join(INBOX_DIR, inboxFile);
  const to = path.join(VIDEOS_DIR, inboxFile);
  copyFileSync(from, to);

  const videoUrl = `${LEARN_VIDEO_PUBLIC_PREFIX}${inboxFile}`;
  const description = descriptionFor(entry.title);
  const existing = existingByTitle.get(entry.title);
  const patch = {
    topic: entry.topic,
    description,
    videoUrl,
    durationLabel: entry.durationLabel,
    excerpt: entry.excerpt ?? "",
    pathPosition: entry.pathPosition,
    status: "draft" as const,
    compliance: "pending" as const,
    autoPublish: false as const,
  };

  if (existing?.id != null) {
    if (!force) {
      throw new Error(`Refusing to overwrite existing video without --force: ${entry.title}`);
    }
    const updated = await storage.updateLearnVideo(existing.id, userId, patch);
    if (!updated) throw new Error(`Failed to update draft: ${entry.title}`);
    console.log(`Updated draft #${updated.id} (still draft): ${entry.title} -> ${videoUrl}`);
    return;
  }

  const created = await storage.createLearnVideo({ title: entry.title, topic: entry.topic }, userId);
  if (!created.id) throw new Error(`Failed to create draft: ${entry.title}`);
  const updated = await storage.updateLearnVideo(created.id, userId, patch);
  if (!updated) throw new Error(`Failed to fill draft: ${entry.title}`);
  existingByTitle.set(entry.title, { id: created.id, title: entry.title });
  console.log(`Created draft #${created.id}: ${entry.title} -> ${videoUrl}`);
}

async function main() {
  const force = process.argv.includes("--force");
  const corpus = loadCorpus();
  const entries = corpusEntries(corpus);

  const missing = entries
    .map((entry) => safeInboxFile(entry.inboxFile))
    .filter((name) => !existsSync(path.join(INBOX_DIR, name)));
  if (missing.length) {
    console.error("Missing inbox files:");
    for (const name of missing) console.error(name);
    process.exit(1);
  }

  const userId = await resolveUserId();
  const existing = await storage.listLearnVideos(userId);
  const existingByTitle = new Map(existing.map((row) => [row.title, { id: row.id, title: row.title }]));
  const collisions = entries.filter((entry) => existingByTitle.has(entry.title)).map((entry) => entry.title);
  if (collisions.length && !force) {
    console.error("Existing videos with the same title (pass --force to overwrite drafts):");
    for (const title of collisions) console.error(title);
    process.exit(1);
  }

  mkdirSync(VIDEOS_DIR, { recursive: true });

  for (const entry of entries) {
    await ingestEntry(entry, userId, existingByTitle, force);
  }

  console.log("");
  console.log("Drafts only. Not approved, not compliance-cleared, not published.");
  console.log("Next steps:");
  console.log("- paste transcripts from the Grok share");
  console.log("- approve");
  console.log("- compliance");
  console.log("- publish");
  console.log("- set slug/path on publish dialog");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
