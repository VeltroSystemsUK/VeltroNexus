import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  displayNewsHeadline,
  handbookPieces,
  isAllowedVideoSource,
  isHandbookSlug,
  LEARN_VIDEO_PUBLIC_PREFIX,
  type LearnPiecePublic,
} from "@shared/learn";
import {
  STACKED_DEBT_SCENARIO_HREF,
  STACKED_DEBT_SCENARIO_POSTER,
  STACKED_DEBT_SCENARIO_VIDEO,
  THURSDAY_PACK_HREF,
  THURSDAY_PACK_POSTER,
} from "@shared/learnScenario";
import { LearnDeskPrompts } from "./LearnDeskPrompts";

export const EXPLORE_URL = "https://explore.stratanexus.co.uk";
export const REVIEW_MAILTO =
  "mailto:enquiries@stratafinance.co.uk?subject=Learn%20review%20request";
export const LEARN_MAIL = "learn@stratanexus.co.uk";

export type LearnHomePayload = {
  path: LearnPiecePublic[];
  library: LearnPiecePublic[];
  handbook?: LearnPiecePublic[];
  news?: LearnPiecePublic[];
};

export function pieceHref(kind: string, slug: string): string {
  if (kind === "news") return `/news/${encodeURIComponent(slug)}`;
  return kind === "article" ? `/read/${encodeURIComponent(slug)}` : `/watch/${encodeURIComponent(slug)}`;
}

export function isPromoHero(piece: LearnPiecePublic): boolean {
  return piece.pathPosition == null && (piece.slug === "promo" || piece.title.includes("Promo"));
}

export function setLearnMeta(title: string, description: string) {
  document.title = title;
  const set = (attr: "name" | "property", key: string, value: string) => {
    const selector = `meta[${attr}="${key}"]`;
    let el = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.content = value;
  };
  set("name", "description", description);
  set("property", "og:title", title);
  set("property", "og:description", description);
}

export function PackagerLine({ className = "" }: { className?: string }) {
  return (
    <p className={`font-['Plus_Jakarta_Sans'] text-sm text-zinc-400 ${className}`}>
      <span className="chrome-text font-['Unbounded']">Strata</span> packages; it does not lend.
    </p>
  );
}

function embedSrc(videoUrl: string): { type: "file" | "iframe"; src: string } | null {
  if (!isAllowedVideoSource(videoUrl)) return null;
  if (videoUrl.startsWith(LEARN_VIDEO_PUBLIC_PREFIX)) return { type: "file", src: videoUrl };
  const yt = /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/)|youtu\.be\/)([\w-]+)/i.exec(videoUrl);
  if (yt?.[1]) return { type: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vm = /vimeo\.com\/(\d+)/i.exec(videoUrl);
  if (vm?.[1]) return { type: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };
  return null;
}

export function LearnPlayer({
  videoUrl,
  title,
  fallback,
  poster,
}: {
  videoUrl: string;
  title: string;
  fallback?: string;
  poster?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const embed = embedSrc(videoUrl);
  if (!embed || failed) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-3">
        <p className="font-['Unbounded'] text-sm text-zinc-300">video unavailable</p>
        {fallback ? <p className="text-sm text-zinc-400 whitespace-pre-wrap">{fallback}</p> : null}
      </div>
    );
  }
  if (embed.type === "file") {
    return (
      <video
        src={embed.src}
        poster={poster || undefined}
        controls
        playsInline
        preload="metadata"
        className="w-full rounded-xl bg-black aspect-video"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <iframe
      src={embed.src}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="w-full rounded-xl bg-black aspect-video border-0"
    />
  );
}

export function LearnCatalogFailed() {
  return (
    <div className="py-20 space-y-4 text-center">
      <p className="font-['Unbounded'] text-2xl text-zinc-100">Could not load lessons.</p>
      <PackagerLine />
      <div className="flex justify-center">
        <LearnCta />
      </div>
    </div>
  );
}

export function LearnCta() {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <a
        href={EXPLORE_URL}
        className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-emerald-950 hover:bg-emerald-400"
      >
        Start the 60-second assessment
      </a>
      <a
        href={REVIEW_MAILTO}
        className="inline-flex items-center justify-center rounded-md border border-white/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-200 hover:border-emerald-400/50"
      >
        Request a 10-minute review
      </a>
    </div>
  );
}

export function LearnNotFound() {
  useEffect(() => {
    setLearnMeta("Not found — Strata Learn", "That lesson is not on Learn.");
  }, []);
  return (
    <div className="py-24 text-center space-y-4">
      <h1 className="font-['Unbounded'] text-3xl tracking-tight">Not found</h1>
      <PackagerLine className="justify-center" />
      <p className="text-zinc-400">That lesson is not on Learn.</p>
      <Link href="/" className="text-emerald-400 hover:underline">
        Back to Learn
      </Link>
    </div>
  );
}

