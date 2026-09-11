import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { STAGE_LABELS, type AgenticDealFile } from "@shared/agenticWorkflow";
import { namedPackGaps } from "@shared/sterlingCompleteness";
import { packUploadUrl, signEngagementUrl } from "@shared/strataOutreach";
import { isLiveSigned } from "@shared/engagementPack";
import {
  remainingSmeFirstTouchSlots,
  smeFirstTouchSlot,
  SME_FIRST_TOUCH_PER_HOUR,
} from "@shared/smeOutreach";
import { hopperStatusLine, isContactableDeal } from "@shared/smeHopper";
import { deskJobProgress } from "@shared/deskOps";
import type { HuntQuality, QualityAlert } from "@shared/smeQuality";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { ChevronDown, Trash2, Upload } from "lucide-react";
import { OutreachPlaybook } from "./OutreachPlaybook";
import { BbbGate } from "./BbbGate";

type HuntReport = {
  opened: number;
  scanned: number;
  rejectedTotal: number;
  rejected: Record<string, number>;
};

type QualityPayload = HuntQuality & {
  hopper?: { sendable: number; huntContact: number; parked: number; gated: number; quarantine: number };
  quarantine?: AgenticDealFile[];
};

function meter(remaining: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round(((total - remaining) / total) * 100));
}

