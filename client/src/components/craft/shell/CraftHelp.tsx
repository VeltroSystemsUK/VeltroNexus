import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CRAFT_HELP,
  CRAFT_HELP_DESK,
  CRAFT_HELP_RULES,
  type CraftHelpNav,
  type CraftHelpRecipeId,
} from "@shared/craftHelp";
import { useCraftStore } from "../store";

export function CraftHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [nav, setNav] = useState<CraftHelpNav>("recipes");
  const [recipeId, setRecipeId] = useState<CraftHelpRecipeId>("hook-gif");
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  if (!open) return null;
  const recipe = CRAFT_HELP.find((item) => item.id === recipeId) ?? CRAFT_HELP[0]!;
  const tickKey = (index: number) => `${recipe.id}:${index}`;

  const runStep = async (index: number) => {
    const result = await useCraftStore.getState().runCraftHelpStep(recipe.id, index);
    if (result.ok) setTicks((prev) => ({ ...prev, [tickKey(index)]: true }));
  };

  const runRemaining = async () => {
    for (let i = 0; i < recipe.steps.length; i++) {
      if (ticks[tickKey(i)]) continue;
      const result = await useCraftStore.getState().runCraftHelpStep(recipe.id, i);
      if (!result.ok) return;
      setTicks((prev) => ({ ...prev, [tickKey(i)]: true }));
    }
  };

  return (
    <div
      className="fixed top-12 right-2 z-[80] flex h-[min(36rem,calc(100vh-4rem))] w-[22rem] overflow-hidden rounded-lg border border-white/10 bg-[#12141c]/95 shadow-2xl backdrop-blur-md"
      role="dialog"
      aria-label="SWELL studio"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex w-36 shrink-0 flex-col gap-1 border-r border-white/10 p-2">
        {(["desk", "recipes", "rules"] as CraftHelpNav[]).map((id) => (
          <button
            key={id}
            type="button"
            className={cn(
              "rounded-md px-2 py-1.5 text-left text-[11px] uppercase tracking-[0.12em] text-white/70 hover:bg-white/10",
              nav === id && "bg-white/15 text-white",
            )}
            onClick={() => setNav(id)}
          >
            {id === "desk" ? "Desk" : id === "recipes" ? "Recipes" : "House rules"}
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2 border-b border-white/10 px-3 py-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">SWELL studio</p>
            <p className="text-[11px] text-white/70">Idea, then board. Export is a decision, not a default.</p>
          </div>
          <Button size="icon" variant="ghost" aria-label="Close studio help" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:thin]">
          {nav === "desk" &&
            CRAFT_HELP_DESK.map((item) => (
              <section key={item.title} className="mb-3">
                <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/45">{item.title}</h3>
                <p className="mt-1 text-xs text-white/80">{item.body}</p>
              </section>
            ))}
          {nav === "rules" &&
            CRAFT_HELP_RULES.map((item) => (
              <section key={item.title} className="mb-3">
                <h3 className="text-[10px] uppercase tracking-[0.14em] text-white/45">{item.title}</h3>
                <p className="mt-1 text-xs text-white/80">{item.body}</p>
              </section>
            ))}
          {nav === "recipes" && (
            <>
              <div className="mb-3 flex flex-wrap gap-1">
                {CRAFT_HELP.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "rounded-md px-1.5 py-1 text-[10px] text-white/75 hover:bg-white/10",
                      item.id === recipe.id && "bg-white/15 text-white ring-1 ring-white/25",
                    )}
                    onClick={() => setRecipeId(item.id)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
              <p className="mb-2 text-xs text-white/70">{recipe.outcome}</p>
              <ol className="space-y-2">
                {recipe.steps.map((step, index) => (
                  <li key={step.title} className="rounded-md border border-white/10 p-2">
                    <p className="text-[11px] font-medium text-white">
                      {ticks[tickKey(index)] ? "Done · " : `${index + 1}. `}
                      {step.title}
                    </p>
                    <p className="mt-1 text-[11px] text-white/70">{step.body}</p>
                    {step.hint && <p className="mt-1 text-[10px] text-white/45">{step.hint}</p>}
                    {step.action && (
                      <Button size="sm" variant="secondary" className="mt-2 h-7 text-[11px]" onClick={() => void runStep(index)}>
                        Run this step
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
        {nav === "recipes" && (
          <div className="flex gap-1 border-t border-white/10 p-2">
            <Button size="sm" className="h-7 text-[11px]" onClick={() => void runRemaining()}>
              Run all remaining
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setTicks({})}>
              Reset ticks
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
