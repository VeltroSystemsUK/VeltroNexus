import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import passport from "passport";

const router = Router();

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.settings.basic",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
    accessType: "offline",
    prompt: "consent",
  })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/settings?error=google_auth_failed" }),
  (req, res) => {
    res.redirect("/settings?success=google_connected");
  }
);

router.post("/auth/google/disconnect", isAuthenticated, async (req, res) => {
  try {
    await storage.updateUser((req as any).user.id, {
      googleConnected: false,
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to disconnect Google account" });
  }
});

router.post("/google/gmail/draft", isAuthenticated, async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const { sendEmail } = await import("../services/googleServices");
    await sendEmail((req as any).user, to, subject, body);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Gmail Draft Error:", err);
    res.status(500).json({ error: err.message || "Failed to draft email" });
  }
});

router.post("/google/docs/create", isAuthenticated, async (req, res) => {
  try {
    const { title, content } = req.body;
    const { createGoogleDoc } = await import("../services/googleServices");
    const result = await createGoogleDoc((req as any).user, title, content);
    res.json(result);
  } catch (err: any) {
    console.error("Google Doc Creation Error:", err);
    res.status(500).json({ error: err.message || "Failed to create Google Doc" });
  }
});

export default router;