export function FilmCard({ featured = false }: { featured?: boolean }) {
  return (
    <Link
      href={STACKED_DEBT_SCENARIO_HREF}
      className={`relative overflow-hidden block rounded-xl border border-white/10 bg-white/[0.03] hover:border-emerald-400/40 transition-colors ${
        featured ? "p-8 md:p-10" : "p-5"
      }`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${STACKED_DEBT_SCENARIO_POSTER})` }}
      />
      <div className="relative">
        <span className="font-['Space_Mono'] text-emerald-400 text-sm">The film</span>
        <h2
          className={`font-['Unbounded'] tracking-tight text-zinc-50 mt-2 ${
            featured ? "text-3xl md:text-4xl" : "text-lg"
          }`}
        >
          Stacked debt
        </h2>
        <p className={`text-zinc-400 mt-2 ${featured ? "text-base max-w-2xl" : "text-sm"}`}>
          Play the film. At each beat, choose. Loan two does not pay off loan one.
        </p>
        <p className="mt-4 text-xs uppercase tracking-wide text-emerald-400">Watch</p>
      </div>
    </Link>
  );
}

export function ScenarioCard({ featured = false }: { featured?: boolean }) {
  return (
    <a
      href={THURSDAY_PACK_HREF}
      className={`relative overflow-hidden block rounded-xl border border-white/10 bg-white/[0.03] hover:border-emerald-400/40 transition-colors ${
        featured ? "p-8 md:p-10" : "p-5"
      }`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${THURSDAY_PACK_POSTER})` }}
      />
      <div className="relative">
        <span className="font-['Space_Mono'] text-emerald-400 text-sm">Scenario</span>
        <h2
          className={`font-['Unbounded'] tracking-tight text-zinc-50 mt-2 ${
            featured ? "text-3xl md:text-4xl" : "text-lg"
          }`}
        >
          The Thursday Pack
        </h2>
        <p className={`text-zinc-400 mt-2 ${featured ? "text-base max-w-2xl" : "text-sm"}`}>
          Payroll is Friday. A call-centre broker has an offer. Sit down, click a picture, and choose. Not every
          broker is the same. Map the stack. Time to Pay. One structure.
        </p>
        <p className="mt-4 text-xs uppercase tracking-wide text-emerald-400">Play</p>
      </div>
    </a>
  );
}

