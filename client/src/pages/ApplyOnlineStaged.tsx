/**
 * Staged / gated variant of ApplyOnline.tsx.
 *
 * Same token-based case (/api/apply/:token), same field catalogue
 * (@shared/applicationDataFields — the single source of truth also used by
 * ApplyOnline.tsx, the missing-info email, and the per-CDFI seed, see that
 * file's header comment), same FieldInput renderer. The only difference is
 * presentation: one section at a time behind a "Continue" that's blocked
 * until that section's required fields are filled, instead of one long
 * scroll. Not wired into App.tsx yet — ponytail: routing/rollout is a
 * product decision (replace ApplyOnline entirely vs. A/B vs. per-lender),
 * left for that to be wired up deliberately rather than guessed here.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Plus, Shield, Trash2, Upload } from "lucide-react";
import {
  APPLICATION_SECTIONS,
  DIRECTOR_SECTIONS,
  missingRequiredDirectorFields,
  missingRequiredFields,
  type ApplicationAnswers,
  type ApplicationDirector,
  type ApplicationSection,
} from "@shared/applicationDataFields";
import { FieldInput, newDirectorId, readApply, type ApplyState } from "@/pages/ApplyOnline";

type Stage =
  | { kind: "section"; section: ApplicationSection }
  | { kind: "directors" }
  | { kind: "review" }
  | { kind: "sign" };

const STAGES: Stage[] = [
  ...APPLICATION_SECTIONS.map((section): Stage => ({ kind: "section", section })),
  { kind: "directors" },
  { kind: "review" },
  { kind: "sign" },
];

function stageTitle(stage: Stage): string {
  if (stage.kind === "section") return stage.section.title;
  if (stage.kind === "directors") return "Directors / owners";
  if (stage.kind === "review") return "Review";
  return "Sign & send";
}

function isBlank(value: string | undefined): boolean {
  return !value || !value.trim();
}

export default function ApplyOnlineStaged() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["/api/apply", token], [token]);
  const [answers, setAnswers] = useState<ApplicationAnswers>({});
  const [directors, setDirectors] = useState<ApplicationDirector[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [signName, setSignName] = useState("");
  const [signTitle, setSignTitle] = useState("");
  const seeded = useRef(false);

  const [stageIndex, setStageIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<ApplyState>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/apply/${encodeURIComponent(token)}`);
      return readApply(res);
    },
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (data && !seeded.current) {
      setAnswers(data.answers);
      setDirectors(data.directors.length ? data.directors : [{ id: newDirectorId() } as ApplicationDirector]);
      if (data.directors[0]?.fullName) setSignName(data.directors[0].fullName);
      seeded.current = true;
    }
  }, [data]);

  const submit = useMutation({
    mutationFn: async (sign?: { name: string; title?: string }) => {
      const res = await fetch(`/api/apply/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, directors, sign }),
      });
      return readApply(res);
    },
    onSuccess: (state) => {
      queryClient.setQueryData(queryKey, state);
      setNotice(null);
    },
    onError: (err: any) => setNotice(err.message || "Could not save your application"),
  });

  if (!token || error) {
    const message = error instanceof Error ? error.message : "This application link is not valid.";
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <Shield className="h-8 w-8 text-violet-300 mx-auto" />
          <h1 className="text-xl font-semibold">{message}</h1>
          <p className="text-slate-400 text-sm">
            Ask Maya to send the email again, or write to enquiries@stratafinance.co.uk.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
      </div>
    );
  }

  const sectionMissing = missingRequiredFields(answers);
  const directorGaps = missingRequiredDirectorFields(directors);
  const totalMissing =
    sectionMissing.length + directorGaps.perDirector.reduce((n, d) => n + d.missing.length, 0) + (directorGaps.noDirectors ? 1 : 0);

  const stage = STAGES[stageIndex];
  const isLast = stageIndex === STAGES.length - 1;

  function gapsForStage(s: Stage): string[] {
    if (s.kind === "section") {
      return s.section.fields.filter((f) => f.required && isBlank(answers[f.id])).map((f) => f.label);
    }
    if (s.kind === "directors") {
      if (directorGaps.noDirectors) return ["At least one director / owner"];
      return directorGaps.perDirector.flatMap((d) => d.missing.map((f) => f.label));
    }
    return [];
  }

  function goTo(index: number) {
    setStageIndex(Math.max(0, Math.min(STAGES.length - 1, index)));
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleContinue() {
    const gaps = gapsForStage(stage);
    if (gaps.length > 0) {
      setNotice(`Still needed: ${gaps.join(", ")}`);
      return;
    }
    setNotice(null);
    setFurthest((f) => Math.max(f, stageIndex + 1));
    goTo(stageIndex + 1);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-32">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <img src="/images/strata-finance-logo.png" alt="Strata Finance" className="h-10 w-auto" />
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> Secure application
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <p className="text-sm text-violet-200">Hi {data.contactFirstName}</p>
          <h1 className="text-2xl font-bold mt-1">Complete {data.companyName}'s application</h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">
            Most of this is already filled in from what you've told us. The rest is what your lender needs before
            they can look at the file properly — each section says why. One short screen at a time; you can't lose
            your place, and you can jump back to fix anything before you sign.
          </p>
        </div>

        {data.signed ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100 space-y-1">
            <p className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Signed by {data.signedName}.
            </p>
            <p className="text-emerald-100/80">You can still update details if something changes before the pack is sent.</p>
          </div>
        ) : data.status === "complete" ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100 space-y-1">
            <p className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Everything needed is on file. Sign below to send it back.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-50 leading-relaxed">
            {totalMissing} thing{totalMissing === 1 ? "" : "s"} still needed overall.
          </div>
        )}

        {data.missingDocLabels.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4" /> Documents still needed
            </p>
            <ul className="text-sm text-slate-300 list-disc pl-5 space-y-0.5">
              {data.missingDocLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            {data.uploadToken && (
              <a
                href={`/pack/${encodeURIComponent(data.uploadToken)}`}
                className="inline-block text-sm text-violet-300 underline underline-offset-2"
              >
                Upload documents →
              </a>
            )}
          </div>
        )}

        {/* ---- Stepper ---- */}
        <div>
          <div className="flex gap-1">
            {STAGES.map((s, i) => (
              <button
                key={i}
                type="button"
                disabled={i > furthest}
                onClick={() => goTo(i)}
                title={stageTitle(s)}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i === stageIndex ? "bg-violet-400" : i < furthest || i < stageIndex ? "bg-emerald-500/70" : "bg-white/10"
                } ${i > furthest ? "cursor-not-allowed" : "cursor-pointer"}`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2 font-medium tracking-wide uppercase">
            Step {stageIndex + 1} of {STAGES.length} — {stageTitle(stage)}
          </p>
        </div>

        {/* ---- Current stage ---- */}
        <div ref={cardRef} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-6 scroll-mt-6">
          {stage.kind === "section" && (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{stage.section.title}</h2>
                {stage.section.note && <p className="text-sm text-slate-400 mt-1">{stage.section.note}</p>}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {stage.section.fields.map((field) => (
                  <div key={field.id} className={field.type === "textarea" ? "sm:col-span-2" : undefined}>
                    <FieldInput
                      field={field}
                      value={answers[field.id] || ""}
                      onChange={(v) => setAnswers((prev) => ({ ...prev, [field.id]: v }))}
                      missing={sectionMissing.some((f) => f.id === field.id)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {stage.kind === "directors" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Directors / owners</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Add one block per director, partner or significant shareholder. If two people share their
                    finances (e.g. a couple), one combined block is fine.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDirectors((prev) => [...prev, { id: newDirectorId() } as ApplicationDirector])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add another
                </Button>
              </div>

              {directors.map((director, index) => {
                const missing = directorGaps.perDirector.find((d) => d.directorId === director.id)?.missing || [];
                return (
                  <div key={director.id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-violet-200">Director {index + 1}</p>
                      {directors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDirectors((prev) => prev.filter((d) => d.id !== director.id))}
                          className="text-slate-400 hover:text-red-300"
                          aria-label="Remove director"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {DIRECTOR_SECTIONS.map((sub) => (
                      <div key={sub.id} className="space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{sub.title}</p>
                          {sub.note && <p className="text-xs text-slate-400 mt-0.5">{sub.note}</p>}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          {sub.fields.map((field) => (
                            <div key={field.id} className={field.type === "textarea" ? "sm:col-span-2" : undefined}>
                              <FieldInput
                                field={field}
                                value={director[field.id] || ""}
                                onChange={(v) =>
                                  setDirectors((prev) =>
                                    prev.map((d) => (d.id === director.id ? { ...d, [field.id]: v } : d)),
                                  )
                                }
                                missing={missing.some((f) => f.id === field.id)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          )}

          {stage.kind === "review" && (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold">Review</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Check everything below, then sign. Jump back to any step to fix something.
                </p>
              </div>

              {APPLICATION_SECTIONS.map((section, i) => (
                <div key={section.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-200">{section.title}</p>
                    <button type="button" className="text-xs text-violet-300 underline underline-offset-2" onClick={() => goTo(i)}>
                      Edit
                    </button>
                  </div>
                  <dl className="text-xs text-slate-400 grid sm:grid-cols-2 gap-x-4 gap-y-1">
                    {section.fields
                      .filter((f) => answers[f.id])
                      .map((f) => (
                        <div key={f.id} className="flex gap-1.5">
                          <dt className="text-slate-500">{f.label}:</dt>
                          <dd className="text-slate-300 truncate">{answers[f.id]}</dd>
                        </div>
                      ))}
                    {section.fields.every((f) => !answers[f.id]) && <p className="text-slate-600 italic">Nothing entered</p>}
                  </dl>
                </div>
              ))}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-200">Directors / owners</p>
                  <button
                    type="button"
                    className="text-xs text-violet-300 underline underline-offset-2"
                    onClick={() => goTo(STAGES.findIndex((s) => s.kind === "directors"))}
                  >
                    Edit
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {directors.length} director{directors.length === 1 ? "" : "s"} on file
                  {directors.map((d) => d.fullName).filter(Boolean).length
                    ? ` — ${directors.map((d) => d.fullName).filter(Boolean).join(", ")}`
                    : ""}
                </p>
              </div>
            </section>
          )}

          {stage.kind === "sign" && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">E-sign and send back</h2>
              <p className="text-sm text-slate-400">
                Type your name to confirm the information is true and complete. This is your signature on the
                application.
              </p>
              <input
                className="w-full rounded-md bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white"
                placeholder="Full name"
                value={signName}
                onChange={(e) => setSignName(e.target.value)}
                data-testid="apply-staged-sign-name"
              />
              <input
                className="w-full rounded-md bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white"
                placeholder="Position (director, owner…)"
                value={signTitle}
                onChange={(e) => setSignTitle(e.target.value)}
                data-testid="apply-staged-sign-title"
              />
            </section>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 inset-x-0 border-t border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button type="button" variant="ghost" disabled={stageIndex === 0} onClick={() => goTo(stageIndex - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          {notice && <p className="text-sm text-amber-200 flex-1">{notice}</p>}
          {!notice && <div className="flex-1" />}

          {!isLast ? (
            <Button type="button" className="bg-[#4B2E6F] hover:bg-[#5b3a86]" onClick={handleContinue}>
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={submit.isPending}
                onClick={() => submit.mutate(undefined)}
              >
                {submit.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                className="bg-[#4B2E6F] hover:bg-[#5b3a86]"
                disabled={submit.isPending || !signName.trim()}
                data-testid="apply-staged-sign-submit"
                onClick={() => submit.mutate({ name: signName.trim(), title: signTitle.trim() })}
              >
                {data.signed ? "Re-sign" : "Sign and send back"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
