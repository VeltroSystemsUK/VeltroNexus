import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Inbox, Loader2, Mail, MailOpen, Paperclip, Reply, RefreshCw, Search, Send, ShieldAlert } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle, usePageActions } from "@/context/LayoutContext";
import { cn } from "@/lib/utils";
import { agentMailInFolder, type AgentMailFolder } from "@shared/mailDesk";
import { ensureMailLinksOpenInNewTab, isOpenedOutboundMail, lastMailOpenAt, stripMailTracking } from "@shared/mailTracking";

type MailItem = {
  id: string;
  direction: "outbound" | "inbound";
  agentId?: string;
  agentName?: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  status: string;
  dealId?: number;
  createdAt: string;
  opens?: string[];
  clicks?: Array<{ at: string; url: string }>;
  attachments?: Array<{
    index: number;
    filename: string;
    contentType: string;
    size: number;
    contentBase64?: string;
  }>;
};

function bytesFromBase64(value: string): Uint8Array {
  const bin = atob(value);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadMailAttachment(
  mailId: string,
  file: NonNullable<MailItem["attachments"]>[number],
): Promise<boolean> {
  const href = `/api/agent-mail/${mailId}/attachments/${file.index}`;
  try {
    const res = await fetch(href, { credentials: "same-origin" });
    if (res.ok) {
      saveBlob(await res.blob(), file.filename);
      return true;
    }
  } catch {
    /* old NexusApp has no download route — fall back to bytes on the mail record */
  }
  if (file.contentBase64) {
    saveBlob(
      new Blob([bytesFromBase64(file.contentBase64)], {
        type: file.contentType || "application/octet-stream",
      }),
      file.filename,
    );
    return true;
  }
  return false;
}

// Renders the exact HTML the customer's mail client would show, sandboxed
// so nothing in the email (agent-authored or an inbound reply) can run script
// in the app. Mirrors client/src/components/gmail/EmailBody.tsx.
const MAIL_FRAME_CSS = `
  html, body { margin: 0; padding: 12px 4px; background: #fff; color: #111; }
  body { font: 14px/1.5 system-ui, Segoe UI, Helvetica, Arial, sans-serif; word-break: break-word; }
  img { max-width: 100% !important; height: auto !important; }
  table { max-width: 100% !important; }
  a { color: #0b57d0; }
`;

function AgentMailBody({ html, text }: { html?: string; text: string }) {
  if (!html) {
    return (
      <div className="px-6 py-5 text-sm whitespace-pre-wrap leading-relaxed">
        {text || "No message body."}
      </div>
    );
  }

  const clean = DOMPurify.sanitize(ensureMailLinksOpenInNewTab(stripMailTracking(html)), {
    ADD_TAGS: ["style"],
    ADD_ATTR: ["target", "style", "class", "align", "valign", "bgcolor", "width", "height", "cellpadding", "cellspacing", "border", "colspan", "rowspan"],
    ALLOW_DATA_ATTR: false,
  });
  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light"><style>${MAIL_FRAME_CSS}</style></head><body>${clean}</body></html>`;

  const onLoad = useCallback((event: SyntheticEvent<HTMLIFrameElement>) => {
    const frame = event.currentTarget;
    const doc = frame.contentDocument;
    if (!doc?.body) return;
    frame.style.height = `${Math.max(320, doc.documentElement.scrollHeight + 8)}px`;
  }, []);

  return (
    <div className="mx-6 my-5 rounded-md border bg-white overflow-x-auto">
      <iframe
        title="Agent mail message"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        className="w-full min-h-[320px] border-0 bg-white"
        srcDoc={srcDoc}
        onLoad={onLoad}
      />
    </div>
  );
}

type Payload = {
  mailboxes: { role: string; address: string; use: string }[];
  messages: MailItem[];
};

type Folder = AgentMailFolder;

const READING_PANE_KEY = "agent-mail-reading-pane";

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

function mailOpenState(item: MailItem) {
  if (item.direction !== "outbound") return null;
  const tracked = typeof item.html === "string" && /\/api\/agent-mail\/track\//.test(item.html);
  const opens = item.opens || [];
  const clicks = item.clicks || [];
  if (!tracked && opens.length === 0) {
    return { kind: "untracked" as const, label: "Not tracked", detail: "Sent before the open pixel was on." };
  }
  if (opens.length === 0) {
    return { kind: "unopened" as const, label: "Not opened", detail: "Pixel not loaded yet. Mail apps can block images." };
  }
  const last = opens[opens.length - 1]!;
  const clickBit = clicks.length ? ` · ${clicks.length} click${clicks.length === 1 ? "" : "s"}` : "";
  return {
    kind: "opened" as const,
    label: opens.length === 1 ? "Opened" : `Opened ${opens.length}×`,
    detail: `${formatWhen(last)}${clickBit}`,
  };
}

export default function AgentMail() {
  usePageTitle("Agent mail", "enquiries@stratafinance.co.uk");
  const [folder, setFolder] = useState<Folder>("all");
  const [agent, setAgent] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [readingPane, setReadingPane] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(READING_PANE_KEY) !== "off";
  });
  const { toast } = useToast();
  const { data, isLoading } = useQuery<Payload>({
    queryKey: ["/api/agent-mail"],
    refetchInterval: 20_000,
  });
  const syncMail = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/agent-mail/sync", "POST");
      return res.json() as Promise<{ fetched: number; stored: number; skipped: number }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-mail"] });
      toast({
        title: "Mailbox updated",
        description:
          result.stored > 0
            ? `Pulled ${result.stored} new message${result.stored === 1 ? "" : "s"} from IONOS.`
            : "No new messages. Already up to date.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not pull mail",
        description: error.message || "IONOS IMAP did not respond.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    syncMail.mutate();
    // Pull once when Agent Mail opens; the button re-runs the same call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inboxAddress =
    (data?.mailboxes || []).find((box) => !/@stratanexus\.co\.uk$/i.test(box.address))?.address ||
    "enquiries@stratafinance.co.uk";

  const agents = useMemo(() => {
    const names = new Set((data?.messages || []).map((item) => item.agentName).filter(Boolean) as string[]);
    return Array.from(names);
  }, [data]);

  const messages = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = (data?.messages || []).filter((item) => {
      if (!agentMailInFolder(item, folder)) return false;
      if (agent !== "all" && item.agentName !== agent) return false;
      if (!q) return true;
      const files = (item.attachments || []).map((file) => file.filename).join(" ");
      return [item.subject, item.from, item.to, item.agentName, item.text, files].some((value) =>
        String(value || "").toLowerCase().includes(q)
      );
    });
    if (folder !== "opened") return filtered;
    return [...filtered].sort((a, b) =>
      (lastMailOpenAt(b.opens) || "").localeCompare(lastMailOpenAt(a.opens) || ""),
    );
  }, [data, folder, agent, query]);

  useEffect(() => {
    if (selectedId && messages.some((item) => item.id === selectedId)) return;
    setSelectedId(messages[0]?.id || null);
  }, [messages, selectedId]);

  const selected = messages.find((item) => item.id === selectedId) || null;
  const selectedOpen = selected ? mailOpenState(selected) : null;
  const inboundCount = (data?.messages || []).filter((item) => agentMailInFolder(item, "inbox")).length;
  const sentCount = (data?.messages || []).filter((item) => agentMailInFolder(item, "sent")).length;
  const openedCount = (data?.messages || []).filter((item) => agentMailInFolder(item, "opened")).length;
  const quarantineCount = (data?.messages || []).filter((item) => agentMailInFolder(item, "quarantine")).length;
  const allCount = (data?.messages || []).filter((item) => agentMailInFolder(item, "all")).length;

  useEffect(() => {
    setReplyOpen(false);
    setReplyText("");
  }, [selectedId]);

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a message first");
      const res = await apiRequest(`/api/agent-mail/${selected.id}/reply`, "POST", { text: replyText });
      return res.json() as Promise<{ success: boolean; mock?: boolean }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-mail"] });
      setReplyText("");
      setReplyOpen(false);
      toast({
        title: result.mock ? "Reply logged" : "Reply sent",
        description: result.mock
          ? "No SMTP credentials configured — logged instead of sent."
          : `Sent to ${selected ? counterpart(selected) : ""}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not send reply",
        description: error.message || "The mailbox did not respond.",
        variant: "destructive",
      });
    },
  });

  function toggleReadingPane(on: boolean) {
    setReadingPane(on);
    window.localStorage.setItem(READING_PANE_KEY, on ? "on" : "off");
  }

  const refreshButton = useMemo(
    () => (
      <Button
        data-testid="button-refresh-mail"
        onClick={() => syncMail.mutate()}
        disabled={syncMail.isPending}
        className="h-9"
      >
        {syncMail.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
        {syncMail.isPending ? "Pulling…" : "Refresh"}
      </Button>
    ),
    [syncMail.isPending]
  );

  usePageActions(refreshButton);

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-background">
      <aside className="w-52 shrink-0 border-r flex flex-col">
        <div className="p-3 space-y-1">
          <div className="mb-2">{refreshButton}</div>
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
            icon={MailOpen}
            label="Opened"
            count={openedCount}
            active={folder === "opened"}
            onClick={() => setFolder("opened")}
          />
          <FolderButton
            icon={Mail}
            label="All mail"
            count={allCount}
            active={folder === "all"}
            onClick={() => setFolder("all")}
          />
          <FolderButton
            icon={ShieldAlert}
            label="Quarantine"
            count={quarantineCount}
            active={folder === "quarantine"}
            onClick={() => setFolder("quarantine")}
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

      <div className={cn("border-r flex flex-col min-h-0", readingPane ? "w-[22rem] shrink-0" : "flex-1 min-w-0")}>
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search mail"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-0.5">
            <Label htmlFor="reading-pane" className="text-[11px] uppercase tracking-wide text-muted-foreground font-normal">
              Reading pane
            </Label>
            <Switch
              id="reading-pane"
              checked={readingPane}
              onCheckedChange={toggleReadingPane}
              aria-label="Toggle reading pane"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div>
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Loading mail…</p>}
          {!isLoading && messages.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              {folder === "opened"
                ? "No opens yet. Tracked sent mail lands here when the recipient’s client loads the pixel."
                : folder === "quarantine"
                  ? "No mailer-daemon messages in quarantine."
                  : "No messages in this folder."}
            </p>
          )}
          {messages.map((item) => {
            const active = item.id === selected?.id;
            const openState = mailOpenState(item);
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
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatWhen(folder === "opened" ? lastMailOpenAt(item.opens) || item.createdAt : item.createdAt)}
                  </span>
                </div>
                <p className="text-sm truncate mt-0.5 flex items-center gap-1.5">
                  {(item.attachments || []).length > 0 && (
                    <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{item.subject || "(no subject)"}</span>
                </p>
                {(item.attachments || []).length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {(item.attachments || []).length} attachment{(item.attachments || []).length === 1 ? "" : "s"}
                  </p>
                )}
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {item.agentName ? `${item.agentName} · ` : ""}
                  {item.text || item.status}
                </p>
                {openState && (
                  <p
                    className={cn(
                      "text-[11px] mt-1",
                      openState.kind === "opened" && "text-emerald-400",
                      openState.kind === "unopened" && "text-muted-foreground",
                      openState.kind === "untracked" && "text-white/35",
                    )}
                  >
                    {openState.label}
                    {openState.kind === "opened" && openState.detail ? ` · ${openState.detail}` : ""}
                  </p>
                )}
              </button>
            );
          })}
          </div>
        </ScrollArea>
      </div>

      {readingPane && (
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
                <div className="flex items-center gap-2 shrink-0">
                  {selectedOpen?.kind === "opened" && (
                    <Badge variant="outline" className="text-emerald-300 border-emerald-500/30 gap-1">
                      <MailOpen className="h-3 w-3" />
                      {selectedOpen.label}
                    </Badge>
                  )}
                  <Badge variant="outline" className={statusTone(selected.status)}>
                    {selected.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant={replyOpen ? "secondary" : "outline"}
                    className="h-8"
                    onClick={() => setReplyOpen((open) => !open)}
                    data-testid="button-reply"
                  >
                    <Reply className="h-3.5 w-3.5 mr-1.5" />
                    Reply
                  </Button>
                </div>
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
                {selectedOpen && (
                  <p
                    className={cn(
                      "flex items-center gap-1.5 pt-1",
                      selectedOpen.kind === "opened" && "text-emerald-400",
                    )}
                    title="Image prefetch in some mail apps can register an open without a person reading the message."
                  >
                    <MailOpen className="h-3.5 w-3.5" />
                    {selectedOpen.label}
                    {selectedOpen.detail ? ` · ${selectedOpen.detail}` : ""}
                  </p>
                )}
              </div>
              {(selected.attachments || []).length > 0 && (
                <div className="pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachments</p>
                  {(selected.attachments || []).map((file) => (
                    <a
                      key={file.index}
                      data-testid="link-mail-attachment"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                      href={`/api/agent-mail/${selected.id}/attachments/${file.index}`}
                      download={file.filename}
                      onClick={async (event) => {
                        event.preventDefault();
                        const ok = await downloadMailAttachment(selected.id, file);
                        if (!ok) {
                          toast({
                            title: "Could not download attachment",
                            description: "Refresh Agent mail, then try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Paperclip className="h-4 w-4" />
                      {file.filename}
                      {file.size ? (
                        <span className="text-muted-foreground">({Math.max(1, Math.round(file.size / 1024))} KB)</span>
                      ) : null}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <ScrollArea className="flex-1">
              <AgentMailBody html={selected.html} text={selected.text} />
            </ScrollArea>
            {replyOpen && (
              <div className="border-t p-4 space-y-2 shrink-0">
                <p className="text-xs text-muted-foreground">
                  Reply to <span className="text-foreground/80">{counterpart(selected)}</span>
                </p>
                <Textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Write your reply…"
                  className="min-h-[140px] text-sm"
                  data-testid="input-reply-text"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setReplyOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => sendReply.mutate()}
                    disabled={sendReply.isPending || !replyText.trim()}
                    data-testid="button-send-reply"
                  >
                    {sendReply.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {sendReply.isPending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
      )}
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
