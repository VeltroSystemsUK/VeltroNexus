import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Plus, Shield, Trash2, Upload } from "lucide-react";
import {
  APPLICATION_SECTIONS,
  DIRECTOR_SECTIONS,
  missingRequiredDirectorFields,
  missingRequiredFields,
  type ApplicationAnswers,
  type ApplicationDataStatus,
  type ApplicationDirector,
  type ApplicationFieldDef,
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

export function FieldInput({
  field,
  value,
  onChange,
  missing,
}: {
  field: ApplicationFieldDef;
  value: string;
  onChange: (v: string) => void;
  missing: boolean;
}) {
  const baseClass =
    "w-full rounded-md bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-400";

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
        {field.label}
        {field.required && (
          <span
            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
              missing ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/15 text-emerald-300"
            }`}
          >
            {missing ? "Needed" : "On file"}
          </span>
        )}
      </label>
      {field.note && <p className="text-xs text-slate-400 italic border-l-2 border-amber-500/40 pl-2">{field.note}</p>}

      {field.type === "textarea" ? (
        <textarea rows={3} className={baseClass} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "select" ? (
        <select className={baseClass} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === "yesno" ? (
        <div className="flex gap-2">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                value === opt
                  ? "bg-white text-slate-950 border-white"
                  : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : field.type === "date" ? (
        <input type="date" className={baseClass} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "number" || field.type === "currency" ? (
        <input
          type="number"
          className={baseClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.type === "currency" ? "£" : undefined}
        />
      ) : (
        <input type="text" className={baseClass} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

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
  const seeded = useRef(false);

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
  const totalMissing = sectionMissing.length + directorGaps.perDirector.reduce((n, d) => n + d.missing.length, 0) + (directorGaps.noDirectors ? 1 : 0);

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

      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 space-y-8">
        <div>
          <p className="text-sm text-violet-200">Hi {data.contactFirstName}</p>
          <h1 className="text-2xl font-bold mt-1">Complete {data.companyName}'s application</h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">
            Most of this is already filled in from what you've told us. The rest is what your lender needs before
            they can look at the file properly — each section says why. Nothing here commits you to anything;
            you can come back and edit it any time before the pack is sent.
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
            {totalMissing} thing{totalMissing === 1 ? "" : "s"} still needed below.
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

        {APPLICATION_SECTIONS.map((section) => (
          <section key={section.id} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.note && <p className="text-sm text-slate-400 mt-1">{section.note}</p>}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {section.fields.map((field) => (
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
        ))}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Directors / owners</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDirectors((prev) => [...prev, { id: newDirectorId() } as ApplicationDirector])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add another director
            </Button>
          </div>
          <p className="text-sm text-slate-400">
            Add one block per director, partner or significant shareholder. If two people share their finances (e.g.
            a couple), one combined block is fine.
          </p>

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

        <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold">E-sign and send back</h2>
          <p className="text-sm text-slate-400">
            Type your name to confirm the information is true and complete. This is your signature on the application.
          </p>
          <input
            className="w-full rounded-md bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white"
            placeholder="Full name"
            value={signName}
            onChange={(e) => setSignName(e.target.value)}
            data-testid="apply-sign-name"
          />
          <input
            className="w-full rounded-md bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white"
            placeholder="Position (director, owner…)"
            value={signTitle}
            onChange={(e) => setSignTitle(e.target.value)}
            data-testid="apply-sign-title"
          />
        </section>
      </main>

      <div className="fixed bottom-0 inset-x-0 border-t border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          {notice && <p className="text-sm text-amber-200 flex-1">{notice}</p>}
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
            data-testid="apply-sign-submit"
            onClick={() => submit.mutate({ name: signName.trim(), title: signTitle.trim() })}
          >
            {data.signed ? "Re-sign" : "Sign and send back"}
          </Button>
        </div>
      </div>
    </div>
  );
}
