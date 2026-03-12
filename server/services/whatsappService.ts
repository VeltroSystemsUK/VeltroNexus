import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  type WASocket,
} from "@whiskeysockets/baileys";
import { toDataURL } from "qrcode";
import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import path from "path";
import fs from "fs";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConnectionStatus = "disconnected" | "connecting" | "qr" | "connected";

export interface InboundMessage {
  id: string;
  jid: string;
  phone: string;
  from: string;
  text: string;
  timestamp: number | null | undefined;
  isGroup: boolean;
}

interface CachedMessage {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
}

interface NotifyTemplateData {
  dealName?: string;
  stage?: string;
  note?: string;
  documents?: string[];
  status?: string;
  message?: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const AUTH_DIR = path.resolve("wa_auth");
const MAX_CACHED_MESSAGES = 100;

// ─── Service ────────────────────────────────────────────────────────────────

class WhatsAppService {
  private sock: WASocket | null = null;
  private wss: WebSocketServer | null = null;
  private connectionStatus: ConnectionStatus = "disconnected";
  private qrDataUrl: string | null = null;

  /** Simple in-memory message cache keyed by phone number */
  private messageCache = new Map<string, CachedMessage[]>();

  /** Attach WebSocket server to the HTTP server on /ws/whatsapp path */
  attachWebSocket(httpServer: HttpServer): void {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: "/ws/whatsapp",
    });

    this.wss.on("connection", (ws: WebSocket) => {
      ws.send(
        JSON.stringify({
          type: "status",
          payload: {
            status: this.connectionStatus,
            jid: this.sock?.user?.id ?? null,
            qr: this.connectionStatus === "qr" ? this.qrDataUrl : null,
          },
          ts: Date.now(),
        })
      );
    });

    console.log("[WhatsApp] WebSocket server attached at /ws/whatsapp");
  }

  /** Start the WhatsApp connection (Baileys socket) */
  async start(): Promise<void> {
    await this.connect();
  }

  /** Shut down cleanly */
  async shutdown(): Promise<void> {
    this.wss?.close();
    this.sock?.end(undefined);
  }

  // ── Public accessors ──

  get status(): ConnectionStatus {
    return this.connectionStatus;
  }

  get userJid(): string | null {
    return this.sock?.user?.id ?? null;
  }

  get qr(): string | null {
    return this.connectionStatus === "qr" ? this.qrDataUrl : null;
  }

  // ── Messaging ──

  async sendMessage(phone: string, message: string): Promise<string | undefined> {
    if (!this.sock || this.connectionStatus !== "connected") {
      throw new Error("WhatsApp not connected");
    }

    const jid = phone.includes("@")
      ? phone
      : `${phone.replace(/\D/g, "")}@s.whatsapp.net`;

    const result = await this.sock.sendMessage(jid, { text: message });
    const msgId = result?.key?.id ?? undefined;

    // Cache outbound message
    const cleanPhone = phone.replace(/\D/g, "");
    this.cacheMessage(cleanPhone, {
      id: msgId || Date.now().toString(),
      fromMe: true,
      text: message,
      timestamp: Math.floor(Date.now() / 1000),
    });

    return msgId;
  }

  async sendNotification(
    phone: string,
    event: string,
    data: NotifyTemplateData
  ): Promise<string | undefined> {
    const templates: Record<string, (d: NotifyTemplateData) => string> = {
      deal_stage_change: (d) =>
        `*Veltro Update*\nDeal: *${d.dealName}* has moved to *${d.stage}*.\n${d.note || ""}`,
      document_request: (d) =>
        `*Document Request*\nPlease provide: *${d.documents?.join(", ")}* for deal *${d.dealName}*.`,
      approval: (d) =>
        `*Approval Update*\nDeal *${d.dealName}* — Status: *${d.status}*.\n${d.message || ""}`,
      custom: (d) => d.message || "",
    };

    const templateFn = templates[event] || templates.custom;
    const message = templateFn(data);
    return this.sendMessage(phone, message);
  }

  getMessages(phone: string): CachedMessage[] {
    const cleanPhone = phone.replace(/\D/g, "");
    return this.messageCache.get(cleanPhone)?.slice(-50) || [];
  }

  async logout(): Promise<void> {
    await this.sock?.logout();
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    this.connectionStatus = "disconnected";
    this.qrDataUrl = null;
    this.broadcast("status", { status: "disconnected" });
  }

  // ── Internal ──

  private cacheMessage(phone: string, msg: CachedMessage): void {
    if (!this.messageCache.has(phone)) {
      this.messageCache.set(phone, []);
    }
    const cache = this.messageCache.get(phone)!;
    cache.push(msg);
    if (cache.length > MAX_CACHED_MESSAGES) {
      cache.splice(0, cache.length - MAX_CACHED_MESSAGES);
    }
  }

  private broadcast(type: string, payload: Record<string, unknown>): void {
    if (!this.wss) return;
    const msg = JSON.stringify({ type, payload, ts: Date.now() });
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  private async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      browser: ["Veltro", "Chrome", "1.0.0"],
      syncFullHistory: false,
    });

    // Connection updates
    this.sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrDataUrl = await toDataURL(qr);
        this.connectionStatus = "qr";
        this.broadcast("qr", { qr: this.qrDataUrl });
      }

      if (connection === "open") {
        this.connectionStatus = "connected";
        this.qrDataUrl = null;
        this.broadcast("status", {
          status: "connected",
          jid: this.sock?.user?.id,
        });
        console.log("[WhatsApp] Connected:", this.sock?.user?.id);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.connectionStatus = shouldReconnect ? "connecting" : "disconnected";
        this.broadcast("status", { status: this.connectionStatus });
        console.log(
          `[WhatsApp] Connection closed. Reconnect: ${shouldReconnect}`
        );

        if (shouldReconnect) {
          setTimeout(() => this.connect(), 3000);
        } else {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          this.qrDataUrl = null;
        }
      }
    });

    // Save credentials
    this.sock.ev.on("creds.update", saveCreds);

    // Inbound messages
    this.sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue;

        const jid = msg.key.remoteJid!;
        const phone = jid
          .replace("@s.whatsapp.net", "")
          .replace("@g.us", "");
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          "[media]";

        const ts = typeof msg.messageTimestamp === "number"
          ? msg.messageTimestamp
          : Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000);

        // Cache inbound message
        this.cacheMessage(phone, {
          id: msg.key.id!,
          fromMe: false,
          text,
          timestamp: ts,
        });

        const inbound: InboundMessage = {
          id: msg.key.id!,
          jid,
          phone,
          from: msg.pushName || phone,
          text,
          timestamp: ts,
          isGroup: jid.endsWith("@g.us"),
        };

        console.log("[WhatsApp] Inbound:", JSON.stringify(inbound));
        this.broadcast("message", inbound as unknown as Record<string, unknown>);
      }
    });

    // Message status updates (sent/delivered/read)
    this.sock.ev.on("messages.update", (updates) => {
      for (const { key, update } of updates) {
        if (update.status !== undefined) {
          this.broadcast("message_status", {
            id: key.id,
            status: update.status,
          });
        }
      }
    });
  }
}

export const whatsappService = new WhatsAppService();
