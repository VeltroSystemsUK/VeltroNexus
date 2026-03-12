import { Router, type Request, type Response } from "express";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { whatsappService } from "../services/whatsappService";

const router = Router();

// GET /status — connection status + QR data URL
router.get("/status", isAuthenticated, (_req: Request, res: Response) => {
  res.json({
    status: whatsappService.status,
    jid: whatsappService.userJid,
    qr: whatsappService.qr,
  });
});

// POST /send — send a text message
router.post("/send", isAuthenticated, async (req: Request, res: Response) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message required" });
  }

  try {
    const id = await whatsappService.sendMessage(phone, message);
    res.json({ success: true, id });
  } catch (err: any) {
    if (err.message === "WhatsApp not connected") {
      return res.status(503).json({ error: err.message });
    }
    handleApiError(res, err, "whatsapp-send-error");
  }
});

// POST /notify — send a workflow notification (templated)
router.post("/notify", isAuthenticated, async (req: Request, res: Response) => {
  const { phone, event, data } = req.body;

  if (!phone || !event) {
    return res.status(400).json({ error: "phone and event required" });
  }

  try {
    const id = await whatsappService.sendNotification(phone, event, data || {});
    res.json({ success: true, id });
  } catch (err: any) {
    if (err.message === "WhatsApp not connected") {
      return res.status(503).json({ error: err.message });
    }
    handleApiError(res, err, "whatsapp-notify-error");
  }
});

// GET /messages/:phone — fetch recent messages for a contact
router.get("/messages/:phone", isAuthenticated, (req: Request, res: Response) => {
  try {
    const messages = whatsappService.getMessages(req.params.phone);
    res.json(messages);
  } catch (err) {
    handleApiError(res, err, "whatsapp-messages-error");
  }
});

// POST /logout — disconnect and clear auth
router.post("/logout", isAuthenticated, async (_req: Request, res: Response) => {
  try {
    await whatsappService.logout();
    res.json({ success: true });
  } catch (err) {
    handleApiError(res, err, "whatsapp-logout-error");
  }
});

export default router;
