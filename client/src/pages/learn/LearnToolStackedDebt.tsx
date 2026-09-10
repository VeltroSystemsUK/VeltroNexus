import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  STACKED_DEBT_SCENARIO_POSTER,
  STACKED_DEBT_SCENARIO_VIDEO,
  clampPlayhead,
  pauseFor,
  resumeFrom,
  type ScenarioBeat,
} from "@shared/learnScenario";
import { LearnCta, PackagerLine, setLearnMeta } from "./LearnHome";
import { QuizItem } from "./LearnQuiz";

export default function LearnToolStackedDebt() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [answered, setAnswered] = useState<string[]>([]);
  const [pausedBeat, setPausedBeat] = useState<ScenarioBeat | null>(null);
  const [checked, setChecked] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setLearnMeta(
      "Stacked debt — a scenario — Strata Learn",
      "Play the film. At each beat, choose. Loan two does not pay off loan one. Strata packages; it does not lend.",
    );
  }, []);

  function holdToBeat(beat: ScenarioBeat) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = beat.pauseAt;
    setPausedBeat(beat);
    setChecked(false);
  }

  function onTime() {
    const video = videoRef.current;
    if (!video || pausedBeat) return;
    const held = clampPlayhead(video.currentTime, answered);
    if (held < video.currentTime - 0.05) {
      video.currentTime = held;
    }
    const beat = pauseFor(held, answered);
    if (beat) holdToBeat(beat);
  }

  function continueFilm() {
    if (!pausedBeat) return;
    const nextAnswered = answered.includes(pausedBeat.id) ? answered : [...answered, pausedBeat.id];
    setAnswered(nextAnswered);
    setPausedBeat(null);
    setChecked(false);
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = resumeFrom(pausedBeat);
    void video.play();
  }

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-['Space_Mono'] text-emerald-400 text-sm">Tools</p>
        <h1 className="font-['Unbounded'] text-3xl md:text-4xl tracking-tight leading-tight">
          Stacked debt — a scenario
        </h1>
        <p className="text-lg text-zinc-300 max-w-2xl">
          A UK company still trading, cash drowning. Play the film. At each beat, choose what the director does.
          The next scene is the consequence. Strata packages; it does not lend.
        </p>
        <PackagerLine />
      </header>

      <div className="relative">
        <video
          ref={videoRef}
          src={STACKED_DEBT_SCENARIO_VIDEO}
          poster={STACKED_DEBT_SCENARIO_POSTER}
          controls={!pausedBeat}
          playsInline
          preload="metadata"
          className="w-full rounded-xl bg-black aspect-video"
          onTimeUpdate={onTime}
          onSeeking={onTime}
          onPlay={() => {
            if (pausedBeat) videoRef.current?.pause();
          }}
          onEnded={() => setFinished(true)}
        />

        {pausedBeat?.quiz && (
          <div className="absolute inset-0 z-10 flex items-end overflow-auto rounded-xl bg-black/75 p-4 md:p-6">
            <div className="w-full max-w-2xl space-y-4">
              <p className="font-['Unbounded'] text-xl tracking-tight text-zinc-50">{pausedBeat.title}</p>
              <QuizItem quiz={pausedBeat.quiz} index={0} hideIndex onRevealed={() => setChecked(true)} />
              {checked && (
                <button
                  type="button"
                  onClick={continueFilm}
                  className="rounded-md bg-emerald-500 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-emerald-950 hover:bg-emerald-400"
                >
                  Continue the film
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {finished && (
        <section className="space-y-4 max-w-2xl">
          <h2 className="font-['Unbounded'] text-2xl tracking-tight">The way out is not another facility</h2>
          <p className="text-zinc-300">
            Don&apos;t stack your way out of a hole. Read the stacked-debt handbook, or put a file in front of a
            packager.
          </p>
          <PackagerLine />
          <LearnCta />
          <Link href="/read/stacked-debt" className="inline-block text-sm text-emerald-400 hover:underline">
            Handbook: stacked debt
          </Link>
        </section>
      )}
    </div>
  );
}
