import express from "express";
import http from "http";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    getEditorialPiece: vi.fn(),
    updateEditorialPiece: vi.fn(),
    listEditorialPieces: vi.fn(),
    getLearnVideo: vi.fn(),
    listLearnVideos: vi.fn(),
    createLearnVideo: vi.fn(),
    updateLearnVideo: vi.fn(),
    deleteLearnVideo: vi.fn(),
    listLearnPieces: vi.fn(),
    getLearnPiece: vi.fn(),
    upsertLiveLearnPiece: vi.fn(),
    unpublishLearnPiece: vi.fn(),
    listLearnBotLogs: vi.fn(),
  },
}));

import { storage } from "../../storage";
import editorialRouter from "../../routes/editorial";
import learnDeskRouter from "../../routes/learnDesk";

const mocked = storage as unknown as {
  getEditorialPiece: ReturnType<typeof vi.fn>;
  updateEditorialPiece: ReturnType<typeof vi.fn>;
  getLearnVideo: ReturnType<typeof vi.fn>;
  updateLearnVideo: ReturnType<typeof vi.fn>;
  getLearnPiece: ReturnType<typeof vi.fn>;
  upsertLiveLearnPiece: ReturnType<typeof vi.fn>;
  unpublishLearnPiece: ReturnType<typeof vi.fn>;
};

const PACKAGER = "Strata packages files. We do not lend.";
const STORED_MP4 = "/uploads/learn/videos/StrataFinance_PaydayLenders.mp4";

const clearedBlog = {
  id: 1,
  userId: "u1",
  type: "blog" as const,
  title: "Time to Pay is not a write-off",
  topic: "HMRC Time to Pay",
  body: PACKAGER,
  notes: [],
  engine: null,
  status: "approved" as const,
  compliance: "cleared" as const,
  autoPublish: false as const,
  heroImageUrl: null,
};

const draftVideo = {
  id: 9,
  userId: "u1",
  title: "Payday",
  topic: "stacked debt",
  description: PACKAGER,
  transcript: PACKAGER,
  videoUrl: STORED_MP4,
  excerpt: "Trap",
  heroImageUrl: null,
  durationLabel: "1 min",
  pathPosition: 1,
  notes: [],
  engine: null,
  status: "draft" as const,
  compliance: "pending" as const,
  autoPublish: false as const,
};

function deskApp() {
  const e = express();
  e.use(express.json());
  e.use((req: any, _res, next) => {
    req.user = { id: "u1" };
    req.isAuthenticated = () => true;
    next();
  });
  e.use("/api", editorialRouter);
  e.use("/api", learnDeskRouter);
  return e;
}

async function request(method: string, path: string, body?: unknown) {
  const server = deskApp();
  const s = http.createServer(server);
  await new Promise<void>((resolve) => s.listen(0, resolve));
  try {
    const port = (s.address() as { port: number }).port;
    const payload = body === undefined ? "" : JSON.stringify(body);
    const headers: http.OutgoingHttpHeaders = {};
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    const { status, body: parsed } = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = http.request({ hostname: "127.0.0.1", port, path, method, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let value: any = {};
          try {
            value = JSON.parse(raw);
          } catch {
            value = raw;
          }
          resolve({ status: res.statusCode || 0, body: value });
        });
      });
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
    return { status, body: parsed };
  } finally {
    await new Promise<void>((resolve) => s.close(() => resolve()));
  }
}

describe("learn desk publish API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.getEditorialPiece.mockResolvedValue(clearedBlog);
    mocked.upsertLiveLearnPiece.mockImplementation(async (snapshot: any) => ({ ...snapshot, id: 42 }));
    mocked.getLearnVideo.mockResolvedValue(draftVideo);
    mocked.getLearnPiece.mockResolvedValue({
      id: 7,
      userId: "u1",
      live: true,
      slug: "payday-lenders",
      kind: "video",
    });
    mocked.unpublishLearnPiece.mockResolvedValue({
      id: 7,
      userId: "u1",
      live: false,
      unpublishedAt: "2026-09-03T12:00:00.000Z",
    });
  });

  it("returns 400 when video status is draft", async () => {
    const res = await request("POST", "/api/learn-desk/videos/9/publish", {});
    expect(res.status).toBe(400);
    expect(mocked.upsertLiveLearnPiece).not.toHaveBeenCalled();
  });

  it("refuses press release publish-learn with 400", async () => {
    mocked.getEditorialPiece.mockResolvedValue({ ...clearedBlog, type: "press_release" });
    const res = await request("POST", "/api/editorial/1/publish-learn", { excerpt: "PR" });
    expect(res.status).toBe(400);
    expect(mocked.upsertLiveLearnPiece).not.toHaveBeenCalled();
  });

  it("refuses Grok CDN videoUrl on publish with 400", async () => {
    mocked.getLearnVideo.mockResolvedValue({
      ...draftVideo,
      status: "approved",
      compliance: "cleared",
      videoUrl: "https://assets.grok.com/users/x/generated/y/StrataFinance_Promo.mp4",
    });
    const res = await request("POST", "/api/learn-desk/videos/9/publish", {});
    expect(res.status).toBe(400);
    expect(mocked.upsertLiveLearnPiece).not.toHaveBeenCalled();
  });

  it("publishes a cleared video with a live snapshot and stored mp4 path", async () => {
    mocked.getLearnVideo.mockResolvedValue({
      ...draftVideo,
      status: "approved",
      compliance: "cleared",
    });
    const res = await request("POST", "/api/learn-desk/videos/9/publish", {
      slug: "payday-lenders",
      excerpt: "Trap",
      pathPosition: 1,
    });
    expect(res.status).toBe(200);
    expect(mocked.upsertLiveLearnPiece).toHaveBeenCalledTimes(1);
    const snap = mocked.upsertLiveLearnPiece.mock.calls[0][0];
    expect(snap.live).toBe(true);
    expect(snap.kind).toBe("video");
    expect(snap.videoUrl).toBe(STORED_MP4);
    expect(snap.source).toEqual({ desk: "learn-video", id: 9 });
    expect(snap.body).toBe("");
  });

  it("unpublish sets live false", async () => {
    const res = await request("POST", "/api/learn-desk/pieces/7/unpublish");
    expect(res.status).toBe(200);
    expect(mocked.unpublishLearnPiece).toHaveBeenCalledWith(7);
    expect(res.body.live).toBe(false);
  });

  it("publishes a cleared blog via editorial publish-learn", async () => {
    const res = await request("POST", "/api/editorial/1/publish-learn", {
      slug: "time-to-pay",
      excerpt: "HMRC instalments, not a loan.",
      pathPosition: 3,
    });
    expect(res.status).toBe(200);
    expect(mocked.upsertLiveLearnPiece).toHaveBeenCalledTimes(1);
    const snap = mocked.upsertLiveLearnPiece.mock.calls[0][0];
    expect(snap.live).toBe(true);
    expect(snap.kind).toBe("article");
    expect(snap.body).toBe(PACKAGER);
    expect(snap.source).toEqual({ desk: "editorial", id: 1 });
    expect(snap.videoUrl).toBe("");
  });

  it("generate without notes returns 400", async () => {
    const res = await request("POST", "/api/learn-desk/videos/9/generate", {});
    expect(res.status).toBe(400);
    expect(String(res.body.error || res.body)).toMatch(/scan/i);
  });
});
