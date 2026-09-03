import { useEffect, useMemo, useRef, useState } from "react";
import { editorialMarkdownToHtml } from "@shared/editorial";
import { parseLearnLesson } from "@shared/learnQuiz";
import LearnQuiz from "./LearnQuiz";

export default function LearnLesson({
  title,
  markdown,
  onFinishedChange,
}: {
  title: string;
  markdown: string;
  onFinishedChange?: (finished: boolean) => void;
}) {
  const steps = useMemo(() => parseLearnLesson(markdown), [markdown]);
  const interactive = steps.some((step) => step.kind === "quiz");
  const [index, setIndex] = useState(0);
  const [quizReady, setQuizReady] = useState(false);
  const [finished, setFinished] = useState(!interactive);

  useEffect(() => {
    setIndex(0);
    setQuizReady(false);
    setFinished(!interactive);
  }, [markdown, interactive]);

  useEffect(() => {
    onFinishedChange?.(finished);
  }, [finished, onFinishedChange]);

  const skipScroll = useRef(true);
  useEffect(() => {
    if (!interactive) return;
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    document.getElementById("lesson-beat")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [index, interactive]);

  if (!interactive) {
    return (
      <div
        className="prose prose-invert max-w-2xl prose-headings:font-['Unbounded'] prose-p:font-['Plus_Jakarta_Sans']"
        dangerouslySetInnerHTML={{ __html: editorialMarkdownToHtml(markdown, title) }}
      />
    );
  }

  const step = steps[index];
  if (!step) return null;
  const total = steps.length;
  const canAdvance = step.kind === "copy" || quizReady || finished;
  const last = index === total - 1;

  function go(delta: number) {
    if (delta < 0) {
      setFinished(false);
      setQuizReady(false);
      setIndex((current) => Math.max(0, current + delta));
      return;
    }
    if (last) {
      setFinished(true);
      return;
    }
    setQuizReady(false);
    setIndex((current) => current + 1);
  }

  const kicker = step.kind === "copy" ? step.title : "Check";

  return (
    <div id="lesson-beat" className="space-y-8 max-w-2xl">
      <div className="space-y-3">
        <p className="font-['Space_Mono'] text-sm text-emerald-400">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          <span className="text-zinc-500"> · {kicker}</span>
        </p>
        <div className="h-px w-full bg-white/10">
          <div
            className="h-px bg-emerald-400 transition-[width] duration-300"
            style={{ width: `${((finished ? total : index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {step.kind === "copy" ? (
        <div
          className="prose prose-invert max-w-none prose-headings:font-['Unbounded'] prose-p:font-['Plus_Jakarta_Sans']"
          dangerouslySetInnerHTML={{ __html: editorialMarkdownToHtml(step.markdown, step.title) }}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">Not stored. Wrong answers still explain themselves.</p>
          <LearnQuiz
            key={index}
            quizzes={[step.quiz]}
            embedded
            onRevealed={() => setQuizReady(true)}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => go(-1)}
          className="rounded-md border border-white/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-200 disabled:opacity-30 hover:border-emerald-400/50"
        >
          Back
        </button>
        {finished ? (
          <p className="font-['Space_Mono'] text-xs text-emerald-400">That's the lesson.</p>
        ) : (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => go(1)}
            className="rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-emerald-950 disabled:opacity-30 hover:bg-emerald-400"
          >
            {last ? "Finish" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}
