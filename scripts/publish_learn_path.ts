import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { storage } from "../server/storage";
import {
  LEARN_VIDEO_PUBLIC_PREFIX,
  canPublishLearn,
  signOffLearnVideoCompliance,
  snapshotLearnPiece,
} from "../shared/learn";
import type { LearnPiece } from "../shared/schema";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIDEOS_DIR = path.join(ROOT, "uploads", "learn", "videos");

const PATH_VIDEOS = [
  {
    file: "learn-2-1788427230129.mp4",
    title: "What a commercial payday lender actually is",
    topic: "stacked short-term high-cost credit",
    slug: "payday-lenders",
    pathPosition: 1,
    durationLabel: "1 min",
    excerpt: "An informal name for very short-term, high-cost business credit — and why it stacks.",
  },
  {
    file: "learn-5-1788432055015.mp4",
    title: "Poor cashflow will kill the business on its own",
    topic: "SME cashflow",
    slug: "cashflow",
    pathPosition: 2,
    durationLabel: "1 min",
    excerpt: "The current account is the oxygen. Sort that before anyone sells you another facility.",
  },
  {
    file: "learn-6-1788432275592.mp4",
    title: "Time to Pay is not time to hide",
    topic: "HMRC Time to Pay",
    slug: "time-to-pay",
    pathPosition: 3,
    durationLabel: "1 min",
    excerpt: "An instalment arrangement with HMRC, not a loan, and not a place to disappear.",
  },
  {
    file: "learn-3-1788431382256.mp4",
    title: "How to avoid a warehouse broker",
    topic: "packager vs call-centre broker",
    slug: "bad-brokers",
    pathPosition: 4,
    durationLabel: "55 sec",
    excerpt: "If they will not name the lender, they are selling inventory.",
  },
] as const;

const DESCRIPTION =
  "Strata packages UK SME distress-refinance files. We do not lend.";

async function resolveUserId(): Promise<string> {
  const users = await storage.getAllUsers();
  const preferred =
    users.find((user) => user.role === "super_admin") ||
    users.find((user) => user.role === "underwriter") ||
    users.find((user) => /admin@/i.test(user.email || "")) ||
    users[0];
  if (!preferred) {
    console.error("No users in storage. Create an admin first.");
    process.exit(1);
  }
  return preferred.id;
}

async function publishVideo(
  userId: string,
  entry: (typeof PATH_VIDEOS)[number],
): Promise<void> {
  const from = path.join(VIDEOS_DIR, entry.file);
  if (!existsSync(from)) throw new Error(`Missing ${entry.file}`);
  const videoUrl = `${LEARN_VIDEO_PUBLIC_PREFIX}${entry.file}`;
  const description = `${DESCRIPTION} ${entry.title}`;
  const existing = (await storage.listLearnVideos(userId)).find(
    (row) => row.videoUrl === videoUrl || row.title === entry.title,
  );
  const patch = {
    title: entry.title,
    topic: entry.topic,
    description,
    transcript: description,
    videoUrl,
    excerpt: entry.excerpt,
    durationLabel: entry.durationLabel,
    pathPosition: entry.pathPosition,
    autoPublish: false as const,
  };
  let video = existing?.id != null ? await storage.updateLearnVideo(existing.id, userId, patch) : null;
  if (!video) {
    const created = await storage.createLearnVideo({ title: entry.title, topic: entry.topic }, userId);
    if (!created.id) throw new Error(`Failed to create ${entry.title}`);
    video = await storage.updateLearnVideo(created.id, userId, patch);
  }
  if (!video?.id) throw new Error(`Failed to save ${entry.title}`);
  const approved = await storage.updateLearnVideo(video.id, userId, { status: "approved" });
  if (!approved) throw new Error(`Failed to approve ${entry.title}`);
  const signed = signOffLearnVideoCompliance(approved, false);
  const cleared = await storage.updateLearnVideo(video.id, userId, { compliance: signed.compliance });
  if (!cleared) throw new Error(`Failed to clear ${entry.title}`);
  const gate = canPublishLearn({
    status: cleared.status,
    compliance: cleared.compliance,
    autoPublish: cleared.autoPublish !== false,
    kind: "video",
    title: cleared.title,
    excerpt: entry.excerpt,
    videoUrl: cleared.videoUrl,
    description: cleared.description,
    transcript: cleared.transcript,
  });
  if (!gate.ok) throw new Error(`${entry.slug}: ${gate.error}`);
  const snapshot = snapshotLearnPiece({
    kind: "video",
    slug: entry.slug,
    title: cleared.title,
    excerpt: entry.excerpt,
    videoUrl: cleared.videoUrl,
    transcript: cleared.transcript,
    durationLabel: entry.durationLabel,
    pathPosition: entry.pathPosition,
    source: { desk: "learn-video", id: cleared.id! },
    userId,
  });
  const live = await storage.upsertLiveLearnPiece(snapshot as LearnPiece);
  console.log(`Live #${live.id} /watch/${entry.slug} slot ${entry.pathPosition}`);
}

async function main() {
  const userId = await resolveUserId();
  for (const entry of PATH_VIDEOS) {
    await publishVideo(userId, entry);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
