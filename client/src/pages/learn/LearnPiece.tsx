import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { parseHelpedCookie, type LearnPiecePublic } from "@shared/learn";
import LearnLibrarian from "./LearnLibrarian";
import LearnLesson from "./LearnLesson";
import {
  LearnCta,
  LearnNotFound,
  LearnPlayer,
  PackagerLine,
  pieceHref,
  setLearnMeta,
} from "./LearnHome";
import type { LearnHomePayload } from "./LearnHome";

function helpedIds(): number[] {
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith("learn_helped="))
    ?.slice("learn_helped=".length);
  return parseHelpedCookie(raw);
}

export default function LearnPiece({ kind }: { kind: "video" | "article" }) {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug || "";
  const { data: piece, isLoading, isError } = useQuery<LearnPiecePublic>({
    queryKey: ["/api/learn/piece", kind, slug],
    enabled: Boolean(slug),
  });
  const { data: home } = useQuery<LearnHomePayload>({ queryKey: ["/api/learn/home"] });
  const [helped, setHelped] = useState(false);
  const [count, setCount] = useState(0);
  const [lessonDone, setLessonDone] = useState(kind === "video");

  useEffect(() => {
    if (!piece) return;
    setLearnMeta(`${piece.title} — Strata Learn`, piece.excerpt || piece.title);
    setCount(piece.thisHelped || 0);
    setHelped(typeof piece.id === "number" && helpedIds().includes(piece.id));
    setLessonDone(kind === "video");
  }, [piece, kind]);

  const mutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/learn/piece/${id}/helped`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("helped failed");
      return (await res.json()) as { thisHelped: number };
    },
    onSuccess: (body) => {
      setHelped(true);
      setCount(body.thisHelped);
    },
  });

  if (!slug || isError) return <LearnNotFound />;
  if (isLoading || !piece) return <p className="text-zinc-500">Loading lesson…</p>;

  const path = home?.path ?? [];
  const index = path.findIndex((row) => row.slug === piece.slug && row.kind === piece.kind);
  const onPath = index >= 0;
  const prev = onPath && index > 0 ? path[index - 1] : null;
  const next = onPath && index < path.length - 1 ? path[index + 1] : null;
  const canHelp = typeof piece.id === "number" && !helped && !mutation.isPending;
  const showClose = kind === "video" || lessonDone;

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        {onPath && (
          <p className="font-['Space_Mono'] text-emerald-400 text-sm">
            Lesson {piece.pathPosition ?? index + 1} of {path.length}
          </p>
        )}
        <h1 className="font-['Unbounded'] text-3xl md:text-4xl tracking-tight leading-tight">{piece.title}</h1>
        {piece.excerpt && <p className="text-lg text-zinc-300 max-w-2xl">{piece.excerpt}</p>}
        <PackagerLine />
      </header>

      {kind === "video" ? (
        <LearnPlayer
          videoUrl={piece.videoUrl}
          title={piece.title}
          fallback={piece.transcript || piece.excerpt}
        />
      ) : (
        <div className="space-y-6">
          {piece.heroImageUrl && (
            <img src={piece.heroImageUrl} alt="" className="w-full rounded-xl max-h-[420px] object-cover" />
          )}
          <LearnLesson title={piece.title} markdown={piece.body} onFinishedChange={setLessonDone} />
        </div>
      )}

      {kind === "video" && piece.transcript && (
        <details className="text-sm text-zinc-400">
          <summary className="cursor-pointer text-zinc-300">Transcript</summary>
          <p className="mt-3 whitespace-pre-wrap max-w-2xl">{piece.transcript}</p>
        </details>
      )}

      {showClose && onPath && (
        <nav className="flex justify-between gap-4 text-sm">
          {prev ? (
            <Link href={pieceHref(prev.kind, prev.slug)} className="text-emerald-400 hover:underline">
              Previous: {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={pieceHref(next.kind, next.slug)} className="text-emerald-400 hover:underline text-right">
              Next: {next.title}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {showClose && (
        <>
          <div className="space-y-3">
            <button
              type="button"
              disabled={!canHelp}
              onClick={() => typeof piece.id === "number" && mutation.mutate(piece.id)}
              className="rounded-md border border-white/15 px-4 py-2 text-sm text-zinc-200 disabled:opacity-50 hover:border-emerald-400/50"
            >
              This helped{count ? ` · ${count}` : ""}
            </button>
          </div>

          <section className="space-y-4 rounded-xl border border-white/10 p-6">
            <h2 className="font-['Unbounded'] text-xl tracking-tight">Next step</h2>
            <LearnCta />
          </section>

          <LearnLibrarian slug={piece.slug} />
        </>
      )}
    </article>
  );
}
