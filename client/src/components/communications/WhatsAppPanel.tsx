import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Bell,
  Send,
  ExternalLink,
  LogOut,
  Loader2,
  FileText,
  Paperclip,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WA_URL = import.meta.env.VITE_WA_SERVICE_URL || "";

// ─── Types ──────────────────────────────────────────────────────────────────

type ConnectionStatus = "disconnected" | "connecting" | "qr" | "connected";

interface Message {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
}

interface WhatsAppPanelProps {
  contactPhone: string;
  contactName?: string;
  dealName?: string;
}

interface WsPayload {
  type: "qr" | "status" | "message" | "message_status";
  payload: Record<string, any>;
  ts: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatTime = (ts: number | undefined): string => {
  if (!ts) return "";
  return new Date(Number(ts) * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  disconnected: { label: "Disconnected", variant: "destructive" },
  connecting: { label: "Connecting...", variant: "secondary" },
  qr: { label: "Scan QR", variant: "secondary" },
  connected: { label: "Connected", variant: "default" },
};

// ─── Notify Button ──────────────────────────────────────────────────────────

function NotifyButton({
  label,
  icon: Icon,
  event,
  data,
  phone,
  disabled,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  event: string;
  data: Record<string, any>;
  phone: string;
  disabled: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const send = async () => {
    setSending(true);
    try {
      await fetch(`${WA_URL}/api/wa/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, event, data }),
      });
      setSent(true);
      toast({ title: "Notification sent" });
      setTimeout(() => setSent(false), 3000);
    } catch {
      toast({ title: "Failed to send", variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <Button
      variant={sent ? "default" : "outline"}
      className="justify-start gap-2 h-auto py-3"
      onClick={send}
      disabled={disabled || sending}
    >
      {sending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : sent ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {sent ? "Sent!" : label}
    </Button>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────

export default function WhatsAppPanel({
  contactPhone,
  contactName = "Contact",
  dealName = "",
}: WhatsAppPanelProps) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [jid, setJid] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  const isConnected = status === "connected";

  // Fetch message history
  const fetchMessages = useCallback(async () => {
    if (!contactPhone) return;
    try {
      const res = await fetch(`${WA_URL}/api/wa/messages/${contactPhone}`);
      const data = await res.json();
      setMessages(data);
    } catch {
      // silent
    }
  }, [contactPhone]);

  // WebSocket connection
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      const wsBase = WA_URL
        ? WA_URL.replace(/^http/, "ws")
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
      const ws = new WebSocket(`${wsBase}/ws/whatsapp`);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        const { type, payload } = JSON.parse(e.data) as WsPayload;

        if (type === "status") {
          setStatus(payload.status as ConnectionStatus);
          setJid(payload.jid as string | null);
          if (payload.qr) setQr(payload.qr as string);
          if (payload.status === "connected") {
            setQr(null);
            fetchMessages();
          }
        }
        if (type === "qr") {
          setQr(payload.qr as string);
          setStatus("qr");
          setShowQR(true);
        }
        if (type === "message") {
          const cleanPhone = contactPhone.replace(/\D/g, "");
          if (payload.phone === cleanPhone) {
            setMessages((prev) => [
              ...prev,
              {
                id: payload.id as string,
                fromMe: false,
                text: payload.text as string,
                timestamp: payload.timestamp as number,
              },
            ]);
          }
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, [contactPhone, fetchMessages]);

  // Fetch initial status
  useEffect(() => {
    fetch(`${WA_URL}/api/wa/status`)
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.status);
        setJid(d.jid);
        if (d.qr) setQr(d.qr);
        if (d.status === "connected") fetchMessages();
      })
      .catch(() => {});
  }, [fetchMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || !contactPhone || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");

    // Optimistic update
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        fromMe: true,
        text,
        timestamp: Math.floor(Date.now() / 1000),
      },
    ]);

    try {
      await fetch(`${WA_URL}/api/wa/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: contactPhone, message: text }),
      });
    } catch {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;

  return (
    <Card className="flex flex-col h-[580px] max-w-[480px] w-full">
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 space-y-0 border-b">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{contactName}</CardTitle>
            <p className="text-xs text-muted-foreground">{contactPhone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          {!isConnected && (
            <Button size="sm" variant="outline" onClick={() => setShowQR(true)}>
              Connect
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="chat" className="flex-1 gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="notify" className="flex-1 gap-1">
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex flex-col flex-1 min-h-0 mt-0">
          <ScrollArea className="flex-1 p-3">
            {!isConnected ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground gap-3">
                <p>Connect WhatsApp to start messaging</p>
                <Button onClick={() => setShowQR(true)}>Connect WhatsApp</Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                <p>No messages yet with {contactName}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                        msg.fromMe
                          ? "bg-green-900/30 rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      }`}
                    >
                      <p className="leading-relaxed">{msg.text}</p>
                      <span className="text-[10px] text-muted-foreground float-right ml-2 mt-0.5">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Composer */}
          <div className="flex gap-2 p-3 border-t items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? `Message ${contactName}...` : "Connect first"}
              disabled={!isConnected}
              rows={2}
              className="resize-none text-sm"
            />
            <Button
              size="icon"
              className="h-9 w-9 flex-shrink-0 bg-green-600 hover:bg-green-700"
              onClick={sendMessage}
              disabled={!input.trim() || !isConnected || sending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>

        {/* Notify Tab */}
        <TabsContent value="notify" className="flex-1 mt-0">
          <ScrollArea className="h-full p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Send pre-built workflow notifications to{" "}
              <strong>{contactName}</strong>
              {dealName ? ` about ${dealName}` : ""}.
            </p>
            <div className="flex flex-col gap-2">
              <NotifyButton
                label="Deal Stage Update"
                icon={FileText}
                event="deal_stage_change"
                data={{
                  dealName: dealName || "your application",
                  stage: "Credit Review",
                  note: "We will be in touch within 24 hours.",
                }}
                phone={contactPhone}
                disabled={!isConnected}
              />
              <NotifyButton
                label="Request Documents"
                icon={Paperclip}
                event="document_request"
                data={{
                  dealName: dealName || "your application",
                  documents: ["Bank Statements (3 months)", "Management Accounts"],
                }}
                phone={contactPhone}
                disabled={!isConnected}
              />
              <NotifyButton
                label="Send Approval"
                icon={CheckCircle2}
                event="approval"
                data={{
                  dealName: dealName || "your application",
                  status: "Approved in Principle",
                  message: "Our team will contact you to discuss next steps.",
                }}
                phone={contactPhone}
                disabled={!isConnected}
              />
            </div>
            {!isConnected && (
              <p className="text-sm text-yellow-500 mt-4">
                Connect WhatsApp to send notifications
              </p>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="flex justify-between items-center px-4 py-2 border-t text-xs">
        <a
          href={`https://wa.me/${contactPhone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className="text-green-500 hover:underline flex items-center gap-1"
        >
          Open in WhatsApp <ExternalLink className="h-3 w-3" />
        </a>
        {jid && (
          <span className="text-muted-foreground">
            Linked: {jid?.split(":")[0]}
          </span>
        )}
      </div>

      {/* QR Modal */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Connect WhatsApp</DialogTitle>
            <DialogDescription>
              Open WhatsApp on your phone, go to Linked Devices, and scan this QR
              code.
            </DialogDescription>
          </DialogHeader>
          {qr ? (
            <img
              src={qr}
              alt="WhatsApp QR Code"
              className="w-full rounded-lg bg-white p-2"
            />
          ) : (
            <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              {status === "connected" ? "Already connected!" : "Generating QR..."}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            This links your personal WhatsApp to Veltro. Your phone must stay
            online.
          </p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