function QualityStrip({
  quality,
  onKeep,
  onDelete,
  onPurge,
  onResumeGuess,
  busy,
}: {
  quality: QualityPayload;
  onKeep: (id: number) => void;
  onDelete: (id: number) => void;
  onPurge: () => void;
  onResumeGuess: () => void;
  busy?: boolean;
}) {
  const apis: Array<[string, number, number]> = [
    ["CH", quality.budget.remaining.ch, quality.budget.total.ch],
    ["Places", quality.budget.remaining.places, quality.budget.total.places],
    ["Firecrawl", quality.budget.remaining.firecrawl, quality.budget.total.firecrawl],
    ["MX", quality.budget.remaining.smtp, quality.budget.total.smtp],
  ];
  const quarantined = quality.quarantine || [];
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-white">
          Lead quality{" "}
          <span className="text-slate-400 font-normal">
            {quality.hopper?.sendable ?? quality.deliverable}/{quality.target} mail-ready · yield {quality.yieldPct}%
          </span>
        </p>
        <p className="text-xs tabular-nums text-slate-500">
          {quality.scanned} scanned · {quality.sent} sent · {quality.opened} opened · {quality.replied} replied ·{" "}
          {quality.director} director / {quality.role} role
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {apis.map(([label, remaining, total]) => {
          const used = meter(remaining, total);
          return (
            <div key={label} className="rounded border border-slate-800 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 flex justify-between">
                <span>{label}</span>
                <span className={used >= 80 ? "text-amber-300" : "text-slate-400"}>{used}%</span>
              </p>
              <div className="mt-1 h-1 rounded bg-slate-800">
                <div
                  className={`h-1 rounded ${used >= 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                  style={{ width: `${used}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {quality.alerts.map((alert: QualityAlert) => (
        <div
          key={alert.id || alert.message}
          className={`flex flex-wrap items-center justify-between gap-2 ${
            alert.tone === "red" ? "text-xs text-red-300" : "text-xs text-amber-200"
          }`}
        >
          <p>{alert.message}</p>
          {alert.id === "guess_paused" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              data-testid="btn-resume-harvest-guess"
              disabled={busy}
              onClick={onResumeGuess}
            >
              Resume guessing
            </Button>
          ) : null}
        </div>
      ))}
      {quarantined.length > 0 && (
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-400">{quarantined.length} in quarantine — inspect before delete</p>
            <Button size="sm" variant="ghost" className="h-7 text-red-300" disabled={busy} onClick={onPurge}>
              Delete all
            </Button>
          </div>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {quarantined.slice(0, 20).map((deal) => (
              <li key={deal.id} className="flex items-center gap-2 text-xs text-slate-300">
                <span className="flex-1 truncate">{deal.companyName}</span>
                <span className="text-slate-500 truncate max-w-[40%]">{deal.humanReason}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2" disabled={busy} onClick={() => onKeep(deal.id)}>
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-red-300"
                  disabled={busy}
                  onClick={() => onDelete(deal.id)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HuntSummary({ report }: { report: HuntReport }) {
  const topRejects = Object.entries(report.rejected || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${count} ${reason}`)
    .join("; ");
  return (
    <p className="text-xs text-slate-500">
      Last queue: looked at {report.scanned} hopper contacts, sent {report.opened} SME first-touches.
      {report.rejectedTotal ? ` Dropped ${report.rejectedTotal}${topRejects ? ` — ${topRejects}` : ""}.` : ""}
    </p>
  );
}

function statusTone(status: AgenticDealFile["status"]) {
  if (status === "waiting_human") return "bg-amber-500/20 text-amber-200 border-amber-500/40";
  if (status === "waiting_timer") return "bg-sky-500/20 text-sky-200 border-sky-500/40";
  if (status === "complete") return "bg-emerald-500/20 text-emerald-200 border-emerald-500/40";
  if (status === "failed") return "bg-red-500/20 text-red-200 border-red-500/40";
  return "bg-primary/20 text-primary border-primary/40";
}

function needsBbb(deal: AgenticDealFile) {
  if (deal.bbbEligibility?.status === "pass") return false;
  return deal.stage === "processing" || deal.stage === "underwriting" || deal.stage === "human_review";
}

function stamp(value?: string | Date) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChargeHolders({ names, clamp }: { names?: string[]; clamp?: boolean }) {
  const list = (names || []).filter(Boolean);
  return (
    <span className={clamp ? "block text-xs leading-snug line-clamp-2" : "block text-xs leading-snug"}>
      <span className="text-amber-500/90">Registered charge holders · </span>
      <span className={list.length ? "text-amber-200" : "text-slate-500"}>
        {list.length ? list.join(" · ") : "None on file"}
      </span>
    </span>
  );
}

function lastActivity(deal: AgenticDealFile): { at: string; task: string } {
  const events = deal.events || [];
  const last = events[events.length - 1];
  const at = last?.at || deal.updatedAt || deal.createdAt;
  const task =
    last?.message ||
    deal.humanReason ||
    deal.outreachSubject ||
    STAGE_LABELS[deal.stage] ||
    "File opened";
  return { at, task };
}

function showPlaybook(deal: AgenticDealFile) {
  return (
    deal.stage === "human_call" ||
    deal.humanReason?.includes("LinkedIn") ||
    Boolean(deal.outreachSubject || deal.outreachBody || deal.socialPlaybook)
  );
}

export function DealFilesPanel() {
  const [huntReport, setHuntReport] = useState<HuntReport | null>(null);
  const [showStopped, setShowStopped] = useState(false);
  const [csvNote, setCsvNote] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const { data: deals = [], isLoading } = useQuery<AgenticDealFile[]>({
    queryKey: ["/api/agentic/deals"],
  });
  const { data: quality } = useQuery<QualityPayload>({
    queryKey: ["/api/agentic/quality"],
    refetchInterval: 15000,
  });
  const { data: runningJobs = [] } = useQuery<
    Array<{ agentId?: string; status?: string; totalSteps?: number; completedSteps?: number; currentStep?: string }>
  >({
    queryKey: ["/api/agent-jobs/running"],
    refetchInterval: 2000,
  });
  const harvestProgress = deskJobProgress(runningJobs, "harvest");

  const selectCompany = useMutation({
    mutationFn: async ({ id, companyNumber }: { id: number; companyNumber: string }) => {
      const res = await apiRequest(`/api/agentic/deals/${id}/select-company`, "POST", { companyNumber });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] }),
  });

  const resolveHuman = useMutation({
    mutationFn: async ({
      id,
      action,
      agentId,
    }: {
      id: number;
      action: "call_done" | "approve_sterling" | "stop" | "linkedin_posted" | "retry_send" | "approve_send";
      agentId?: string;
    }) => {
      const res = await apiRequest(`/api/agentic/deals/${id}/human`, "POST", { action, agentId });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] }),
  });

  const hunt = useMutation({
    mutationFn: async (): Promise<HuntReport> => {
      const res = await apiRequest("/api/agentic/scan", "POST");
      return res.json();
    },
    onSuccess: (data) => {
      setHuntReport(data);
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/quality"] });
    },
  });

  const findContact = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/agentic/deals/${id}/find-contact`, "POST");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] }),
  });

  const removeDeal = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/agentic/deals/${id}`, "DELETE");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] }),
  });

  const chaseNow = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/agentic/deals/${id}/tick`, "POST");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] }),
  });

  const keepQuarantine = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/agentic/quarantine/${id}/keep`, "POST", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/quality"] });
    },
  });

  const deleteQuarantine = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/agentic/quarantine/${id}`, "DELETE");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/quality"] });
    },
  });

  const purgeQuarantine = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/agentic/quarantine/purge", "POST");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/quality"] });
    },
  });

  const resumeGuess = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/agentic/harvest/resume-guess", "POST");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/quality"] });
    },
  });

  const uploadCsv = useMutation({
    mutationFn: async (payload: { fileName: string; csvData: string }) => {
      const res = await apiRequest("/api/agentic/harvest/csv", "POST", payload);
      return res.json() as Promise<{
        created: number;
        skipped: number;
        errors: { row: number; message: string }[];
      }>;
    },
    onSuccess: (data) => {
      const fail = data.errors.length;
      setCsvNote(
        `Harper: ${data.created} opened, ${data.skipped} already on book${
          fail ? `, ${fail} row error${fail === 1 ? "" : "s"}` : ""
        }.`
      );
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/quality"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-jobs/running"] });
    },
    onError: (error: Error) => {
      setCsvNote(error.message || "CSV upload failed");
    },
  });

  const csvPicker = (
    <>
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            uploadCsv.mutate({ fileName: file.name, csvData: String(reader.result || "") });
          };
          reader.readAsText(file);
        }}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => csvInputRef.current?.click()}
        disabled={uploadCsv.isPending}
      >
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        {uploadCsv.isPending ? "Uploading…" : "Upload CSV for Harper"}
      </Button>
    </>
  );

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading deal files…</p>;
  }

  const byWhen = (a: AgenticDealFile, b: AgenticDealFile) =>
    new Date(lastActivity(b).at).getTime() - new Date(lastActivity(a).at).getTime();
  const active = deals
    .filter(
      (deal) =>
        deal.status !== "failed" &&
        deal.status !== "complete" &&
        deal.hopper !== "quarantine" &&
        isContactableDeal(deal)
    )
    .sort(byWhen);
  const stopped = deals.filter((deal) => deal.status === "failed" || deal.status === "complete").sort(byWhen);
  const visible = showStopped ? stopped : active;

  if (deals.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">No deal files yet</CardTitle>
          <CardDescription>
            First-touch sends {SME_FIRST_TOUCH_PER_HOUR} new prospects an hour, weekdays 08:30–20:30 London. Upload a CSV for Harper to verify emails and open files. Introducer outreach is paused.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => hunt.mutate()} disabled={hunt.isPending}>
              {hunt.isPending ? "Queuing…" : "Hunt & queue mail-ready leads"}
            </Button>
            {csvPicker}
          </div>
          {csvNote && <p className="text-xs text-slate-400">{csvNote}</p>}
          {huntReport && <HuntSummary report={huntReport} />}
        </CardContent>
      </Card>
    );
  }

  const remainingThisHour = remainingSmeFirstTouchSlots({ deals });
  const sendSlot = smeFirstTouchSlot();

  return (
    <div className="space-y-4">
      {harvestProgress ? (
        <div className="rounded-lg border border-emerald-900/60 bg-slate-900 px-4 py-3 space-y-1.5" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-white">
              Harper harvesting{" "}
              <span className="text-slate-400 font-normal">{harvestProgress.current || "company mailboxes"}</span>
            </p>
            <p className="text-xs tabular-nums text-slate-500">{harvestProgress.label}</p>
          </div>
          <Progress value={harvestProgress.pct} className="h-1.5 bg-slate-800" />
        </div>
      ) : null}
      {quality ? (
        <QualityStrip
          quality={quality}
          busy={
            keepQuarantine.isPending ||
            deleteQuarantine.isPending ||
            purgeQuarantine.isPending ||
            resumeGuess.isPending
          }
          onKeep={(id) => keepQuarantine.mutate(id)}
          onDelete={(id) => deleteQuarantine.mutate(id)}
          onPurge={() => {
            if (window.confirm("Delete every quarantined lead that has no corporate mailbox?")) {
              purgeQuarantine.mutate();
            }
          }}
          onResumeGuess={() => resumeGuess.mutate()}
        />
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showStopped ? "ghost" : "secondary"}
            onClick={() => setShowStopped(false)}
          >
            Active ({active.length})
          </Button>
          <Button
            size="sm"
            variant={showStopped ? "secondary" : "ghost"}
            onClick={() => setShowStopped(true)}
          >
            Stopped ({stopped.length})
          </Button>
          {huntReport && <HuntSummary report={huntReport} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => hunt.mutate()} disabled={hunt.isPending}>
            {hunt.isPending ? "Queuing…" : "Hunt & queue mail-ready leads"}
          </Button>
          {csvPicker}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Introducer outreach is paused. SME first-touch {SME_FIRST_TOUCH_PER_HOUR}/hour weekdays 08:30–20:30 London —{" "}
        {sendSlot ? `${remainingThisHour} slot${remainingThisHour === 1 ? "" : "s"} this hour` : "outside send window"}.{" "}
        {hopperStatusLine(deals)}
      </p>
      {csvNote && <p className="text-xs text-slate-400">{csvNote}</p>}

      {visible.length === 0 && (
        <p className="text-sm text-slate-500">
          {showStopped ? "Nothing stopped." : "Nothing in flight. Hunt or wait for inbound."}
        </p>
      )}

      <Accordion type="single" collapsible className="rounded-lg border border-slate-800 bg-slate-900">
      {visible.map((deal) => {
        const activity = lastActivity(deal);
        return (
        <AccordionItem key={deal.id} value={String(deal.id)} className="border-slate-800 px-3">
          <AccordionTrigger className="group hover:no-underline py-3 gap-3 text-left items-center justify-start [&>svg]:hidden">
            <span className="text-[11px] text-slate-500 tabular-nums w-[9.75rem] shrink-0">
              {stamp(activity.at)}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-white truncate">{deal.companyName}</span>
              <ChargeHolders names={deal.chargeHolders} clamp />
              <span className="block text-xs text-slate-400 truncate">{activity.task}</span>
            </span>
            <span className="ml-auto flex items-center gap-2 shrink-0">
              <Badge variant="outline" className={`${statusTone(deal.status)} h-6 px-2 text-[11px] font-medium`}>
                {deal.status.replace("_", " ")}
              </Badge>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-slate-500 hover:text-red-300 hover:bg-red-500/10"
                title="Delete this deal file"
                disabled={removeDeal.isPending}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (window.confirm(`Delete ${deal.companyName}? This cannot be undone.`)) {
                    removeDeal.mutate(deal.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <p className="text-xs text-slate-500">
              {stamp(activity.at)}
              {" · "}
              {deal.source === "strata_inbound" ? "Inbound" : "Hunt"}
              {typeof deal.fitScore === "number" ? ` · fit ${deal.fitScore}` : ""}
              {" · "}
              {STAGE_LABELS[deal.stage]}
              {" · "}
              {deal.email || "no email"}
              {deal.phone ? ` · ${deal.phone}` : ""}
            </p>
            <p className="text-xs">
              <ChargeHolders names={deal.chargeHolders} />
            </p>
            {deal.humanReason && (
              <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                {deal.humanReason}
              </p>
            )}

            {deal.stage === "company_match" && (deal.companyCandidates || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Pick the company</p>
                {deal.companyCandidates!.map((candidate) => (
                  <div key={candidate.companyNumber} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="text-white">{candidate.companyName}</p>
                      <p className="text-xs text-slate-500">
                        {candidate.companyNumber} · {candidate.companyStatus} · {candidate.address || "no address"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selectCompany.mutate({ id: deal.id, companyNumber: candidate.companyNumber })}
                    >
                      Use this
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {needsBbb(deal) && <BbbGate deal={deal} />}

            {showPlaybook(deal) && <OutreachPlaybook deal={deal} />}

            {deal.uploadToken && (deal.stage === "fulfilment" || deal.stage === "human_call" || deal.stage === "outreach" || (deal.packDocuments?.length || 0) > 0) && (
              <div className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800 rounded-md px-3 py-2 space-y-1">
                <p>
                  Pack: {deal.packDocuments?.length || 0} file
                  {(deal.packDocuments?.length || 0) === 1 ? "" : "s"}
                  {deal.sfp?.status ? ` · ${deal.sfp.status}` : ""}
                </p>
                {namedPackGaps(deal).length > 0 && (
                  <p className="text-amber-200">Still missing: {namedPackGaps(deal).join("; ")}</p>
                )}
                <a
                  href={packUploadUrl(deal.uploadToken)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-300 hover:underline break-all"
                >
                  Upload link
                </a>
                <p>
                  {isLiveSigned(deal.engagement)
                    ? `Engagement signed by ${deal.engagement?.signedName}`
                    : "Engagement letter not signed"}
                </p>
                <a
                  href={signEngagementUrl(deal.uploadToken)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-300 hover:underline break-all"
                >
                  E-sign link
                </a>
              </div>
            )}

            {deal.sfp?.status === "COMPLETE" && deal.underwritingJudgement && (
              <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-8">{deal.underwritingJudgement}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {deal.prospectId && (
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/prospect/${deal.prospectId}`}>Pipeline</Link>
                </Button>
              )}
              {(!deal.email || !deal.phone) && deal.status !== "failed" && (
                <Button size="sm" variant="outline" onClick={() => findContact.mutate(deal.id)}>
                  Find email / phone
                </Button>
              )}
              {deal.stage === "fulfilment" && (
                <Button size="sm" variant="outline" onClick={() => chaseNow.mutate(deal.id)}>
                  Chase now
                </Button>
              )}
              {deal.stage === "human_call" && (
                <Button size="sm" onClick={() => resolveHuman.mutate({ id: deal.id, action: "call_done" })}>
                  Call done
                </Button>
              )}
              {deal.socialPlaybook && (
                <Button size="sm" variant="outline" onClick={() => resolveHuman.mutate({ id: deal.id, action: "linkedin_posted" })}>
                  LinkedIn posted
                </Button>
              )}
              {deal.humanReason?.includes("SMTP") && (
                <Button size="sm" variant="outline" onClick={() => resolveHuman.mutate({ id: deal.id, action: "retry_send" })}>
                  Retry email
                </Button>
              )}
              {deal.stage === "human_review" && (
                <Button
                  size="sm"
                  disabled={
                    namedPackGaps(deal).length > 0 ||
                    deal.sfp?.status !== "COMPLETE" ||
                    !isLiveSigned(deal.engagement)
                  }
                  title={
                    !isLiveSigned(deal.engagement)
                      ? "Client must e-sign the Privacy Notice and Terms of Business first"
                      : undefined
                  }
                  onClick={() => resolveHuman.mutate({ id: deal.id, action: "approve_sterling" })}
                >
                  Send to David
                </Button>
              )}
              {deal.status === "waiting_human" && (
                <Button size="sm" variant="ghost" onClick={() => resolveHuman.mutate({ id: deal.id, action: "stop" })}>
                  Stop
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-500 hover:text-red-300"
                disabled={removeDeal.isPending}
                onClick={() => {
                  if (window.confirm(`Delete ${deal.companyName}? This cannot be undone.`)) {
                    removeDeal.mutate(deal.id);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
        );
      })}
      </Accordion>
    </div>
  );
}
