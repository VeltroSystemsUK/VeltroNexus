import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useMutation, useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { useLocation } from "wouter";
import {
  Building2,
  GripVertical,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  canDragOpenerTo,
  canPromoteOpener,
  compareOpenersByOpenCount,
  convertStepBadge,
  daysSitting,
  openerClickCount,
  isConvertCloserDue,
  isConvertOpener,
  isHotClickOpener,
  isDoNotContactOpener,
  OPENER_BOARD_STATUSES,
  withDerivedNurture,
  type OpenerDesk,
  type OpenerRecord,
  type OpenerStatus,
} from "@shared/openers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/context/LayoutContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { HotClickDot } from "@/components/mail/HotClickDot";
import { SendAsSelect } from "@/components/mail/SendAsSelect";

type TimelineItem = {
  mailId: string;
  subject?: string;
  lastOpenAt?: string | null;
  openCount: number;
  clicks?: Array<{ at: string; url: string }>;
};

type OpenerBoardItem = OpenerRecord & {
  onPipeline: boolean;
  daysSitting: number;
  timeline?: TimelineItem[];
};

const COLUMN_LABELS: Record<OpenerStatus, string> = {
  non_responsive: "Non Responsive",
  new: "New",
  nurturing: "Nurturing",
  not_now: "Unsubscribed",
  promoted: "Promoted",
};

function present(opener: OpenerBoardItem): OpenerBoardItem {
  const derived = withDerivedNurture(opener);
  return {
    ...derived,
    onPipeline: Boolean(opener.onPipeline ?? opener.prospectId),
    daysSitting: opener.daysSitting ?? daysSitting(derived),
    timeline: opener.timeline,
  };
}

function openerTitle(opener: Pick<OpenerRecord, "companyName" | "email">) {
  return opener.companyName?.trim() || opener.email;
}

function nurtureHint(opener: OpenerBoardItem) {
  if (opener.onPipeline || opener.status === "promoted") return "On pipeline";
  if (isConvertOpener(opener)) return convertStepBadge(opener);
  if (opener.nurture.touch2Status === "due") return "Touch 2 due";
  return null;
}

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tradingAge(dateOfCreation?: string) {
  if (!dateOfCreation) return null;
  const start = Date.parse(dateOfCreation);
  if (!Number.isFinite(start)) return null;
  const years = Math.floor((Date.now() - start) / (365.25 * 24 * 60 * 60 * 1000));
  return years < 1 ? "Trading <1y" : `Trading ${years}y`;
}

function sittingLabel(days: number) {
  if (days <= 0) return "Sitting today";
  if (days === 1) return "1 day sitting";
  return `${days} days sitting`;
}

function defaultWhatsAppMessage(opener: OpenerBoardItem, desk: OpenerDesk = "openers") {
  const who = openerTitle(opener);
  if (desk === "non_responsive") {
    return `Hi, we sent a note about restructuring monthly debt commitments for ${who}. If a short call would help, reply here.`;
  }
  return `Hi, you opened our note about restructuring monthly debt commitments for ${who}. If a short call would help, reply here.`;
}

function mutationError(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

const DRAFT_FRAME_CSS = `
  html, body { margin: 0; padding: 12px 4px; background: #fff; color: #111; }
  body { font: 14px/1.5 system-ui, Segoe UI, Helvetica, Arial, sans-serif; word-break: break-word; }
  img { max-width: 100% !important; height: auto !important; }
  p { margin: 0 0 0.75em; }
`;

function NurtureDraftPreview({ subject, html, status }: { subject: string; html: string; status: string }) {
  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: ["style"],
    ADD_ATTR: ["target", "style", "class"],
    ALLOW_DATA_ATTR: false,
  });
  const srcDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light"><style>${DRAFT_FRAME_CSS}</style></head><body>${clean}</body></html>`;
  const onLoad = useCallback((event: SyntheticEvent<HTMLIFrameElement>) => {
    const frame = event.currentTarget;
    const doc = frame.contentDocument;
    if (!doc?.body) return;
    frame.style.height = `${Math.max(160, doc.documentElement.scrollHeight + 8)}px`;
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{subject}</p>
      <p className="text-xs text-muted-foreground">{status}</p>
      <div className="rounded-md border bg-white overflow-x-auto">
        <iframe
          title="Nurture draft"
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
          className="w-full min-h-[160px] border-0 bg-white"
          srcDoc={srcDoc}
          onLoad={onLoad}
        />
      </div>
    </div>
  );
}