export function LearnPieceCard({
  piece,
  featured = false,
}: {
  piece: LearnPiecePublic;
  featured?: boolean;
}) {
  const href = pieceHref(piece.kind, piece.slug);
  const action = piece.kind === "news" ? "News" : piece.kind === "article" ? "Read" : "Watch";
  const headline =
    piece.kind === "news" ? displayNewsHeadline(piece.title, piece.category, piece.body) : piece.title;
  const showBackgroundImage = piece.kind === "news" && Boolean(piece.heroImageUrl);
  return (
    <Link
      href={href}
      className={`relative overflow-hidden block rounded-xl border border-white/10 bg-white/[0.03] hover:border-emerald-400/40 transition-colors ${
        featured ? "p-8 md:p-10" : "p-5"
      }`}
    >
      {showBackgroundImage && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: `url(${piece.heroImageUrl})` }}
        />
      )}
      <div className="relative">
        {piece.pathPosition != null && (
          <span className="font-['Space_Mono'] text-emerald-400 text-sm">
            {String(piece.pathPosition).padStart(2, "0")}
          </span>
        )}
        <h3
          className={`font-['Unbounded'] tracking-tight text-zinc-50 mt-2 ${
            featured ? "text-3xl md:text-4xl" : "text-lg"
          }`}
        >
          {headline}
        </h3>
        {piece.excerpt && (
          <p className={`text-zinc-400 mt-2 ${featured ? "text-base max-w-2xl" : "text-sm line-clamp-2"}`}>
            {piece.excerpt}
          </p>
        )}
        <p className="mt-4 text-xs uppercase tracking-wide text-emerald-400">
          {action}
          {piece.durationLabel ? ` · ${piece.durationLabel}` : ""}
          {piece.kind === "news" && piece.publishedAt
            ? ` · ${new Date(piece.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
            : ""}
        </p>
      </div>
    </Link>
  );
}

const HOME_DESCRIPTION =
  "Training and a director's handbook for UK companies in trouble: warehouse brokers, hidden commissions, HMRC Time to Pay, terms to refuse, and where real help sits. Strata packages; it does not lend.";

export default function LearnHome() {
  const { data, isLoading, isError } = useQuery<LearnHomePayload>({ queryKey: ["/api/learn/home"] });

  useEffect(() => {
    setLearnMeta("Strata Learn", HOME_DESCRIPTION);
  }, []);

  if (isLoading) {
    return <p className="text-zinc-500">Loading lessons…</p>;
  }

  if (isError) {
    return <LearnCatalogFailed />;
  }

  const path = data?.path ?? [];
  const library = data?.library ?? [];
  const hero = library.find(isPromoHero);
  const handbook = data?.handbook?.length ? data.handbook : handbookPieces(library);
  const news = data?.news ?? [];
  const libraryRest = library.filter((piece) => piece !== hero && !isHandbookSlug(piece.slug));
  const empty = path.length === 0 && library.length === 0;

  if (empty) {
    return (
      <div className="py-20 space-y-4 text-center">
        <PackagerLine />
        <p className="font-['Unbounded'] text-2xl text-zinc-100">No lessons yet.</p>
      </div>
    );
  }

  const lesson1 = path.find((piece) => piece.pathPosition === 1) ?? null;
  const restPath = path.filter((piece) => piece !== lesson1);

  return (
    <div className="space-y-16">
      <section className="space-y-4">
        <h1 className="font-['Unbounded'] text-4xl md:text-5xl tracking-tight leading-[1.1]">
          <span className="chrome-text">Strata</span> Learn
        </h1>
        <p className="text-lg text-zinc-300 max-w-2xl">
          Training for UK directors dealing with stacked short-term finance and HMRC commitments.
          The handbook is a reference if the company is already facing difficulties.
        </p>
        <PackagerLine />
      </section>

      <section className="space-y-3">
        <p className="font-['Space_Mono'] text-emerald-400 text-sm">The film</p>
        <LearnPlayer
          videoUrl={hero?.videoUrl || STACKED_DEBT_SCENARIO_VIDEO}
          title={hero?.title || "Stacked short-term debt"}
          fallback={hero?.transcript || hero?.excerpt}
          poster={hero?.heroImageUrl || STACKED_DEBT_SCENARIO_POSTER}
        />
        <p className="text-sm text-zinc-500">
          {hero?.title || "Stacked short-term debt. Loan two does not pay off loan one."}
        </p>
        <Link href={STACKED_DEBT_SCENARIO_HREF} className="inline-block text-sm text-emerald-400 hover:underline">
          Play with pauses
        </Link>
      </section>

      <section>
        <ScenarioCard featured />
      </section>

      {path.length > 0 && (
        <section className="space-y-6">
          <h2 className="font-['Unbounded'] text-2xl tracking-tight">Start here</h2>
          {lesson1 && <LearnPieceCard piece={lesson1} featured />}
          {restPath.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {restPath.map((piece) => (
                <LearnPieceCard key={piece.slug} piece={piece} />
              ))}
            </div>
          )}
        </section>
      )}

      {news.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-['Unbounded'] text-2xl tracking-tight">News</h2>
            <Link href="/news" className="text-sm text-emerald-400 hover:underline">
              All posts
            </Link>
          </div>
          <p className="text-sm text-zinc-400 max-w-2xl">Notes from the desk. Comments and likes on this lane only.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {news.slice(0, 4).map((piece) => (
              <LearnPieceCard key={piece.slug} piece={piece} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-['Unbounded'] text-2xl tracking-tight">Ask the desk</h2>
          <Link href="/ask" className="text-sm text-emerald-400 hover:underline">
            Open the desk
          </Link>
        </div>
        <p className="text-sm text-zinc-400 max-w-2xl">
          Questions the handbook can actually answer. Not your turnover, not eligibility, not a rate.
        </p>
        <LearnDeskPrompts />
      </section>

      {handbook.length > 0 && (
        <section id="handbook" className="space-y-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-['Unbounded'] text-2xl tracking-tight">Director's handbook</h2>
            <Link href="/library#handbook" className="text-sm text-emerald-400 hover:underline">
              All nine
            </Link>
          </div>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Brokers, hidden commissions, HMRC Time to Pay, terms to refuse, products that finish companies,
            what the courts expect of a director, and help that is actually there.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {handbook.map((piece) => (
              <LearnPieceCard key={piece.slug} piece={piece} />
            ))}
          </div>
        </section>
      )}

      {libraryRest.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-['Unbounded'] text-2xl tracking-tight">Library</h2>
            <Link href="/library" className="text-sm text-emerald-400 hover:underline">
              All lessons
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {libraryRest.map((piece) => (
              <LearnPieceCard key={piece.slug} piece={piece} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
