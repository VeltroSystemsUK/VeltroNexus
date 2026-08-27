import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, FileText, Loader2, Shield, Upload } from "lucide-react";
import { packCategoryForAttachment } from "@shared/sterlingCompleteness";

type PackFile = {
  id: string;
  category: string;
  fileName: string;
  uploadedAt: string;
};

type PackState = {
  companyName: string;
  contactFirstName: string;
  documents: PackFile[];
  fundingReason: string;
  hasBankStatements: boolean;
  hasAuditedAccounts: boolean;
  hasReason: boolean;
  missingRequired?: string[];
  requiredComplete?: boolean;
};

const REQUIRED_SLOTS = [
  { id: "bank-statements", title: "Business bank statements", hint: "Last six months. You can add several files." },
  { id: "accounts", title: "Filed or management accounts", hint: "Last two years. PDF is preferred." },
  { id: "cashflow", title: "24-month cash flow forecast", hint: "Spreadsheet or PDF." },
  { id: "debt-schedule", title: "Debt schedule / existing facilities", hint: "Lender, balance, monthly repayment." },
  { id: "id", title: "Director photo ID", hint: "Passport or driving licence for each director." },
] as const;

const OPTIONAL_SLOTS = [
  { id: "management-accounts", title: "Latest management accounts", hint: "If filed accounts are more than 9 months old." },
  { id: "proof-of-address", title: "Proof of address", hint: "Utility bill — not a mobile bill." },
  { id: "application-form", title: "Signed application form", hint: "If you already have one." },
  { id: "sal", title: "Statement of assets and liabilities", hint: "Each director." },
  { id: "hmrc", title: "HMRC / Time to Pay letters", hint: "If HMRC is part of the picture." },
  { id: "insurance", title: "Insurance certificates", hint: "If you have them to hand." },
  { id: "business-plan", title: "Business plan / director CVs", hint: "Optional supporting." },
] as const;

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.webp,.csv,.xls,.xlsx,.doc,.docx,.zip";

async function readPack(res: Response): Promise<PackState> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("The upload service is updating. Please try again in a minute.");
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data?.companyName || !Array.isArray(data.documents)) {
    throw new Error(data.error || "This upload link is not valid.");
  }
  return data as PackState;
}

function Slot({
  title,
  hint,
  done,
  files,
  uploading,
  onPick,
}: {
  title: string;
  hint: string;
  done: boolean;
  files: PackFile[];
  uploading: boolean;
  onPick: (list: FileList | null) => void;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-400 mt-1">{hint}</p>
        </div>
        {done && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />}
      </div>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 text-sm text-slate-200">
              <FileText className="h-4 w-4 text-violet-300 shrink-0" />
              <span className="truncate">{file.fileName}</span>
            </li>
          ))}
        </ul>
      )}
      <label className="inline-flex">
        <input
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            onPick(event.target.files);
            event.target.value = "";
          }}
        />
        <span className="inline-flex items-center gap-2 rounded-md bg-[#4B2E6F] px-4 py-2 text-sm font-semibold text-white cursor-pointer hover:bg-[#5b3a86]">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : files.length ? "Add more files" : "Choose files"}
        </span>
      </label>
    </section>
  );
}

