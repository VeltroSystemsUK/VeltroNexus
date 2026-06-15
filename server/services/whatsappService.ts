// Stub implementation of WhatsAppService to prevent compilation errors from missing external packages

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

class WhatsAppService {
  public status: ConnectionStatus = "disconnected";
  public userJid: string | null = null;
  public qr: string | null = null;

  constructor() {}

  public async sendMessage(phone: string, message: string): Promise<string> {
    throw new Error("WhatsApp integration is disabled in local mode.");
  }

  public async sendNotification(phone: string, event: string, data: any): Promise<string> {
    throw new Error("WhatsApp integration is disabled in local mode.");
  }

  public getMessages(phone: string): any[] {
    return [];
  }

  public async logout(): Promise<void> {
    this.status = "disconnected";
    this.userJid = null;
    this.qr = null;
  }
}

export const whatsappService = new WhatsAppService();
