import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { handbookPieces, isHandbookSlug, type LearnPiecePublic } from "@shared/learn";
import { LearnCatalogFailed, LearnPieceCard, PackagerLine, setLearnMeta } from "./LearnHome";
import { LearnDeskPrompts } from "./LearnDeskPrompts";

export default function LearnLibrary() {
  const { data, isLoading, isError } = useQuery<{ library: LearnPiecePublic[] }>({
    queryKey: ["/api/learn/library"],
  });

  useEffect(() => {
    setLearnMeta(
      "Library — Strata Learn",
      "Director's handbook and the rest of Strata Learn. Strata packages; it does not lend.",
    );
  }, []);

  const library = data?.library ?? [];
  const handbook = handbookPieces(library);
  const rest = library.filter((piece) => !isHandbookSlug(piece.slug));

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
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-['Unbounded'] text-xl tracking-tight">Ask the desk</h2>
          <Link href="/ask" className="text-sm text-emerald-400 hover:underline">
            Open the desk
          </Link>
        </div>
        <LearnDeskPrompts />
      </section>
      {handbook.length > 0 && (
        <section id="handbook" className="space-y-4">
          <h2 className="font-['Unbounded'] text-2xl tracking-tight">Director's handbook</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {handbook.map((piece) => (
              <LearnPieceCard key={piece.slug} piece={piece} />
            ))}
          </div>
        </section>
      )}
      {rest.length > 0 && (
        <section className="space-y-4">
          {handbook.length > 0 && (
            <h2 className="font-['Unbounded'] text-2xl tracking-tight">Other lessons</h2>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {rest.map((piece) => (
              <LearnPieceCard key={piece.slug} piece={piece} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
