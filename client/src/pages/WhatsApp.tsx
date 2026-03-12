import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  Wifi,
  WifiOff,
  QrCode,
  LogOut,
  Check,
  Loader2,
  X,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/context/LayoutContext";
import WhatsAppPanel from "@/components/communications/WhatsAppPanel";

const WA_URL = import.meta.env.VITE_WA_SERVICE_URL || "";

type ConnectionStatus = "disconnected" | "connecting" | "qr" | "connected";

export default function WhatsApp() {
  usePageTitle("WhatsApp", "Send messages and notifications via WhatsApp");

  const { toast } = useToast();
  const [showQR, setShowQR] = useState(false);
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [activeChat, setActiveChat] = useState<{ phone: string; name: string } | null>(null);

  // Fetch WhatsApp connection status
  const { data: waStatus, refetch } = useQuery<{
    status: ConnectionStatus;
    jid: string | null;
    qr: string | null;
  }>({
    queryKey: ["wa-status"],
    queryFn: async () => {
      const res = await fetch(`${WA_URL}/api/wa/status`);
      if (!res.ok) throw new Error("Failed to fetch WA status");
      return res.json();
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "qr" || status === "connecting" ? 3000 : 10000;
    },
  });

  const status = waStatus?.status || "disconnected";
  const isConnected = status === "connected";

  const startChat = () => {
    if (!phone.trim()) return;
    setActiveChat({
      phone: phone.replace(/\D/g, ""),
      name: contactName.trim() || phone.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isConnected ? "bg-green-500/20" : "bg-muted"}`}>
                {isConnected ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-base">WhatsApp Connection</CardTitle>
                <CardDescription>
                  {isConnected
                    ? `Linked: ${waStatus?.jid?.split(":")[0]}`
                    : status === "qr"
                    ? "Scan QR code to connect"
                    : status === "connecting"
                    ? "Connecting..."
                    : "Not connected"}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? "Connected" : status === "qr" ? "Awaiting QR Scan" : status === "connecting" ? "Connecting" : "Disconnected"}
              </Badge>
              {isConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (confirm("Disconnect WhatsApp?")) {
                      await fetch(`${WA_URL}/api/wa/logout`, { method: "POST" });
                      refetch();
                      toast({ title: "WhatsApp disconnected" });
                    }
                  }}
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setShowQR(true)}
                >
                  <QrCode className="h-4 w-4 mr-1" />
                  Connect
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Contact selector */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Start a Conversation</CardTitle>
            <CardDescription className="text-xs">
              Enter a phone number in E.164 format (e.g. 447700900000)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wa-phone" className="text-xs">Phone Number</Label>
              <Input
                id="wa-phone"
                placeholder="447700900000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startChat()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-name" className="text-xs">Contact Name (optional)</Label>
              <Input
                id="wa-name"
                placeholder="John Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startChat()}
              />
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={startChat}
              disabled={!phone.trim() || !isConnected}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Open Chat
            </Button>
            {!isConnected && (
              <p className="text-xs text-yellow-500 text-center">
                Connect WhatsApp first to start messaging
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right: Chat panel */}
        <div className="lg:col-span-2 flex items-start justify-center">
          {activeChat ? (
            <WhatsAppPanel
              contactPhone={activeChat.phone}
              contactName={activeChat.name}
            />
          ) : (
            <Card className="w-full h-[580px] flex items-center justify-center">
              <div className="text-center text-muted-foreground space-y-2">
                <MessageSquare className="h-12 w-12 mx-auto opacity-30" />
                <p className="text-sm">Select a contact to start messaging</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setShowQR(false)}>
          <div className="bg-card border rounded-xl p-6 max-w-sm w-[90%]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold">Connect WhatsApp</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowQR(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Open WhatsApp on your phone → Linked Devices → Link a Device
            </p>
            {waStatus?.qr ? (
              <img src={waStatus.qr} alt="WhatsApp QR Code" className="w-full rounded-lg bg-white p-2" />
            ) : status === "connected" ? (
              <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center text-green-500 font-medium">
                <Check className="h-6 w-6 mr-2" /> Connected!
              </div>
            ) : (
              <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Generating QR...
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Your phone must stay online. Uses one of your 4 linked device slots.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