export default function PackUpload() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["/api/pack", token], [token]);
  const [reason, setReason] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<PackState>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/pack/${encodeURIComponent(token)}`);
      const pack = await readPack(res);
      if (pack.fundingReason) setReason(pack.fundingReason);
      return pack;
    },
    enabled: !!token,
    retry: false,
  });

  const uploadFiles = async (category: string, list: FileList | null) => {
    if (!list?.length) return;
    setNotice(null);
    setUploading(category);
    try {
      const form = new FormData();
      form.append("category", category);
      Array.from(list).forEach((file) => form.append("files", file));
      const res = await fetch(`/api/pack/${encodeURIComponent(token)}/files`, {
        method: "POST",
        body: form,
      });
      const pack = await readPack(res);
      queryClient.setQueryData(queryKey, pack);
      setNotice("Files received. Thank you.");
    } catch (err: any) {
      setNotice(err.message || "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const saveReason = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/pack/${encodeURIComponent(token)}/reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundingReason: reason }),
      });
      return readPack(res);
    },
    onSuccess: (pack) => {
      queryClient.setQueryData(queryKey, pack);
      setNotice("Reason saved. Thank you.");
    },
    onError: (err: any) => setNotice(err.message || "Could not save that note"),
  });

  if (!token || error) {
    const message = error instanceof Error ? error.message : "This upload link is not valid.";
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <Shield className="h-8 w-8 text-violet-300 mx-auto" />
          <h1 className="text-xl font-semibold">{message}</h1>
          <p className="text-slate-400 text-sm">
            Ask Maya to send the email again, or call Strata Finance on 0115 984 9800.
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

  const complete = data.requiredComplete ?? (data.hasBankStatements && data.hasAuditedAccounts && data.hasReason);
  const filesFor = (id: string) =>
    (data.documents || []).filter((doc) => packCategoryForAttachment(doc.category) === id);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <img src="/images/strata-finance-logo.png" alt="Strata Finance" className="h-10 w-auto" />
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> Secure upload
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <p className="text-sm text-violet-200">Hi {data.contactFirstName}</p>
          <h1 className="text-2xl font-bold mt-1">Send the pack for {data.companyName}</h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">
            To take this forward we need bank statements, accounts, a 24-month cash flow, the current
            debt schedule, director ID, and a short note on why the funding or refinance is needed.
          </p>
        </div>

        {complete && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            The required documents are on the file. We will review them and come back to you — we will
            not send this to a lender until the file is complete.
          </div>
        )}

        {notice && !complete && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
            {notice}
          </div>
        )}

        {REQUIRED_SLOTS.map((slot) => {
          const files = filesFor(slot.id);
          return (
            <Slot
              key={slot.id}
              title={slot.title}
              hint={slot.hint}
              done={files.length > 0}
              files={files}
              uploading={uploading === slot.id}
              onPick={(list) => uploadFiles(slot.id, list)}
            />
          );
        })}

        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Why is the funding or refinance needed?</h2>
              <p className="text-sm text-slate-400 mt-1">A short note is enough — stacked loans, HMRC, cashflow, a decline.</p>
            </div>
            {data.hasReason && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />}
          </div>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={5}
            maxLength={4000}
            placeholder="Tell us why the funding or refinance is needed"
            className="bg-slate-900 border-white/10 text-white placeholder:text-slate-500"
          />
          <Button
            onClick={() => saveReason.mutate()}
            disabled={saveReason.isPending || !reason.trim()}
            className="bg-[#4B2E6F] hover:bg-[#5b3a86]"
          >
            {saveReason.isPending ? "Saving…" : data.hasReason ? "Update note" : "Save note"}
          </Button>
        </section>

        <p className="text-xs uppercase tracking-wide text-slate-500">Optional — send if you have them</p>
        {OPTIONAL_SLOTS.map((slot) => {
          const files = filesFor(slot.id);
          return (
            <Slot
              key={slot.id}
              title={slot.title}
              hint={slot.hint}
              done={files.length > 0}
              files={files}
              uploading={uploading === slot.id}
              onPick={(list) => uploadFiles(slot.id, list)}
            />
          );
        })}
      </main>

      <footer className="max-w-2xl mx-auto px-4 pb-10 text-xs text-slate-500 space-y-1">
        <p>0115 984 9800 · Sterling House, Unit 5 Wheatcroft Business Park, Landmere Lane, Edwalton, Nottingham NG12 4DG</p>
        <p>Strata Finance arranges non-regulated commercial B2B finance and is not authorised by the FCA. We are not a lender.</p>
      </footer>
    </div>
  );
}
