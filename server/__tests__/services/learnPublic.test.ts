import express from "express";
import http from "http";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../storage", () => ({
  storage: {
    listLiveLearnPieces: vi.fn(),
    getLiveLearnPieceBySlug: vi.fn(),
    getLearnPiece: vi.fn(),
    incrementLearnHelped: vi.fn(),
    incrementLearnNotHelped: vi.fn(),
    insertLearnBotLog: vi.fn(),
    listLiveNewsComments: vi.fn(),
    listNewsComments: vi.fn(),
    insertNewsComment: vi.fn(),
    getMarketingContactByEmail: vi.fn(),
    createOrUpdateMarketingContact: vi.fn(),
  },
}));

import { storage } from "../../storage";
import learnPublicRouter from "../../routes/learnPublic";

const mocked = storage as unknown as {
  listLiveLearnPieces: ReturnType<typeof vi.fn>;
  getLiveLearnPieceBySlug: ReturnType<typeof vi.fn>;
  getLearnPiece: ReturnType<typeof vi.fn>;
  incrementLearnHelped: ReturnType<typeof vi.fn>;
  incrementLearnNotHelped: ReturnType<typeof vi.fn>;
  insertLearnBotLog: ReturnType<typeof vi.fn>;
  listLiveNewsComments: ReturnType<typeof vi.fn>;
  listNewsComments: ReturnType<typeof vi.fn>;
  insertNewsComment: ReturnType<typeof vi.fn>;
  getMarketingContactByEmail: ReturnType<typeof vi.fn>;
  createOrUpdateMarketingContact: ReturnType<typeof vi.fn>;
};

const piece = {
  id: 1,
  slug: "payday-lenders",
  kind: "video",
  title: "Payday",
  excerpt: "Trap",
  heroImageUrl: null,
  body: "",
  videoUrl: "/uploads/learn/videos/StrataFinance_PaydayLenders.mp4",
  transcript: "We do not lend.",
  pathPosition: 1,
  durationLabel: "1 min",
  thisHelped: 4,
  source: { desk: "learn-video", id: 9 },
  live: true,
  publishedAt: "2026-09-03T00:00:00.000Z",
  unpublishedAt: null,
  userId: "u1",
};

function app() {
  const e = express();
  e.use(express.json());
  e.use("/api", learnPublicRouter);
  return e;
}