function OpenerCards({
  items,
  onSelect,
}: {
  items: OpenerBoardItem[];
  onSelect: (id: string) => void;
}) {
  return (
    <>
      {items.map((opener, index) => {
        const hint = nurtureHint(opener);
        const clicks = openerClickCount(opener);
        return (
          <Draggable key={opener.id} draggableId={opener.id} index={index}>
            {(dragProvided, dragSnapshot) => (
              <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                <Card
                  className={cn("cursor-pointer", dragSnapshot.isDragging && "shadow-lg rotate-1")}
                  onClick={() => onSelect(opener.id)}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className="mt-0.5 text-muted-foreground"
                        {...dragProvided.dragHandleProps}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate flex items-center gap-2">
                          <span className="truncate">{openerTitle(opener)}</span>
                          {isHotClickOpener(opener) && <HotClickDot />}
                        </p>
                        <p className="text-xs text-muted-foreground">{sittingLabel(opener.daysSitting)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pl-6">
                      {clicks > 0 && (
                        <Badge data-testid="badge-opener-clicks">
                          {clicks} click{clicks === 1 ? "" : "s"}
                        </Badge>
                      )}
                      <Badge variant="outline">
                        {opener.openCount} open{opener.openCount === 1 ? "" : "s"}
                        {opener.lastOpenedAt ? ` · ${formatWhen(opener.lastOpenedAt)}` : ""}
                      </Badge>
                      {opener.nonBankChargeCount > 0 && (
                        <Badge variant="destructive">Live charges</Badge>
                      )}
                      {isDoNotContactOpener(opener) && (
                        <Badge variant="destructive" data-testid="badge-do-not-contact">
                          DO NOT CONTACT
                        </Badge>
                      )}
                      {hint && <Badge variant="secondary">{hint}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </Draggable>
        );
      })}
    </>
  );
}

function ColumnFrame({
  "data-testid": testId,
  label,
  count,
  droppableId,
  items,
  onSelect,
}: {
  "data-testid": string;
  label: string;
  count: number;
  droppableId: OpenerStatus;
  items: OpenerBoardItem[];
  onSelect: (id: string) => void;
}) {
  return (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          data-testid={testId}
          className="min-w-[85vw] md:min-w-0 snap-center flex flex-col"
        >
          <div className="bg-muted rounded-t-lg p-4 border-b">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-base">{label}</h3>
              <Badge variant="secondary">{count}</Badge>
            </div>
          </div>
          <div
            className={cn(
              "flex-1 rounded-b-lg p-3 space-y-3 min-h-[240px] transition-colors",
              snapshot.isDraggingOver
                ? "bg-muted/50 border-2 border-dashed border-primary"
                : "bg-muted/30"
            )}
          >
            <OpenerCards items={items} onSelect={onSelect} />
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
}

export default function Openers({ desk = "openers" }: { desk?: OpenerDesk }) {
  const isNonResponsive = desk === "non_responsive";
  usePageTitle(
    isNonResponsive ? "Non Responsive" : "Openers",
    isNonResponsive
      ? "Sent successfully, not opened, not bounced, not unsubscribed"
      : "Companies that opened Agent Mail"
  );
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [hasChNumber, setHasChNumber] = useState(false);
  const [onPipelineOnly, setOnPipelineOnly] = useState(false);
  const [hasLiveCharges, setHasLiveCharges] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [attachNumber, setAttachNumber] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [callNote, setCallNote] = useState("");
  const [sendAs, setSendAs] = useState("outreach-sales");
  const boardStatuses = isNonResponsive ? (["non_responsive"] as const) : OPENER_BOARD_STATUSES;

  const { data, isLoading, error } = useQuery<OpenerBoardItem[]>({
    queryKey: isNonResponsive ? ["/api/openers", { desk: "non_responsive" }] : ["/api/openers"],
  });

  const openers = useMemo(() => (data || []).map(present), [data]);

  const selected = openers.find((opener) => opener.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setNotes(selected.notes || "");
    setAttachNumber(selected.companyNumber || "");
    setWaMessage(defaultWhatsAppMessage(selected, desk));
    setCallNote("");
    setSendAs("outreach-sales");
  }, [selected?.id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/openers"] });
  };

  const patchMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await apiRequest(`/api/openers/${id}`, "PATCH", body);
      return res.json();
    },
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(mutationError(err)),
  });

  const nurtureMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      agentId,
      channel,
    }: {
      id: string;
      action: "start" | "approve" | "skip" | "stop" | "closer";
      agentId?: string;
      channel?: "whatsapp" | "call" | "skip";
    }) => {
      const res = await apiRequest(`/api/openers/${id}/nurture`, "POST", { action, agentId, channel });
      return res.json();
    },
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(mutationError(err)),
  });

  const enrichMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/openers/${id}/enrich`, "POST");
      return res.json();
    },
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(mutationError(err)),
  });

  const promoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/openers/${id}/promote`, "POST");
      return res.json() as Promise<{ created: boolean; prospectId: number }>;
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(result.created ? "Opened on the Deck" : "Already on the Deck");
      setLocation("/pipeline");
    },
    onError: (err: Error) => toast.error(mutationError(err)),
  });

  const whatsappMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const res = await apiRequest(`/api/openers/${id}/whatsapp`, "POST", { message });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success("WhatsApp sent");
    },
    onError: (err: Error) => toast.error(mutationError(err)),
  });

  const callMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const res = await apiRequest(`/api/openers/${id}/call`, "POST", { note });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success("Call logged");
    },
    onError: (err: Error) => toast.error(mutationError(err)),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return openers.filter((opener) => {
      if (hasChNumber && !opener.companyNumber) return false;
      if (onPipelineOnly && !opener.onPipeline) return false;
      if (hasLiveCharges && opener.nonBankChargeCount <= 0) return false;
      if (!q) return true;
      const haystack = [
        opener.companyName,
        opener.email,
        opener.companyNumber,
        ...(opener.emails || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [openers, search, hasChNumber, onPipelineOnly, hasLiveCharges]);

  const byStatus = useMemo(() => {
    const groups = {} as Record<OpenerStatus, OpenerBoardItem[]>;
    for (const status of boardStatuses) groups[status] = [];
    for (const opener of filtered) {
      groups[opener.status]?.push(opener);
    }
    for (const status of boardStatuses) {
      groups[status].sort(compareOpenersByOpenCount);
    }
    return groups;
  }, [filtered, boardStatuses]);

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId, source } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const opener = openers.find((item) => item.id === draggableId);
    if (!opener) return;
    const column = destination.droppableId as OpenerStatus;

    if (column === "promoted") {
      if (!canPromoteOpener(opener)) {
        toast.error("Company number required");
        return;
      }
      promoteMutation.mutate(opener.id);
      return;
    }

    if (!canDragOpenerTo(opener, column)) {
      toast.error("Cannot move opener to that status");
      return;
    }
    patchMutation.mutate({ id: opener.id, body: { status: column } });
  };

  const saveNotes = () => {
    if (!selected || notes === (selected.notes || "")) return;
    patchMutation.mutate({ id: selected.id, body: { notes } });
  };

  const attachCompany = () => {
    if (!selected || !attachNumber.trim()) return;
    patchMutation.mutate({ id: selected.id, body: { companyNumber: attachNumber.trim() } });
  };

  const doNotContact = Boolean(selected && isDoNotContactOpener(selected));
  const promoteLabel =
    selected && (selected.onPipeline || selected.status === "promoted")
      ? "Open on Deck"
      : "Promote to Pipeline";

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <main className="w-full px-4 md:px-6 py-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isNonResponsive ? "Search non-responsive" : "Search openers"}
              className="h-9 pl-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={hasChNumber}
                onCheckedChange={(value) => setHasChNumber(value === true)}
              />
              Has CH number
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={onPipelineOnly}
                onCheckedChange={(value) => setOnPipelineOnly(value === true)}
              />
              Already on Pipeline
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={hasLiveCharges}
                onCheckedChange={(value) => setHasLiveCharges(value === true)}
              />
              Has live charges
            </label>
          </div>
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isNonResponsive ? "Loading non-responsive…" : "Loading openers…"}
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive">Unable to load openers. Super admin access is required.</p>
        )}

        <DragDropContext onDragEnd={onDragEnd}>
          <div
            className={cn(
              "flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 md:gap-4 md:pb-0 md:mx-0 md:px-0 md:grid",
              isNonResponsive ? "md:grid-cols-1" : "md:grid-cols-4"
            )}
          >
            {isNonResponsive ? (
              <ColumnFrame
                data-testid="column-non_responsive"
                label={COLUMN_LABELS.non_responsive}
                droppableId="non_responsive"
                items={byStatus.non_responsive}
                count={byStatus.non_responsive.length}
                onSelect={setSelectedId}
              />
            ) : (
              <>
            <ColumnFrame
              data-testid="column-new"
              label={COLUMN_LABELS.new}
              droppableId="new"
              items={byStatus.new}
              count={byStatus.new.length}
              onSelect={setSelectedId}
            />
            <ColumnFrame
              data-testid="column-nurturing"
              label={COLUMN_LABELS.nurturing}
              droppableId="nurturing"
              items={byStatus.nurturing}
              count={byStatus.nurturing.length}
              onSelect={setSelectedId}
            />
            <ColumnFrame
              data-testid="column-not_now"
              label={COLUMN_LABELS.not_now}
              droppableId="not_now"
              items={byStatus.not_now}
              count={byStatus.not_now.length}
              onSelect={setSelectedId}
            />
            <ColumnFrame
              data-testid="column-promoted"
              label={COLUMN_LABELS.promoted}
              droppableId="promoted"
              items={byStatus.promoted}
              count={byStatus.promoted.length}
              onSelect={setSelectedId}
            />
              </>
            )}
          </div>
        </DragDropContext>
      </main>

      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {openerTitle(selected)}
                  {isHotClickOpener(selected) && <HotClickDot />}
                  {selected.nonBankChargeCount > 0 && (
                    <Badge variant="destructive">Live charges</Badge>
                  )}
                  {isDoNotContactOpener(selected) && (
                    <Badge variant="destructive" data-testid="badge-do-not-contact">
                      DO NOT CONTACT
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription>
                  {[selected.companyNumber, COLUMN_LABELS[selected.status], tradingAge(selected.dateOfCreation)]
                    .filter(Boolean)
                    .join(" · ")}
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
                <div className="space-y-6 pb-8">
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Timeline</h3>
                    {(selected.timeline || []).length === 0 && (
                      <p className="text-sm text-muted-foreground">No Agent Mail activity yet.</p>
                    )}
                    <div className="space-y-3">
                      {(selected.timeline || []).map((item) => (
                        <div key={item.mailId} className="rounded-md border p-3 space-y-1">
                          <p className="text-sm font-medium">{item.subject || "(no subject)"}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.openCount} open{item.openCount === 1 ? "" : "s"}
                            {item.lastOpenAt ? ` · last ${formatWhen(item.lastOpenAt)}` : ""}
                            {item.clicks?.length ? ` · ${item.clicks.length} click${item.clicks.length === 1 ? "" : "s"}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Companies House</h3>
                    {selected.companyNumber ? (
                      <div className="space-y-2 text-sm">
                        <p className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {selected.companyName || "Unnamed"} · {selected.companyNumber}
                        </p>
                        {selected.companyStatus && (
                          <p className="text-muted-foreground">Status: {selected.companyStatus}</p>
                        )}
                        {selected.sicCodes.length > 0 && (
                          <p className="text-muted-foreground">SIC: {selected.sicCodes.join(", ")}</p>
                        )}
                        {selected.address && (
                          <p className="text-muted-foreground">{selected.address}</p>
                        )}
                        {selected.directors.length > 0 && (
                          <p className="text-muted-foreground">
                            Directors: {selected.directors.map((d) => d.name).join(", ")}
                          </p>
                        )}
                        {selected.liveCharges.length > 0 && (
                          <p className="text-muted-foreground">
                            Charges: {selected.liveCharges.map((c) => c.chargee || c.status).filter(Boolean).join(", ")}
                          </p>
                        )}
                        {selected.enrichError && (
                          <p className="text-destructive">{selected.enrichError}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No company number yet. Attach one to enrich and promote.</p>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={attachNumber}
                        onChange={(event) => setAttachNumber(event.target.value)}
                        placeholder="Company number"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={attachCompany}
                        disabled={!attachNumber.trim() || patchMutation.isPending}
                      >
                        Attach company
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => enrichMutation.mutate(selected.id)}
                      disabled={enrichMutation.isPending}
                    >
                      {enrichMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Retry enrich
                    </Button>
                  </section>

                  <Separator />

                  <section className="space-y-2">
                    <Label htmlFor="opener-notes">Notes</Label>
                    <Textarea
                      id="opener-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      onBlur={saveNotes}
                      rows={4}
                    />
                  </section>

                  {!isNonResponsive && <section className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Nurture</h3>
                    {doNotContact && (
                      <p className="text-sm text-destructive">This address asked to be removed. No further contact.</p>
                    )}
                    {isConvertOpener(selected) ? (
                      <>
                        <Badge data-testid="badge-convert-step">{convertStepBadge(selected)}</Badge>
                        {selected.nurture.closerScript && (
                          <p data-testid="convert-closer-script" className="text-sm whitespace-pre-wrap">
                            {selected.nurture.closerScript}
                          </p>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid="button-skip-closer"
                          disabled={
                            nurtureMutation.isPending ||
                            doNotContact ||
                            !isConvertCloserDue(selected) ||
                            Boolean(selected.phone)
                          }
                          onClick={() =>
                            nurtureMutation.mutate({ id: selected.id, action: "closer", channel: "skip" })
                          }
                        >
                          Skip closer
                        </Button>
                      </>
                    ) : (
                      <>
                    <div className="flex flex-wrap gap-2 items-center">
                      <SendAsSelect value={sendAs} onChange={setSendAs} disabled={nurtureMutation.isPending || doNotContact} />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => nurtureMutation.mutate({ id: selected.id, action: "start" })}
                        disabled={nurtureMutation.isPending || doNotContact}
                      >
                        Start nurture
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => nurtureMutation.mutate({ id: selected.id, action: "approve", agentId: sendAs })}
                        disabled={nurtureMutation.isPending || doNotContact}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => nurtureMutation.mutate({ id: selected.id, action: "skip" })}
                        disabled={nurtureMutation.isPending || doNotContact}
                      >
                        Skip
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => nurtureMutation.mutate({ id: selected.id, action: "stop" })}
                        disabled={nurtureMutation.isPending}
                      >
                        Stop
                      </Button>
                    </div>
                    {selected.nurture.touch1Draft && (
                      <NurtureDraftPreview
                        subject={selected.nurture.touch1Draft.subject}
                        html={selected.nurture.touch1Draft.html}
                        status={selected.nurture.touch1Status}
                      />
                    )}
                      </>
                    )}
                  </section>}

                  <section className="space-y-2">
                    <Label htmlFor="opener-whatsapp">WhatsApp</Label>
                    <Textarea
                      id="opener-whatsapp"
                      value={waMessage}
                      onChange={(event) => setWaMessage(event.target.value)}
                      disabled={!selected.phone || doNotContact}
                      rows={3}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!selected.phone || !waMessage.trim() || whatsappMutation.isPending || doNotContact}
                      onClick={() => whatsappMutation.mutate({ id: selected.id, message: waMessage.trim() })}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                    {!selected.phone && (
                      <p className="text-xs text-muted-foreground">Phone required for WhatsApp and call.</p>
                    )}
                  </section>

                  <section className="space-y-2">
                    <Label htmlFor="opener-call">Log call</Label>
                    <Input
                      id="opener-call"
                      value={callNote}
                      onChange={(event) => setCallNote(event.target.value)}
                      placeholder="Call note"
                      disabled={!selected.phone || doNotContact}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!selected.phone || callMutation.isPending || doNotContact}
                      onClick={() => callMutation.mutate({ id: selected.id, note: callNote.trim() })}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Log call
                    </Button>
                  </section>

                  <Button
                    type="button"
                    data-testid="button-promote-opener"
                    disabled={!canPromoteOpener(selected) || promoteMutation.isPending}
                    onClick={() => promoteMutation.mutate(selected.id)}
                  >
                    {promoteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {promoteLabel}
                  </Button>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
