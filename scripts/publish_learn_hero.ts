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
const VIDEO_FILE = "strata-scene-ALL.mp4";
const VIDEO_PATH = path.join(ROOT, "uploads", "learn", "videos", VIDEO_FILE);
const VIDEO_URL = `${LEARN_VIDEO_PUBLIC_PREFIX}${VIDEO_FILE}`;
const POSTER_URL = `${LEARN_VIDEO_PUBLIC_PREFIX}strata-scene-ALL.jpg`;

const TITLE = "Strata Finance — stacked short-term debt";
const TOPIC = "promo";
const SLUG = "promo";
const DURATION = "2 min 52 sec";
const EXCERPT = "Your business is drowning. Loan two does not pay off loan one.";
const DESCRIPTION =
  "Strata packages UK SME distress-refinance files. We do not lend. A short film on stacked short-term debt — loan two sits on top of loan one.";

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

async function main() {
  if (!existsSync(VIDEO_PATH)) {
    console.error(`Missing video file: ${VIDEO_PATH}`);
    process.exit(1);
  }

  const userId = await resolveUserId();
  const existing = await storage.listLearnVideos(userId);
  const match =
    existing.find((row) => row.videoUrl === VIDEO_URL) ||
    existing.find((row) => /promo/i.test(row.topic) && row.pathPosition == null) ||
    existing.find((row) => /promo/i.test(row.title) && row.pathPosition == null);

  const patch = {
    title: TITLE,
    topic: TOPIC,
    description: DESCRIPTION,
    transcript: DESCRIPTION,
    videoUrl: VIDEO_URL,
    excerpt: EXCERPT,
    durationLabel: DURATION,
    pathPosition: null as number | null,
    heroImageUrl: POSTER_URL,
    autoPublish: false as const,
  };

  let video = match?.id != null ? await storage.updateLearnVideo(match.id, userId, patch) : null;
  if (!video) {
    const created = await storage.createLearnVideo({ title: TITLE, topic: TOPIC }, userId);
    if (!created.id) throw new Error("Failed to create learn video draft");
    video = await storage.updateLearnVideo(created.id, userId, patch);
  }
  if (!video?.id) throw new Error("Failed to save learn video draft");

  const approved = await storage.updateLearnVideo(video.id, userId, { status: "approved" });
  if (!approved) throw new Error("Failed to approve learn video");
  const signed = signOffLearnVideoCompliance(approved, false);
  const cleared = await storage.updateLearnVideo(video.id, userId, { compliance: signed.compliance });
  if (!cleared) throw new Error("Failed to clear compliance");

  const gate = canPublishLearn({
    status: cleared.status,
    compliance: cleared.compliance,
    autoPublish: cleared.autoPublish !== false,
    kind: "video",
    title: cleared.title,
    excerpt: EXCERPT,
    videoUrl: cleared.videoUrl,
    description: cleared.description,
    transcript: cleared.transcript,
  });
  if (!gate.ok) {
    console.error(gate.error);
    process.exit(1);
  }

  const snapshot = snapshotLearnPiece({
    kind: "video",
    slug: SLUG,
    title: cleared.title,
    excerpt: EXCERPT,
    videoUrl: cleared.videoUrl,
    transcript: cleared.transcript,
    heroImageUrl: cleared.heroImageUrl || POSTER_URL,
    durationLabel: DURATION,
    pathPosition: null,
    source: { desk: "learn-video", id: cleared.id! },
    userId,
  });
  const live = await storage.upsertLiveLearnPiece(snapshot as LearnPiece);
  console.log(`Published live #${live.id} slug=${live.slug} url=${cleared.videoUrl}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
