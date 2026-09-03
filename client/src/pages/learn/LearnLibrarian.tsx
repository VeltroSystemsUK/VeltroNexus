import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { EXPLORE_URL, LearnCta, pieceHref, REVIEW_MAILTO } from "./LearnHome";

type Citation = { title: string; slug: string; kind: string };
type AskResult = { kind: "answer" | "handoff" | "unavailable"; text?: string; citations?: Citation[] };

export default function LearnLibrarian({ slug }: { slug?: string }) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 1 || trimmed.length > 500 || pending) return;
    setPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/learn/ask", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, slug }),
      });
      if (!res.ok) {
        setResult({ kind: "unavailable" });
        return;
      }
      const body = (await res.json()) as AskResult;
      setResult(body.kind ? body : { kind: "unavailable" });
    } catch {
      setResult({ kind: "unavailable" });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 p-6 space-y-4">
      <div>
        <h2 className="font-['Unbounded'] text-xl tracking-tight">Learn librarian</h2>
        <p className="text-sm text-zinc-400 mt-1">Answers from Strata’s published lessons only.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="sr-only" htmlFor="learn-librarian-q">
          Question
        </label>
        <textarea
          id="learn-librarian-q"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Ask about a published lesson"
          className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={pending || question.trim().length < 1}
          className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-950 disabled:opacity-50"
        >
          {pending ? "Asking…" : "Ask"}
        </button>
      </form>
      {result?.kind === "answer" && (
        <div className="space-y-3 text-sm text-zinc-200">
          {result.text && <p className="whitespace-pre-wrap">{result.text}</p>}
          {result.citations && result.citations.length > 0 && (
            <ul className="space-y-1">
              {result.citations.map((cite) => (
                <li key={`${cite.kind}-${cite.slug}`}>
                  <Link href={pieceHref(cite.kind, cite.slug)} className="text-emerald-400 hover:underline">
                    {cite.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {result?.kind === "handoff" && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">
            The librarian cannot advise on your company, figures, or eligibility. Use the assessment or request a
            10-minute review.
          </p>
          <LearnCta />
          <p className="text-xs text-zinc-500">
            <a href={EXPLORE_URL} className="underline">
              Explore
            </a>
            {" · "}
            <a href={REVIEW_MAILTO} className="underline">
              10-minute review
            </a>
          </p>
        </div>
      )}
      {result?.kind === "unavailable" && (
        <p className="text-sm text-zinc-400">The librarian is unavailable. The lessons on this page still work.</p>
      )}
    </section>
  );
}
