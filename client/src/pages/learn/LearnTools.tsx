import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ToolId } from "@shared/learnTools";
import { PackagerLine, setLearnMeta } from "./LearnHome";

export function EmailMeThis({ tool, payload }: { tool: ToolId; payload: () => Record<string, unknown> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/learn/tools/email-me", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload(), name, email, tool, marketingOptIn: optIn }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not send that email.");
      return json;
    },
  });

  if (mutation.isSuccess) {
    return <p className="text-sm text-emerald-400">Sent — check your inbox.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-white/15 px-4 py-2 text-sm text-zinc-200 hover:border-emerald-400/50"
      >
        Email me this
      </button>
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-white/10 p-5 max-w-sm">
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
      />
      <input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
      />
      <label className="flex items-start gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-1" />
        <span>Email me when Strata publishes a new post, or about a 10-minute review.</span>
      </label>
      {mutation.isError && <p className="text-sm text-red-400">{mutation.error.message}</p>}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-emerald-950 disabled:opacity-50 hover:bg-emerald-400"
      >
        {mutation.isPending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

const TOOLS = [
  {
    slug: "time-to-pay-calculator",
    title: "Time to Pay Calculator",
    description: "Estimate a monthly instalment for HMRC arrears — indicative only, not a Time to Pay offer.",
  },
  {
    slug: "debt-stress-check",
    title: "Debt Stress Check",
    description: "See your combined debt repayments against income, cost per trading day, and whether facilities are stacking.",
  },
];

export default function LearnTools() {
  useEffect(() => {
    setLearnMeta(
      "Tools — Strata Learn",
      "Calculators for UK directors: Time to Pay, and a debt stress check. Strata packages; it does not lend.",
    );
  }, []);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-['Unbounded'] text-3xl md:text-4xl tracking-tight">Tools</h1>
        <p className="text-zinc-400 max-w-2xl">
          Put your own numbers in. Nothing is sent anywhere unless you choose to email yourself a copy.
        </p>
        <PackagerLine />
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="block rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:border-emerald-400/40 transition-colors"
          >
            <h3 className="font-['Unbounded'] tracking-tight text-zinc-50 text-lg">{tool.title}</h3>
            <p className="text-zinc-400 mt-2 text-sm">{tool.description}</p>
            <p className="mt-4 text-xs uppercase tracking-wide text-emerald-400">Open</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
