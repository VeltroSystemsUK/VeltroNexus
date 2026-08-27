import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Mail, Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePageTitle } from "@/context/LayoutContext";
import { cn } from "@/lib/utils";

type MailItem = {
  id: string;
  direction: "outbound" | "inbound";
  agentId?: string;
  agentName?: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  status: string;
  dealId?: number;
  createdAt: string;
};

type Payload = {
  mailboxes: { role: string; address: string; use: string }[];
  messages: MailItem[];
};

type Folder = "inbox" | "sent" | "all";

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function counterpart(item: MailItem) {
  return item.direction === "outbound" ? item.to : item.from;
}

function statusTone(status: string) {
  if (status === "sent" || status === "received") return "text-emerald-300 border-emerald-500/30";
  if (status === "failed") return "text-red-300 border-red-500/30";
  if (status === "mock") return "text-amber-200 border-amber-500/30";
  return "";
}

export default function AgentMail() {
  usePageTitle("Agent mail", "enquiries@stratafinance.co.uk");
  const [folder, setFolder] = useState<Folder>("all");
  const [agent, setAgent] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useQuery<Payload>({ queryKey: ["/api/agent-mail"] });

  const inboxAddress =
    (data?.mailboxes || []).find((box) => !/@stratanexus\.co\.uk$/i.test(box.address))?.address ||
    "enquiries@stratafinance.co.uk";

  const agents = useMemo(() => {
    const names = new Set((data?.messages || []).map((item) => item.agentName).filter(Boolean) as string[]);
    return Array.from(names);
  }, [data]);

  const messages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.messages || []).filter((item) => {
      if (folder === "inbox" && item.direction !== "inbound") return false;
      if (folder === "sent" && item.direction !== "outbound") return false;
      if (agent !== "all" && item.agentName !== agent) return false;
      if (!q) return true;
      return [item.subject, item.from, item.to, item.agentName, item.text].some((value) =>
        String(value || "").toLowerCase().includes(q)
      );
    });
  }, [data, folder, agent, query]);

  useEffect(() => {
    if (selectedId && messages.some((item) => item.id === selectedId)) return;
    setSelectedId(messages[0]?.id || null);
  }, [messages, selectedId]);

  const selected = messages.find((item) => item.id === selectedId) || null;
  const inboundCount = (data?.messages || []).filter((item) => item.direction === "inbound").length;
  const sentCount = (data?.messages || []).filter((item) => item.direction === "outbound").length;

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-background">
      <aside className="w-52 shrink-0 border-r flex flex-col">
        <div className="p-3 space-y-1">
          <FolderButton
            icon={Inbox}
            label="Inbox"
            count={inboundCount}
            active={folder === "inbox"}
            onClick={() => setFolder("inbox")}
          />
          <FolderButton
            icon={Send}
            label="Sent"
            count={sentCount}
            active={folder === "sent"}
            onClick={() => setFolder("sent")}
          />
          <FolderButton
            icon={Mail}
            label="All mail"
            count={(data?.messages || []).length}
            active={folder === "all"}
            onClick={() => setFolder("all")}
          />
        </div>
        {agents.length > 0 && (
          <div className="px-3 pb-3 space-y-1">
            <p className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Desks</p>
            <Button
              size="sm"
              variant={agent === "all" ? "secondary" : "ghost"}
              className="w-full justify-start font-normal h-8"
              onClick={() => setAgent("all")}
            >
              All desks
            </Button>
            {agents.map((name) => (
              <Button
                key={name}
                size="sm"
                variant={agent === name ? "secondary" : "ghost"}
                className="w-full justify-start font-normal h-8 truncate"
                onClick={() => setAgent(name)}
              >
                {name}
              </Button>
            ))}
          </div>
        )}
        <div className="mt-auto px-4 py-3 border-t text-xs text-muted-foreground">
          <p className="uppercase tracking-wide text-[10px] mb-1">Mailbox</p>
          <p className="truncate text-foreground/80">{inboxAddress}</p>
        </div>
      </aside>

      <div className="w-[22rem] shrink-0 border-r flex flex-col min-h-0">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search mail"
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div>
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading mail…</p>}
          {!isLoading && messages.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No messages in this folder.</p>
          )}
          {messages.map((item) => {
            const active = item.id === selected?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border/60 hover:bg-muted/40",
                  active && "bg-muted"
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium truncate">{counterpart(item)}</p>
                  <span className="text-[11px] text-muted-foreground shrink-0">{formatWhen(item.createdAt)}</span>
                </div>
                <p className="text-sm truncate mt-0.5">{item.subject || "(no subject)"}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {item.agentName ? `${item.agentName} · ` : ""}
                  {item.text || item.status}
                </p>
              </button>
            );
          })}
          </div>
        </ScrollArea>
      </div>

      <section className="flex-1 min-w-0 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a message
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold leading-snug">{selected.subject || "(no subject)"}</h2>
                <Badge variant="outline" className={statusTone(selected.status)}>
                  {selected.status}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>
                  <span className="text-foreground/70">From</span> {selected.from}
                </p>
                <p>
                  <span className="text-foreground/70">To</span> {selected.to}
                </p>
                <p>
                  {selected.agentName || "Unassigned"}
                  {" · "}
                  {new Date(selected.createdAt).toLocaleString("en-GB")}
                  {selected.dealId ? ` · deal ${selected.dealId}` : ""}
                </p>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="px-6 py-5 text-sm whitespace-pre-wrap leading-relaxed">
                {selected.text || "No message body."}
              </div>
            </ScrollArea>
          </>
        )}
      </section>
    </div>
  );
}

function FolderButton({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: typeof Inbox;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      className="w-full justify-start font-normal h-9"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 mr-2" />
      <span className="flex-1 text-left">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </Button>
  );
}
