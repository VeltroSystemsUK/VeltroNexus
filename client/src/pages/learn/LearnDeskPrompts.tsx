import { Link } from "wouter";
import { LEARN_DESK_PROMPTS } from "@shared/learnLibrarian";

export function LearnDeskPrompts({
  onPick,
}: {
  onPick?: (question: string) => void;
}) {
  const chip =
    "rounded-md border border-white/15 px-3 py-1.5 text-left text-xs text-zinc-200 hover:border-emerald-400/50 hover:text-emerald-400";
  return (
    <ul className="flex flex-wrap gap-2">
      {LEARN_DESK_PROMPTS.map((prompt) => (
        <li key={prompt.slug}>
          {onPick ? (
            <button type="button" className={chip} onClick={() => onPick(prompt.question)}>
              {prompt.question}
            </button>
          ) : (
            <Link href={`/ask?q=${encodeURIComponent(prompt.question)}`} className={`inline-block ${chip}`}>
              {prompt.question}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
