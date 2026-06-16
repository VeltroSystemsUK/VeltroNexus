import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ChevronRight, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  title: string;
  detail?: string;
  cta?: string;
  to?: string;
  tone?: "accent" | "plain";
}

// Seeded contextual prompts — the cards are real (they navigate); the live
// feed will be driven by the copilot backend once wired.
const SEEDED: Suggestion[] = [
  { id: "stalling", title: "2 deals stalling over 7 days", detail: "Orbit Ltd and Vantage Co haven't moved stage. Draft chase emails?", cta: "Review pipeline", to: "/pipeline", tone: "accent" },
  { id: "apex", title: "Apex Ltd — credit ready", detail: "Underwriting analysis is complete and awaiting your decision.", cta: "Open underwriting", to: "/underwriting" },
  { id: "qualified", title: "3 prospects auto-qualified", detail: "New overnight matches surfaced by Lead Finder.", cta: "View clients", to: "/crm" },
  { id: "due", title: "2 submissions due today", detail: "Lender deadlines approaching this afternoon.", cta: "Open submissions", to: "/submissions" },
];

interface CopilotRailProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function CopilotRail({ collapsed, onToggle }: CopilotRailProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        aria-label="Open Copilot"
        className="relative z-10 hidden lg:flex w-12 shrink-0 flex-col items-center pt-5 gap-2 bg-sidebar/70 backdrop-blur-xl border-l border-white/5 text-white/60 hover:text-white transition-colors"
      >
        <Sparkles className="h-5 w-5 text-primary" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.5)]" />
      </button>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    // TODO: stream to the Anthropic copilot endpoint once it exists.
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
        <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.5)]" />
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
        {SEEDED.map((s) => (
          <button
            key={s.id}
            onClick={() => s.to && navigate(s.to)}
            className={cn(
              "w-full text-left rounded-xl p-3 border transition-all hover:-translate-y-0.5",
              s.tone === "accent"
                ? "bg-primary/[0.06] border-primary/20 hover:border-primary/40"
                : "bg-white/[0.03] border-white/[0.07] hover:border-white/15"
            )}
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                  s.tone === "accent"
                    ? "bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.45)]"
                    : "bg-white/30"
                )}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-white leading-snug">{s.title}</div>
                {s.detail && (
                  <div className="text-[12px] text-white/55 mt-1 leading-snug">{s.detail}</div>
                )}
                {s.cta && (
                  <div className="inline-flex items-center gap-1 text-[12px] text-primary mt-2 font-medium">
                    {s.cta} <ArrowRight className="h-3 w-3" />
                  </div>
                )}
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
