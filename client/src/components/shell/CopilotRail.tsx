import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ChevronRight, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { attentionFromDeals } from "@shared/attention";
import type { AgenticDealFile } from "@shared/agenticWorkflow";

interface CopilotRailProps {
  collapsed: boolean;
  onToggle: () => void;
}

function stamp(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CopilotRail({ collapsed, onToggle }: CopilotRailProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const { data: deals = [] } = useQuery<AgenticDealFile[]>({
    queryKey: ["/api/agentic/deals"],
  });
  const items = attentionFromDeals(deals);

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        aria-label="Open Copilot"
        className="relative z-10 hidden lg:flex w-12 shrink-0 flex-col items-center pt-5 gap-2 bg-sidebar/70 backdrop-blur-xl border-l border-white/5 text-white/60 hover:text-white transition-colors"
      >
        <Sparkles className="h-5 w-5 text-primary" />
        {items.length > 0 ? (
          <span className="min-w-[1.15rem] h-5 px-1 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground flex items-center justify-center">
            {items.length}
          </span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
        )}
      </button>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    toast({
      title: "Copilot",
      description: "Connecting your assistant — live answers land once the backend is wired.",
    });
    setDraft("");
  };

  return (
    <aside className="relative z-10 hidden lg:flex w-[300px] shrink-0 flex-col bg-sidebar/70 backdrop-blur-xl border-l border-white/5">
      <div className="flex items-center gap-2 px-4 h-16 border-b border-white/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-white">Copilot</span>
        {items.length > 0 && (
          <span className="text-[11px] tabular-nums text-white/45">{items.length}</span>
        )}
        <button
          onClick={onToggle}
          aria-label="Collapse Copilot"
          className="ml-auto h-7 w-7 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <div className="px-1 pb-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">
          For your attention
        </div>
        {items.length === 0 && (
          <p className="px-1 text-[13px] text-white/45 leading-snug">Nothing waiting on you.</p>
        )}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.to)}
            className={cn(
              "w-full text-left rounded-xl p-3 border transition-all hover:-translate-y-0.5",
              item.tone === "accent"
                ? "bg-primary/[0.06] border-primary/20 hover:border-primary/40"
                : "bg-white/[0.03] border-white/[0.07] hover:border-white/15"
            )}
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                  item.tone === "accent"
                    ? "bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.45)]"
                    : "bg-white/30"
                )}
              />
              <div className="min-w-0">
                <div className="text-[11px] tabular-nums text-white/40">{stamp(item.at)}</div>
                <div className="text-[13px] font-medium text-white leading-snug mt-0.5">{item.title}</div>
                <div className="text-[12px] text-white/55 mt-1 leading-snug">{item.task}</div>
                <div className="inline-flex items-center gap-1 text-[12px] text-primary mt-2 font-medium">
                  Open deal file <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 focus-within:border-primary/50 px-3 py-2 transition-colors">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask or command Veltro…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
          />
          <button
            type="submit"
            aria-label="Send to Copilot"
            disabled={!draft.trim()}
            className="h-6 w-6 rounded-md flex items-center justify-center bg-primary text-primary-foreground disabled:opacity-40"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
}
