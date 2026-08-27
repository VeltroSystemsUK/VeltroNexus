import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { handleApiError } from "../utils/errorHandler";
import {
  getPublicPack,
  isAllowedPackFile,
  isPackCategory,
  saveFundingReason,
  savePackFiles,
} from "../services/packUpload";

const uploadDir = path.join(process.cwd(), "uploads", "deal-packs");

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const token = String(req.params.token || "unknown").replace(/[^a-zA-Z0-9_-]/g, "");
      const dest = path.join(uploadDir, token || "unknown");
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10);
      const base = path
        .basename(file.originalname, ext)
        .replace(/[^\w.\- ()]/g, "_")
        .slice(0, 80);
      cb(null, `${Date.now()}-${base || "document"}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedPackFile(file.originalname, file.mimetype)) {
      cb(new Error("Please upload PDF, image, spreadsheet, or Word files"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.use("/api/pack", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

router.get("/api/pack/:token", async (req, res) => {
  try {
    const pack = await getPublicPack(String(req.params.token || ""));
    if (!pack) return res.status(404).json({ error: "This upload link is not valid." });
    res.json(pack);
  } catch (error) {
    handleApiError(res, error, "api-error");
  }
});

router.post("/api/pack/:token/files", (req, res) => {
  upload.array("files", 12)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    try {
      const category = String(req.body?.category || "");
      if (!isPackCategory(category)) {
        return res.status(400).json({ error: "Choose a document type from the pack list" });
      }
      const files = (req.files as Express.Multer.File[]) || [];
      const pack = await savePackFiles(String(req.params.token || ""), category, files);
      res.json(pack);
    } catch (error: any) {
      const message = String(error?.message || "Upload failed");
      if (/not valid|No files|Please upload/i.test(message)) {
        return res.status(400).json({ error: message });
      }
      handleApiError(res, error, "api-error");
    }
  });
});

router.post("/api/pack/:token/reason", async (req, res) => {
  try {
    const pack = await saveFundingReason(String(req.params.token || ""), String(req.body?.fundingReason || ""));
    res.json(pack);
  } catch (error: any) {
    const message = String(error?.message || "Save failed");
    if (/not valid|Please say/i.test(message)) {
      return res.status(400).json({ error: message });
    }
    handleApiError(res, error, "api-error");
  }
});

export default router;
