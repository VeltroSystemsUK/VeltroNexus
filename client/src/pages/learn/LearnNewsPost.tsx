import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { editorialMarkdownToHtml } from "@shared/editorial";
import { parseLikedCookie, type LearnNewsCommentPublic } from "@shared/learnNews";
import { NEWS_CATEGORY_LABELS, type LearnPiecePublic } from "@shared/learn";
import { LearnCta, LearnNotFound, PackagerLine, setLearnMeta } from "./LearnHome";

type NewsPiece = LearnPiecePublic & { comments?: LearnNewsCommentPublic[] };

function cookieIds(name: string): number[] {
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(`${name}=`))
    ?.slice(`${name}=`.length);
  return parseLikedCookie(raw);
}

export default function LearnNewsPost() {
  const params = useParams<{ slug?: string }>();
  const slug = params.slug || "";
  const queryClient = useQueryClient();
  const { data: piece, isLoading, isError } = useQuery<NewsPiece>({
    queryKey: ["/api/learn/piece", "news", slug],
    enabled: Boolean(slug),
  });
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [disliked, setDisliked] = useState(false);
  const [dislikes, setDislikes] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!piece) return;
    setLearnMeta(`${piece.title} — Strata Learn`, piece.excerpt || piece.title);
    setLikes(piece.thisHelped || 0);
    setDislikes(piece.thisNotHelped || 0);
    setLiked(typeof piece.id === "number" && cookieIds("learn_news_liked").includes(piece.id));
    setDisliked(typeof piece.id === "number" && cookieIds("learn_news_disliked").includes(piece.id));
  }, [piece]);

  const likeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/learn/news/${id}/like`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("like failed");
      return (await res.json()) as { likes: number };
    },
    onSuccess: (json) => {
      setLiked(true);
      setLikes(json.likes);
    },
  });

  const dislikeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/learn/news/${id}/dislike`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("dislike failed");
      return (await res.json()) as { dislikes: number };
    },
    onSuccess: (json) => {
      setDisliked(true);
      setDislikes(json.dislikes);
    },
  });

  async function onShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: piece?.title, url });
        return;
      } catch {
        return; // user cancelled the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1500);
    } catch {
      /* clipboard unavailable; nothing to fall back to */
    }
  }

  const commentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/learn/news/${id}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, body, marketingOptIn: optIn }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Comment failed");
      return json as LearnNewsCommentPublic;
    },
    onSuccess: () => {
      setBody("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["/api/learn/piece", "news", slug] });
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!slug || isError) return <LearnNotFound />;
  if (isLoading || !piece) return <p className="text-zinc-500">Loading post…</p>;

  const comments = piece.comments ?? [];
  const canLike = typeof piece.id === "number" && !liked && !likeMutation.isPending;
  const canDislike = typeof piece.id === "number" && !disliked && !dislikeMutation.isPending;

  function onComment(event: FormEvent) {
    event.preventDefault();
    if (!piece || typeof piece.id !== "number") return;
    commentMutation.mutate(piece.id);
  }

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="font-['Space_Mono'] text-emerald-400 text-sm">
          News{piece.category && piece.category in NEWS_CATEGORY_LABELS ? ` · ${NEWS_CATEGORY_LABELS[piece.category]}` : ""}
        </p>
        <h1 className="font-['Unbounded'] text-3xl md:text-4xl tracking-tight leading-tight">{piece.title}</h1>
        {piece.excerpt && <p className="text-lg text-zinc-300 max-w-2xl">{piece.excerpt}</p>}
        <PackagerLine />
      </header>

      {piece.heroImageUrl && (
        <img src={piece.heroImageUrl} alt="" className="w-full rounded-xl max-h-[420px] object-cover" />
      )}
      <div
        className="prose prose-invert max-w-2xl prose-headings:font-['Unbounded'] prose-p:font-['Plus_Jakarta_Sans']"
        dangerouslySetInnerHTML={{ __html: editorialMarkdownToHtml(piece.body, piece.title) }}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canLike}
          onClick={() => typeof piece.id === "number" && likeMutation.mutate(piece.id)}
          aria-pressed={liked}
          className="rounded-md border border-white/15 px-4 py-2 text-sm text-zinc-200 disabled:opacity-50 hover:border-emerald-400/50"
        >
          👍 Thumbs up{likes ? ` · ${likes}` : ""}
        </button>
        <button
          type="button"
          disabled={!canDislike}
          onClick={() => typeof piece.id === "number" && dislikeMutation.mutate(piece.id)}
          aria-pressed={disliked}
          className="rounded-md border border-white/15 px-4 py-2 text-sm text-zinc-200 disabled:opacity-50 hover:border-emerald-400/50"
        >
          👎 Thumbs down{dislikes ? ` · ${dislikes}` : ""}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="rounded-md border border-white/15 px-4 py-2 text-sm text-zinc-200 hover:border-emerald-400/50"
        >
          {shareCopied ? "Link copied" : "Share"}
        </button>
      </div>

      <section className="space-y-6 max-w-2xl">
        <h2 className="font-['Unbounded'] text-xl tracking-tight">Comments</h2>
        {comments.length === 0 ? (
          <p className="text-sm text-zinc-500">No comments yet.</p>
        ) : (
          <ol className="space-y-5">
            {comments.map((row) => (
              <li key={row.id} className="border-t border-white/10 pt-4">
                <p className="font-['Space_Mono'] text-xs text-emerald-400">{row.name}</p>
                <p className="text-sm text-zinc-200 mt-1 whitespace-pre-wrap">{row.body}</p>
              </li>
            ))}
          </ol>
        )}

        <form onSubmit={onComment} className="space-y-3 rounded-xl border border-white/10 p-5">
          <p className="text-sm text-zinc-400">Display name and email. Email is never shown.</p>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
          />
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
          />
          <textarea
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            minLength={20}
            maxLength={800}
            placeholder="Write a comment (no links)"
            className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
          />
          <label className="flex items-start gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={optIn} onChange={(event) => setOptIn(event.target.checked)} className="mt-1" />
            <span>Email me when Strata publishes a new post, or about a 10-minute review.</span>
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={commentMutation.isPending}
            className="rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-emerald-950 disabled:opacity-50 hover:bg-emerald-400"
          >
            {commentMutation.isPending ? "Posting…" : "Post comment"}
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 p-6">
        <h2 className="font-['Unbounded'] text-xl tracking-tight">Next step</h2>
        <LearnCta />
      </section>
    </article>
  );
}