async function request(method: string, path: string, host: string, cookie = "", payloadBody?: unknown) {
  const server = app();
  const s = http.createServer(server);
  await new Promise<void>((resolve) => s.listen(0, resolve));
  try {
    const port = (s.address() as { port: number }).port;
    const payload = method === "POST" ? JSON.stringify(payloadBody ?? {}) : "";
    const headers: http.OutgoingHttpHeaders = { Host: host };
    if (cookie) headers.Cookie = cookie;
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    const { status, body, headers: resHeaders } = await new Promise<{
      status: number;
      body: any;
      headers: Record<string, string>;
    }>((resolve, reject) => {
      const req = http.request(
        { hostname: "127.0.0.1", port, path, method, headers },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            let parsed: any = {};
            try {
              parsed = JSON.parse(raw);
            } catch {
              parsed = {};
            }
            const hdrs: Record<string, string> = {};
            for (const [key, value] of Object.entries(res.headers)) {
              if (typeof value === "string") hdrs[key] = value;
              else if (Array.isArray(value)) hdrs[key] = value.join(", ");
            }
            resolve({ status: res.statusCode || 0, body: parsed, headers: hdrs });
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
    return { status, body, headers: resHeaders };
  } finally {
    await new Promise<void>((resolve) => s.close(() => resolve()));
  }
}

async function get(path: string, host: string, cookie = "") {
  return request("GET", path, host, cookie);
}

async function post(path: string, host: string, cookie = "", body?: unknown) {
  return request("POST", path, host, cookie, body);
}

describe("learn public API host split", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.listLiveLearnPieces.mockResolvedValue([piece]);
    mocked.getLiveLearnPieceBySlug.mockResolvedValue(piece);
    mocked.getLearnPiece.mockResolvedValue(piece);
    mocked.incrementLearnHelped.mockResolvedValue({ ...piece, thisHelped: 5 });
    mocked.incrementLearnNotHelped.mockResolvedValue({ ...piece, thisNotHelped: 3 });
    mocked.insertLearnBotLog.mockResolvedValue({ id: 1 });
    mocked.listLiveNewsComments.mockResolvedValue([]);
    mocked.listNewsComments.mockResolvedValue([]);
  });

  it("404s home on leads host and returns path on learn host", async () => {
    const denied = await get("/api/learn/home", "leads.stratanexus.co.uk");
    expect(denied.status).toBe(404);
    const ok = await get("/api/learn/home", "learn.stratanexus.co.uk");
    expect(ok.status).toBe(200);
    expect(ok.body.path[0].slug).toBe("payday-lenders");
    expect(ok.body.path[0].source).toBeUndefined();
  });

  it("404s unknown slug", async () => {
    mocked.getLiveLearnPieceBySlug.mockResolvedValue(undefined);
    const res = await get("/api/learn/piece/video/nope", "learn.stratanexus.co.uk");
    expect(res.status).toBe(404);
  });

  it("increments helped once per cookie", async () => {
    const first = await post("/api/learn/piece/1/helped", "learn.stratanexus.co.uk");
    expect(first.status).toBe(200);
    expect(first.body.thisHelped).toBe(5);
    expect(mocked.incrementLearnHelped).toHaveBeenCalledTimes(1);
    expect(mocked.incrementLearnHelped).toHaveBeenCalledWith(1);

    mocked.incrementLearnHelped.mockClear();
    const again = await post("/api/learn/piece/1/helped", "learn.stratanexus.co.uk", "learn_helped=1");
    expect(again.status).toBe(200);
    expect(again.body.thisHelped).toBe(4);
    expect(mocked.incrementLearnHelped).not.toHaveBeenCalled();
  });

  it("thumbs up and down a news post, each once per cookie", async () => {
    mocked.getLearnPiece.mockResolvedValue({ ...piece, kind: "news" });

    const up = await post("/api/learn/news/1/like", "learn.stratanexus.co.uk");
    expect(up.status).toBe(200);
    expect(up.body.likes).toBe(5);
    expect(mocked.incrementLearnHelped).toHaveBeenCalledTimes(1);

    const upAgain = await post("/api/learn/news/1/like", "learn.stratanexus.co.uk", "learn_news_liked=1");
    expect(upAgain.body.likes).toBe(4);
    expect(mocked.incrementLearnHelped).toHaveBeenCalledTimes(1);

    const down = await post("/api/learn/news/1/dislike", "learn.stratanexus.co.uk");
    expect(down.status).toBe(200);
    expect(down.body.dislikes).toBe(3);
    expect(mocked.incrementLearnNotHelped).toHaveBeenCalledTimes(1);

    const downAgain = await post("/api/learn/news/1/dislike", "learn.stratanexus.co.uk", "learn_news_disliked=1");
    expect(downAgain.body.dislikes).toBe(0);
    expect(mocked.incrementLearnNotHelped).toHaveBeenCalledTimes(1);
  });

  it("404s like/dislike for a non-news piece", async () => {
    const up = await post("/api/learn/news/1/like", "learn.stratanexus.co.uk");
    expect(up.status).toBe(404);
    const down = await post("/api/learn/news/1/dislike", "learn.stratanexus.co.uk");
    expect(down.status).toBe(404);
  });

  it("POST ask hands off eligibility without a model", async () => {
    const res = await post("/api/learn/ask", "learn.stratanexus.co.uk", "", {
      question: "Can you do my deal at 9%?",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ kind: "handoff" });
    expect(mocked.listLiveLearnPieces).toHaveBeenCalled();
    expect(mocked.insertLearnBotLog).toHaveBeenCalledWith({
      slug: null,
      question: "Can you do my deal at 9%?",
      handoff: true,
      retrievedIds: [],
    });
  });

  it("rejects a news comment that contains a URL", async () => {
    mocked.getLearnPiece.mockResolvedValue({ ...piece, kind: "news", live: true });
    const res = await post("/api/learn/news/1/comments", "learn.stratanexus.co.uk", "", {
      name: "Jordan Hale",
      email: "jordan@joinery.co.uk",
      body: "See https://claims.example for a refund on the facility.",
    });
    expect(res.status).toBe(400);
    expect(mocked.insertNewsComment).not.toHaveBeenCalled();
  });
});
