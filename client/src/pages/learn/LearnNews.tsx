import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LearnPiecePublic } from "@shared/learn";
import { LearnCatalogFailed, LearnPieceCard, PackagerLine, setLearnMeta } from "./LearnHome";

export default function LearnNews() {
  const { data, isLoading, isError } = useQuery<{ news: LearnPiecePublic[] }>({
    queryKey: ["/api/learn/news"],
  });

  useEffect(() => {
    setLearnMeta(
      "News — Strata Learn",
      "Notes from the desk. Strata packages; it does not lend.",
    );
  }, []);

  const news = data?.news ?? [];

  if (isLoading) return <p className="text-zinc-500">Loading news…</p>;
  if (isError) return <LearnCatalogFailed />;

  if (news.length === 0) {
    return (
      <div className="py-20 space-y-4 text-center">
        <PackagerLine />
        <p className="font-['Unbounded'] text-2xl text-zinc-100">No posts yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-['Unbounded'] text-3xl md:text-4xl tracking-tight">News</h1>
        <p className="text-zinc-400 max-w-2xl">The channel. Comments and likes live here, not on the handbook.</p>
        <PackagerLine />
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {news.map((piece) => (
          <LearnPieceCard key={piece.slug} piece={piece} />
        ))}
      </div>
    </div>
  );
}
