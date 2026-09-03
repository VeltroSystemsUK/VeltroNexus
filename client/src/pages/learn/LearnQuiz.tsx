import { useMemo, useState } from "react";
import { scoreLearnQuiz, type LearnQuizQuestion } from "@shared/learnQuiz";

export function QuizItem({
  quiz,
  index,
  onRevealed,
  hideIndex = false,
}: {
  quiz: LearnQuizQuestion;
  index: number;
  onRevealed?: () => void;
  hideIndex?: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const result = revealed && picked != null ? scoreLearnQuiz(quiz, picked) : null;

  return (
    <fieldset className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <legend className={hideIndex ? "sr-only" : "font-['Space_Mono'] text-xs text-emerald-400"}>
        {hideIndex ? "Check" : String(index + 1).padStart(2, "0")}
      </legend>
      <p className="font-['Plus_Jakarta_Sans'] text-sm text-zinc-100">{quiz.question}</p>
      <div className="space-y-2">
        {quiz.choices.map((choice, choiceIndex) => {
          const selected = picked === choiceIndex;
          const showMark = revealed && selected;
          const tone = !showMark
            ? "border-white/10 hover:border-white/25"
            : result?.correct
              ? "border-emerald-400/60 bg-emerald-500/10"
              : "border-red-400/50 bg-red-500/10";
          return (
            <label
              key={choice.label}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm text-zinc-200 ${tone}`}
            >
              <input
                type="radio"
                className="mt-1"
                name={`learn-quiz-${index}`}
                checked={selected}
                disabled={revealed}
                onChange={() => setPicked(choiceIndex)}
              />
              <span>
                <span className="font-['Space_Mono'] text-emerald-400">{choice.label}. </span>
                {choice.text}
              </span>
            </label>
          );
        })}
      </div>
      {!revealed ? (
        <button
          type="button"
          disabled={picked == null}
          onClick={() => {
            setRevealed(true);
            onRevealed?.();
          }}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs uppercase tracking-wide text-zinc-200 disabled:opacity-40 hover:border-emerald-400/50"
        >
          Check
        </button>
      ) : (
        <p className="text-sm text-zinc-300">
          <span className={result?.correct ? "text-emerald-400" : "text-red-400"}>
            {result?.correct ? "Right." : "Not that one."}
          </span>{" "}
          {result?.explain}
        </p>
      )}
    </fieldset>
  );
}

export default function LearnQuiz({
  quizzes,
  embedded = false,
  onRevealed,
}: {
  quizzes: LearnQuizQuestion[];
  embedded?: boolean;
  onRevealed?: () => void;
}) {
  const items = useMemo(() => quizzes.filter((quiz) => quiz.choices.length >= 2), [quizzes]);
  if (!items.length) return null;
  if (embedded) {
    return (
      <div className="max-w-2xl">
        {items.map((quiz, index) => (
          <QuizItem
            key={`${quiz.question}-${index}`}
            quiz={quiz}
            index={index}
            hideIndex
            onRevealed={onRevealed}
          />
        ))}
      </div>
    );
  }
  return (
    <section className="space-y-4 max-w-2xl">
      <h2 className="font-['Unbounded'] text-xl tracking-tight">Check yourself</h2>
      <p className="text-sm text-zinc-400">
        Not stored. Not a diagnostic. Wrong answers have the explanation underneath.
      </p>
      <div className="space-y-4">
        {items.map((quiz, index) => (
          <QuizItem key={`${quiz.question}-${index}`} quiz={quiz} index={index} />
        ))}
      </div>
    </section>
  );
}
