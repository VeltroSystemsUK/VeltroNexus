import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LearnPiecePublic } from "@shared/learn";
import { LearnCatalogFailed, LearnPieceCard, PackagerLine, setLearnMeta } from "./LearnHome";

export default function LearnLibrary() {
  const { data, isLoading, isError } = useQuery<{ library: LearnPiecePublic[] }>({
    queryKey: ["/api/learn/library"],
  });

  useEffect(() => {
    setLearnMeta(
      "Library — Strata Learn",
      "Videos and articles from Strata Learn. Strata packages; it does not lend.",
    );
  }, []);

  const library = data?.library ?? [];

  if (isLoading) return <p className="text-zinc-500">Loading library…</p>;
  if (isError) return <LearnCatalogFailed />;

  if (library.length === 0) {
    return (
      <div className="py-20 space-y-4 text-center">
        <PackagerLine />
        <p className="font-['Unbounded'] text-2xl text-zinc-100">No lessons yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="font-['Unbounded'] text-3xl md:text-4xl tracking-tight">Library</h1>
        <PackagerLine />
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {library.map((piece) => (
          <LearnPieceCard key={piece.slug} piece={piece} />
        ))}
      </div>
    </div>
  );
}
