import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save, Mail, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  stream: "sme" | "introducer" | "inbound";
  day: number;
  channel: string;
  job: string;
  defaultTemplate: { subject: string; body: string; purpose: string };
  override: { subject?: string; body?: string; purpose?: string } | null;
  effective: { subject: string; body: string; purpose: string };
};

type TemplateResponse = { templates: Template[]; placeholders: string[] };

export function AgentOutreachTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ subject: "", body: "", purpose: "" });
  const { data, isLoading } = useQuery<TemplateResponse>({ queryKey: ["/api/agentic/outreach-templates"] });

  const selected = useMemo(
    () => data?.templates.find((template) => template.id === selectedId) || data?.templates[0],
    [data, selectedId],
  );

  const loadTemplate = (template: Template) => {
    setSelectedId(template.id);
    const source = template.override || template.defaultTemplate;
    setDraft({ subject: source.subject, body: source.body, purpose: source.purpose });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a template first");
      const response = await apiRequest(`/api/agentic/outreach-templates/${selected.id}`, "PUT", draft);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/outreach-templates"] });
      toast({ title: "Template saved", description: "New agent sends will use this version." });
    },
    onError: (error: any) => toast({ title: "Save failed", description: error.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a template first");
      await apiRequest(`/api/agentic/outreach-templates/${selected.id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agentic/outreach-templates"] });
      if (selected) loadTemplate({ ...selected, override: null });
      toast({ title: "Restored built-in copy", description: "The original agent template is active again." });
    },
    onError: (error: any) => toast({ title: "Reset failed", description: error.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8 text-sm text-slate-400">Loading outreach templates…</div>;

  return (
    <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">Agent sends</CardTitle>
          <CardDescription>Every editable template used by the live cadence.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[32rem]">
            <div className="space-y-1 p-2">
              {(data?.templates || []).map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => loadTemplate(template)}
                  className={cn(
                    "w-full rounded-md border px-3 py-3 text-left transition-colors",
                    selected?.id === template.id ? "border-primary/60 bg-primary/10" : "border-transparent hover:bg-slate-800",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">{template.id}</span>
                    {template.override && <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/30">Edited</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">Day {template.day} · {template.stream} · {template.channel}</div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {selected && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-white"><Mail className="h-4 w-4 text-primary" />{selected.id}</CardTitle>
                <CardDescription className="mt-1">{selected.job}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => resetMutation.mutate()} disabled={!selected.override || resetMutation.isPending}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />Reset default
                </Button>
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}Save template
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
              Personalisation placeholders: {(data?.placeholders || []).map((placeholder) => <code key={placeholder} className="mx-1 text-primary">{placeholder}</code>)}
            </div>
            <label className="block space-y-2"><span className="text-xs font-medium uppercase tracking-wide text-slate-400">Subject</span><Input value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))} className="bg-slate-950 border-slate-700" /></label>
            <label className="block space-y-2"><span className="text-xs font-medium uppercase tracking-wide text-slate-400">Purpose / internal note</span><Input value={draft.purpose} onChange={(event) => setDraft((current) => ({ ...current, purpose: event.target.value }))} className="bg-slate-950 border-slate-700" /></label>
            <label className="block space-y-2"><span className="text-xs font-medium uppercase tracking-wide text-slate-400">Plain-text body</span><Textarea value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} className="min-h-[24rem] bg-slate-950 border-slate-700 font-mono text-sm leading-relaxed" /></label>
            <p className="text-xs text-slate-500">The agent automatically adds its mailbox signature. Cold-email templates also retain the required stop line.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
