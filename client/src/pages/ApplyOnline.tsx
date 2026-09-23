import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import "./strataBrand.css";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Plus, Shield, Trash2, Upload } from "lucide-react";
import {
  APPLICATION_SECTIONS,
  DIRECTOR_SECTIONS,
  isFieldRequired,
  missingRequiredDirectorFields,
  missingRequiredFields,
  type ApplicationAnswers,
  type ApplicationDataStatus,
  type ApplicationDirector,
  type ApplicationFieldDef,
  type ApplicationSection,
} from "@shared/applicationDataFields";

export type ApplyState = {
  companyName: string;
  contactFirstName: string;
  status: ApplicationDataStatus;
  answers: ApplicationAnswers;
  directors: ApplicationDirector[];
  missingDocLabels: string[];
  uploadToken?: string;
  signed?: boolean;
  signedName?: string;
  signedAt?: string;
};

export async function readApply(res: Response): Promise<ApplyState> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("The application service is updating. Please try again in a minute.");
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data?.companyName) {
    throw new Error(data.error || "This application link is not valid.");
  }
  return data as ApplyState;
}

export function newDirectorId(): string {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** "If yes, details" fields stay hidden until the question they depend on is answered Yes. */
function isFieldShown(field: ApplicationFieldDef, values: ApplicationAnswers): boolean {
  return !field.requiredIf || values[field.requiredIf.field] === field.requiredIf.equals;
}

function isBlank(value: string | undefined): boolean {
  return !value || !value.trim();
}

export function FieldInput({
  field,
  value,
  onChange,
  missing,
  required = Boolean(field.required),
}: {
  field: ApplicationFieldDef;
  value: string;
  onChange: (v: string) => void;
  missing: boolean;
  required?: boolean;
}) {
  const inputProps = { id: `f-${field.id}`, className: "sf-input", "aria-invalid": missing || undefined, "aria-required": required || undefined };

  return (
    <div className="space-y-1">
      <label htmlFor={`f-${field.id}`} className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--sf-heading)" }}>
        {field.label}
        {required && (
          <span
            className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold shrink-0"
            style={
              missing
                ? { color: "var(--sf-gold)", border: "1px solid var(--sf-gold)" }
                : { color: "var(--sf-green)", border: "1px solid var(--sf-green)" }
            }
          >
            {missing ? "Needed" : "Done"}
          </span>
        )}
      </label>
      {field.note && (
        <p className="text-xs pl-2" style={{ color: "var(--sf-muted)", borderLeft: "2px solid var(--sf-accent)" }}>
          {field.note}
        </p>
      )}

      {field.type === "textarea" ? (
        <textarea rows={3} {...inputProps} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "select" ? (
        <select {...inputProps} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === "yesno" ? (
        <div className="flex gap-2" role="group" aria-label={field.label}>
          {["Yes", "No"].map((opt) => (
            <button key={opt} type="button" onClick={() => onChange(opt)} className="sf-choice" aria-pressed={value === opt}>
              {opt}
            </button>
          ))}
        </div>
      ) : field.type === "date" ? (
        <input type="date" {...inputProps} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "number" || field.type === "currency" ? (
        <input
          type="number"
          inputMode="decimal"
          {...inputProps}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.type === "currency" ? "£" : undefined}
        />
      ) : (
        <input type="text" {...inputProps} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

type DirectorSection = (typeof DIRECTOR_SECTIONS)[number];
type Stage =
  | { kind: "section"; section: ApplicationSection }
  | { kind: "director"; section: DirectorSection; first: boolean }
  | { kind: "review" }
  | { kind: "sign" };

const STAGES: Stage[] = [
  ...APPLICATION_SECTIONS.map((section): Stage => ({ kind: "section", section })),
  ...DIRECTOR_SECTIONS.map((section, i): Stage => ({ kind: "director", section, first: i === 0 })),
  { kind: "review" },
  { kind: "sign" },
];

function stageTitle(stage: Stage): string {
  if (stage.kind === "section") return stage.section.title;
  if (stage.kind === "director") return `Directors: ${stage.section.title.toLowerCase()}`;
  if (stage.kind === "review") return "Check your answers";
  return "Sign and send";
}

const muted = { color: "var(--sf-muted)" };

export default function ApplyOnline() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["/api/apply", token], [token]);
  const [answers, setAnswers] = useState<ApplicationAnswers>({});
  const [directors, setDirectors] = useState<ApplicationDirector[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [signName, setSignName] = useState("");
  const [signTitle, setSignTitle] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const seeded = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Your application | Strata Finance";
  }, []);

  const { data, isLoading, error } = useQuery<ApplyState>({
    queryKey,
    queryFn: async () => readApply(await fetch(`/api/apply/${encodeURIComponent(token)}`)),
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
    mutationFn: async (sign?: { name: string; title?: string }) =>
      readApply(
        await fetch(`/api/apply/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, directors, sign }),
        }),
      ),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKey, state);
      setNotice(null);
    },
    onError: (err: any) => setNotice(err.message || "Could not save your application"),
  });

  if (!token || error) {
    const message = error instanceof Error ? error.message : "This application link is not valid.";
    return (
      <div className="sf-brand min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <Shield className="h-8 w-8 mx-auto" style={{ color: "var(--sf-accent)" }} />
          <h1 className="text-xl">{message}</h1>
          <p className="text-sm" style={muted}>
            Reply to our last email, or write to{" "}
            <a href="mailto:enquiries@stratafinance.co.uk" style={{ color: "var(--sf-accent)" }}>
              enquiries@stratafinance.co.uk
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="sf-brand min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--sf-accent)" }} />
      </div>
    );
  }

  const sectionMissing = missingRequiredFields(answers);
  const directorGaps = missingRequiredDirectorFields(directors);
  const totalMissing =
    sectionMissing.length + directorGaps.perDirector.reduce((n, d) => n + d.missing.length, 0) + (directorGaps.noDirectors ? 1 : 0);
  const stage = STAGES[stageIndex];
  const isLast = stageIndex === STAGES.length - 1;
  const firstName = data.contactFirstName && data.contactFirstName !== "there" ? data.contactFirstName : "";
  const uploadUrl = data.uploadToken ? `/pack/${encodeURIComponent(data.uploadToken)}` : "";
  const documentsCard = uploadUrl ? (
    <div className="sf-card px-4 py-4 space-y-2">
      <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--sf-heading)" }}>
        <Upload className="h-4 w-4" /> Your documents
      </p>
      {data.missingDocLabels.length > 0 ? (
        <ul className="text-sm list-disc pl-5 space-y-0.5" style={muted}>
          {data.missingDocLabels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm" style={muted}>Bank statements, accounts and ID go on the secure upload page.</p>
      )}
      <a href={uploadUrl} className="sf-btn sf-btn-primary inline-flex items-center">
        <Upload className="h-4 w-4 mr-1.5" /> Upload documents securely
      </a>
    </div>
  ) : null;

  function gapsForStage(s: Stage): string[] {
    if (s.kind === "section") {
      return s.section.fields.filter((f) => isFieldRequired(f, answers) && isBlank(answers[f.id])).map((f) => f.label);
    }
    if (s.kind === "director") {
      if (!directors.length) return ["At least one director or owner"];
      return directors.flatMap((d, i) =>
        s.section.fields
          .filter((f) => isFieldRequired(f, d) && isBlank(d[f.id]))
          .map((f) => (directors.length > 1 ? `${f.label} (director ${i + 1})` : f.label)),
      );
    }
    return [];
  }

  function goTo(index: number) {
    setNotice(null);
    setStageIndex(Math.max(0, Math.min(STAGES.length - 1, index)));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleContinue() {
    const gaps = gapsForStage(stage);
    if (gaps.length > 0) {
      setNotice(`Still needed: ${gaps.join(", ")}`);
      return;
    }
    submit.mutate(undefined); // save as they go, so nothing is lost if they leave
    setFurthest((f) => Math.max(f, stageIndex + 1));
    goTo(stageIndex + 1);
  }

  function fieldGrid(fields: ApplicationFieldDef[], values: ApplicationAnswers, onChange: (id: string, v: string) => void, missing: ApplicationFieldDef[]) {
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {fields
          .filter((field) => isFieldShown(field, values))
          .map((field) => (
            <div key={field.id} className={field.type === "textarea" ? "sm:col-span-2" : undefined}>
              <FieldInput
                field={field}
                value={values[field.id] || ""}
                onChange={(v) => onChange(field.id, v)}
                required={isFieldRequired(field, values)}
                missing={missing.some((f) => f.id === field.id)}
              />
            </div>
          ))}
      </div>
    );
  }

  return (
    <div className="sf-brand min-h-screen pb-32">
      <header style={{ background: "var(--sf-surface)", borderBottom: "1px solid var(--sf-border)" }}>
        <div className="sf-bands" />
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <a href="https://www.stratafinance.co.uk" aria-label="Strata Finance home">
            <img src="/images/strata-logo-light.png" alt="Strata Finance" className="sf-logo-light h-9 w-auto" />
            <img src="/images/strata-logo-dark.png" alt="Strata Finance" className="sf-logo-dark h-9 w-auto" />
          </a>
          {uploadUrl ? (
            <a href={uploadUrl} className="sf-btn sf-btn-ghost flex items-center text-sm" data-testid="apply-upload-link">
              <Upload className="h-4 w-4 mr-1.5" /> Upload documents
            </a>
          ) : (
            <span className="text-xs flex items-center gap-1" style={muted}>
              <Shield className="h-3.5 w-3.5" /> Secure application
            </span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {stageIndex === 0 && (
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--sf-accent)" }}>
              {firstName ? `Hi ${firstName}` : "Hello"}
            </p>
            <h1 className="text-2xl mt-1">Your Strata application for {data.companyName}</h1>
            <p className="mt-3 text-sm leading-relaxed" style={muted}>
              One form covers what the CDFIs and specialist funders we work with ask for. It's {STAGES.length} short
              steps. Anything you've already told us is filled in, and your answers save as you go, so you can stop and
              come back with the same link. Nothing here commits you to anything.
            </p>
          </div>
        )}

        {data.signed ? (
          <div className="sf-card px-4 py-3 text-sm" style={{ borderColor: "var(--sf-green)" }}>
            <p className="font-semibold flex items-center gap-2" style={{ color: "var(--sf-green)" }}>
              <CheckCircle2 className="h-5 w-5" /> Signed by {data.signedName}. Thank you.
            </p>
            <p style={muted}>You can still update details if something changes before your file goes to a lender.</p>
          </div>
        ) : null}

        {stageIndex === 0 && documentsCard}

        <div ref={topRef} className="scroll-mt-6">
          <div className="flex gap-1" aria-hidden="true">
            {STAGES.map((s, i) => (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                disabled={i > furthest}
                onClick={() => goTo(i)}
                title={stageTitle(s)}
                className="h-1.5 flex-1 rounded-full"
                style={{
                  background:
                    i === stageIndex ? "var(--sf-accent)" : i < furthest ? "var(--sf-green)" : "var(--sf-border-hi)",
                  cursor: i > furthest ? "not-allowed" : "pointer",
                }}
              />
            ))}
          </div>
          <p className="text-xs mt-2 font-semibold tracking-wide uppercase" style={muted}>
            Step {stageIndex + 1} of {STAGES.length}
            {!data.signed && totalMissing > 0 ? ` · ${totalMissing} answer${totalMissing === 1 ? "" : "s"} still needed overall` : ""}
          </p>
        </div>

        <div className="sf-card p-5 space-y-5">
          {stage.kind === "section" && (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg">{stage.section.title}</h2>
                {stage.section.note && <p className="text-sm mt-1" style={muted}>{stage.section.note}</p>}
              </div>
              {fieldGrid(stage.section.fields, answers, (id, v) => setAnswers((prev) => ({ ...prev, [id]: v })), sectionMissing)}
            </section>
          )}

          {stage.kind === "director" && (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg">{stageTitle(stage)}</h2>
                {stage.first && (
                  <p className="text-sm mt-1" style={muted}>
                    One block per director, partner or significant shareholder. If two people share their finances (for
                    example a couple), one combined block is fine.
                  </p>
                )}
                {stage.section.note && <p className="text-sm mt-1" style={muted}>{stage.section.note}</p>}
              </div>

              {directors.map((director, index) => {
                const missing = directorGaps.perDirector.find((d) => d.directorId === director.id)?.missing || [];
                return (
                  <div key={director.id} className="space-y-3">
                    {(directors.length > 1 || !stage.first) && (
                      <div className="flex items-center justify-between pt-1" style={{ borderTop: index ? "1px solid var(--sf-border)" : undefined }}>
                        <p className="text-sm font-semibold pt-2" style={{ color: "var(--sf-accent)" }}>
                          {director.fullName || `Director ${index + 1}`}
                        </p>
                        {stage.first && directors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDirectors((prev) => prev.filter((d) => d.id !== director.id))}
                            style={muted}
                            aria-label={`Remove director ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                    {fieldGrid(
                      stage.section.fields,
                      director,
                      (id, v) => setDirectors((prev) => prev.map((d) => (d.id === director.id ? { ...d, [id]: v } : d))),
                      missing,
                    )}
                  </div>
                );
              })}

              {stage.first && (
                <button
                  type="button"
                  className="sf-btn sf-btn-ghost flex items-center"
                  onClick={() => setDirectors((prev) => [...prev, { id: newDirectorId() } as ApplicationDirector])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add another director
                </button>
              )}
            </section>
          )}

          {stage.kind === "review" && (
            <section className="space-y-5">
              <div>
                <h2 className="text-lg">Check your answers</h2>
                <p className="text-sm mt-1" style={muted}>Use Edit to go back to any step.</p>
              </div>
              {STAGES.map((s, i) => {
                if (s.kind === "review" || s.kind === "sign") return null;
                const rows =
                  s.kind === "section"
                    ? s.section.fields.filter((f) => answers[f.id]).map((f) => [f.label, answers[f.id]] as const)
                    : directors.flatMap((d, di) =>
                        s.section.fields
                          .filter((f) => d[f.id])
                          .map((f) => [directors.length > 1 ? `${f.label} (${d.fullName || `director ${di + 1}`})` : f.label, d[f.id]] as const),
                      );
                return (
                  <div key={i} className="space-y-1.5" style={{ borderTop: "1px solid var(--sf-border)", paddingTop: "0.75rem" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold" style={{ color: "var(--sf-heading)" }}>{stageTitle(s)}</p>
                      <button type="button" className="text-xs font-semibold underline underline-offset-2" style={{ color: "var(--sf-accent)" }} onClick={() => goTo(i)}>
                        Edit
                      </button>
                    </div>
                    {rows.length ? (
                      <dl className="text-xs grid sm:grid-cols-2 gap-x-4 gap-y-1">
                        {rows.map(([label, value]) => (
                          <div key={label} className="flex gap-1.5 min-w-0">
                            <dt className="shrink-0" style={muted}>{label}:</dt>
                            <dd className="truncate">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-xs italic" style={muted}>Nothing entered</p>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {stage.kind === "sign" && (
            <section className="space-y-3">
              <h2 className="text-lg">Sign and send</h2>
              <p className="text-sm" style={muted}>
                Type your name to confirm the information is true and complete. This is your signature on the application.
              </p>
              <input className="sf-input" placeholder="Full name" value={signName} onChange={(e) => setSignName(e.target.value)} data-testid="apply-sign-name" />
              <input
                className="sf-input"
                placeholder="Position (director, owner…)"
                value={signTitle}
                onChange={(e) => setSignTitle(e.target.value)}
                data-testid="apply-sign-title"
              />
              {totalMissing > 0 && (
                <p className="text-sm" style={{ color: "var(--sf-gold)" }}>
                  {totalMissing} answer{totalMissing === 1 ? " is" : "s are"} still needed. You can sign now and we'll ask for
                  {totalMissing === 1 ? " it" : " them"}, but the file can't go to a lender until everything is in.
                </p>
              )}
              {documentsCard}
              <p className="text-xs" style={muted}>
                Strata Finance is a packager, not a lender. We prepare your file and put it in front of the right CDFI or
                specialist funder.
              </p>
            </section>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 inset-x-0" style={{ background: "var(--sf-surface)", borderTop: "1px solid var(--sf-border)" }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button type="button" className="sf-btn sf-btn-ghost flex items-center" disabled={stageIndex === 0} onClick={() => goTo(stageIndex - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </button>
          <p className="text-sm flex-1 min-w-0" role="status" style={{ color: "var(--sf-red)" }}>
            {notice || (submit.isPending ? <span style={muted}>Saving…</span> : null)}
          </p>
          {!isLast ? (
            <button type="button" className="sf-btn sf-btn-primary flex items-center" onClick={handleContinue}>
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          ) : (
            <button
              type="button"
              className="sf-btn sf-btn-primary"
              disabled={submit.isPending || !signName.trim()}
              data-testid="apply-sign-submit"
              onClick={() => submit.mutate({ name: signName.trim(), title: signTitle.trim() })}
            >
              {data.signed ? "Re-sign" : "Sign and send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
