import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Headphones, PhoneCall } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/context/LayoutContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { OutreachPlaybook } from "@/components/agentic/OutreachPlaybook";
import { ENGAGEMENT_MODEL } from "@shared/strataOutreach";
import { dealStream } from "@shared/salesOs";
import type { AgenticDealFile } from "@shared/agenticWorkflow";

type Mode = "outreach" | "service";

export default function CallCentre({ mode }: { mode: Mode }) {
  const isOutreach = mode === "outreach";
  usePageTitle(
    isOutreach ? "Outreach" : "Customer Service",
    isOutreach
      ? "Stream A 14-day and Stream B 10-day cadences. Close-call scripts land here."
      : "Warm inbound calls — pack chase with a fixed structure."
  );

  const { data: deals = [], isLoading } = useQuery<AgenticDealFile[]>({
    queryKey: ["/api/agentic/deals"],
  });

  const queue = deals.filter((deal) =>
    isOutreach
      ? deal.source !== "strata_inbound" &&
        ["outreach", "fulfilment", "human_call", "failed"].includes(deal.stage)
      : deal.source === "strata_inbound" && deal.stage === "human_call"
  );

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = queue.find((deal) => deal.id === selectedId) || queue[0];

  const resolveHuman = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "call_done" | "stop" }) => {
      const res = await apiRequest(`/api/agentic/deals/${id}/human`, "POST", { action });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] }),
  });

  const selectedStream = selected ? dealStream(selected.source, selected.stream) : "sme";
  const cadence = !isOutreach
    ? ENGAGEMENT_MODEL.inbound
    : selectedStream === "introducer"
      ? ENGAGEMENT_MODEL.introducer
      : ENGAGEMENT_MODEL.sme;

  return (
    <div className="p-5 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <div>
        <div className="flex gap-2 items-center text-primary text-sm font-medium mb-2">
          {isOutreach ? <PhoneCall className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
          {isOutreach ? "SALES OS CADENCE" : "WARM INBOUND CALLS"}
        </div>
        <h1 className="text-base md:text-lg font-semibold text-white uppercase">
          {isOutreach ? "Outreach" : "Customer Service"}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          {isOutreach
            ? "Stream A (SME directors): 14 days, email → LinkedIn → case study → close call. Stream B (introducers): 10 days, email → LinkedIn → partner call. Agents send the emails; LinkedIn copy and close-call scripts land in this queue."
            : "You only speak to people who already enquired at stratafinance.co.uk. Diagnose the stack / HMRC / cashflow / bank decline, then get the three-item pack."}
        </p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label={isOutreach ? "Files in sequence" : "Warm calls waiting"} value={String(queue.length)} icon={Clock3} />
        <Metric
          label="Live inbound"
          value={String(deals.filter((deal) => deal.source === "strata_inbound" && deal.status !== "failed").length)}
          icon={Headphones}
        />
        <Metric
          label="Hunt files"
          value={String(deals.filter((deal) => deal.source === "distress_scan" && deal.status !== "failed").length)}
          icon={PhoneCall}
        />
        <Metric
          label="Parked / stopped"
          value={String(deals.filter((deal) => deal.status === "failed").length)}
          icon={AlertTriangle}
        />
      </div>

      <Tabs defaultValue="queue" className="space-y-5">
        <TabsList className="bg-white/[.04] border border-white/10">
          <TabsTrigger value="queue">{isOutreach ? "Sequence" : "Call queue"}</TabsTrigger>
          <TabsTrigger value="playbook">Scripts</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="m-0 space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading files…</p>}
          {!isLoading && queue.length === 0 && (
            <Card className="border-white/10 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base">Nothing in this queue</CardTitle>
                <CardDescription>
                  {isOutreach
                    ? "When Opportunity Hunter opens a Stream A or Stream B file, Sales Outreach starts the OS cadence here."
                    : "When a Strata enquiry has been chased and the pack is still empty, the warm-call script lands here."}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          {queue.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.2fr] gap-5">
              <Card className="border-white/10 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-base">{isOutreach ? "Agent sequence" : "Warm inbound"}</CardTitle>
                  <CardDescription>
                    {isOutreach ? "Emails auto-send. LinkedIn and close calls wait here." : "Call these. Script is on the right."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-white/10">
                  {queue.map((deal) => (
                    <button
                      key={deal.id}
                      onClick={() => setSelectedId(deal.id)}
                      className={`block w-full p-4 text-left hover:bg-white/[.04] ${
                        selected?.id === deal.id ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">{deal.companyName}</p>
                          <p className="text-sm text-muted-foreground">
                            {deal.contactName || "Director"} · {deal.phone || "no phone"} · {deal.email || "no email"}
                          </p>
                        </div>
                        <Badge variant="outline">{deal.stage.replace("_", " ")}</Badge>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
              {selected && (
                <Card className="border-white/10 bg-card/60">
                  <CardHeader>
                    <CardTitle className="text-base">{selected.companyName}</CardTitle>
                    <CardDescription>
                      {selected.contactName || "Director"}
                      {selected.phone ? ` · ${selected.phone}` : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <OutreachPlaybook deal={selected} />
                    <div className="flex flex-wrap gap-2">
                      {selected.prospectId && (
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/prospect/${selected.prospectId}`}>Open pipeline lead</Link>
                        </Button>
                      )}
                      {selected.stage === "human_call" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => resolveHuman.mutate({ id: selected.id, action: "call_done" })}
                          >
                            Call done — continue
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resolveHuman.mutate({ id: selected.id, action: "stop" })}
                          >
                            Stop file
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="playbook" className="m-0 space-y-4">
          <Card className="border-white/10 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">Nexus Sales OS cadence</CardTitle>
              <CardDescription>
                One job per touch. Honest claims only. PECR stop line on every cold email. Stop on opt-out or a second no.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {cadence.map((step, index) => (
                <div key={`${step.channel}-${index}`} className="rounded-lg border border-white/10 px-3 py-2">
                  <p className="text-sm text-white">
                    Day {step.day} · {step.channel}
                  </p>
                  <p className="text-sm text-muted-foreground">{step.job}</p>
                </div>
              ))}
              <div className="flex gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                {isOutreach
                  ? "Stream A leads with cash-flow relief and a 10-minute debt-schedule review. Stream B leads with a CDFI packaging partnership. First email does not request a pack."
                  : "The call confirms they enquired, diagnoses the four Strata problems, then asks for the three-item pack."}
              </div>
              <div className="flex gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                {isOutreach
                  ? "LinkedIn is staged for you. The close touch queues the OS voice script. After two refusals, park the file."
                  : "If they refuse twice, stop. Do not turn a warm inbound into a chase campaign."}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock3 }) {
  return (
    <Card className="border-white/10 bg-card/60">
      <CardContent className="pt-5 flex justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-white">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </CardContent>
    </Card>
  );
}
