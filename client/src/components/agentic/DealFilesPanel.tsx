import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { STAGE_LABELS, type AgenticDealFile } from "@shared/agenticWorkflow";
import { namedPackGaps } from "@shared/sterlingCompleteness";
import { packUploadUrl } from "@shared/strataOutreach";
import {
  isWaitingSmeEmailApproval,
  remainingSmeFirstTouchSlots,
  SME_DAILY_FIRST_TOUCH_CAP,
} from "@shared/smeOutreach";
import { hopperStatusLine } from "@shared/smeHopper";
import { Link } from "wouter";
import { ChevronDown, Trash2 } from "lucide-react";
import { OutreachPlaybook } from "./OutreachPlaybook";
import { BbbGate } from "./BbbGate";

type HuntReport = {
  opened: number;
  scanned: number;
  rejectedTotal: number;
  rejected: Record<string, number>;
};

function HuntSummary({ report }: { report: HuntReport }) {
  const topRejects = Object.entries(report.rejected || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${count} ${reason}`)
    .join("; ");
  return (
    <p className="text-xs text-slate-500">
      Last queue: looked at {report.scanned} Leads, staged {report.opened} SME first-touch drafts.
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
  const { data: deals = [], isLoading } = useQuery<AgenticDealFile[]>({
    queryKey: ["/api/agentic/deals"],
  });

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
    }: {
      id: number;
      action: "call_done" | "approve_sterling" | "stop" | "linkedin_posted" | "retry_send" | "approve_send";
    }) => {
      const res = await apiRequest(`/api/agentic/deals/${id}/human`, "POST", { action });
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

  const approveQueue = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/agentic/outreach/approve-queue", "POST");
      return res.json() as Promise<{ sent: number; held: number }>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] }),
  });

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading deal files…</p>;
  }

  const byWhen = (a: AgenticDealFile, b: AgenticDealFile) =>
    new Date(lastActivity(b).at).getTime() - new Date(lastActivity(a).at).getTime();
  const active = deals.filter((deal) => deal.status !== "failed" && deal.status !== "complete").sort(byWhen);
  const stopped = deals.filter((deal) => deal.status === "failed" || deal.status === "complete").sort(byWhen);
  const visible = showStopped ? stopped : active;

  if (deals.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">No deal files yet</CardTitle>
          <CardDescription>
            Queue up to {SME_DAILY_FIRST_TOUCH_CAP} personalised SME first-touch drafts from Leads. Nothing sends until you approve it. Introducer outreach is paused.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => hunt.mutate()} disabled={hunt.isPending}>
            {hunt.isPending ? "Queuing…" : "Queue SME emails"}
          </Button>
          {huntReport && <HuntSummary report={huntReport} />}
        </CardContent>
      </Card>
    );
  }

  const waitingEmails = deals.filter(isWaitingSmeEmailApproval);
  const remainingToday = remainingSmeFirstTouchSlots({ deals });

  return (
    <div className="space-y-4">
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
          {waitingEmails.length > 0 && (
            <Button
              size="sm"
              onClick={() => approveQueue.mutate()}
              disabled={approveQueue.isPending}
            >
              {approveQueue.isPending ? "Sending…" : `Approve & send ${waitingEmails.length}`}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => hunt.mutate()} disabled={hunt.isPending}>
            {hunt.isPending ? "Queuing…" : "Queue SME emails"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Introducer outreach is paused. SME first-touch cap {SME_DAILY_FIRST_TOUCH_CAP}/day — {waitingEmails.length} waiting approval, {remainingToday} slots left today.{" "}
        {hopperStatusLine(deals)}
      </p>

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
              {deal.humanReason?.includes("LinkedIn") && (
                <Button size="sm" onClick={() => resolveHuman.mutate({ id: deal.id, action: "linkedin_posted" })}>
                  LinkedIn posted
                </Button>
              )}
              {deal.humanReason?.includes("SMTP") && (
                <Button size="sm" variant="outline" onClick={() => resolveHuman.mutate({ id: deal.id, action: "retry_send" })}>
                  Retry email
                </Button>
              )}
              {isWaitingSmeEmailApproval(deal) && (
                <Button size="sm" onClick={() => resolveHuman.mutate({ id: deal.id, action: "approve_send" })}>
                  Approve & send
                </Button>
              )}
              {deal.stage === "human_review" && (
                <Button
                  size="sm"
                  disabled={namedPackGaps(deal).length > 0 || deal.sfp?.status !== "COMPLETE"}
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
