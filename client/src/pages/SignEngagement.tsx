import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileText, Loader2, Shield } from "lucide-react";
import {
  engagementLetterBlocks,
  populateBlocks,
  privacyNoticeBlocks,
  type DocBlock,
  type EngagementFill,
} from "@shared/engagementPack";

type SignState = {
  companyName: string;
  contactFirstName: string;
  version: string;
  signed: boolean;
  signedName?: string;
  signedAt?: string;
  fill: EngagementFill;
};

async function readSign(res: Response): Promise<SignState> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("The signing service is updating. Please try again in a minute.");
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data?.companyName || !data?.fill) {
    throw new Error(data.error || "This signing link is not valid.");
  }
  return data as SignState;
}

function BlockView({ block }: { block: DocBlock }) {
  if (block.type === "kicker") {
    return (
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#8A6A1A] font-semibold mb-2">{block.text}</p>
    );
  }
  if (block.type === "heading") {
    const cls =
      block.level === 1
        ? "text-[1.65rem] leading-tight font-bold text-[#2C1B45] mt-1 mb-3"
        : block.level === 2
          ? "text-[1.05rem] font-bold text-[#4B2E6F] mt-6 mb-2"
          : "text-[0.95rem] font-semibold text-[#3D2A58] mt-4 mb-1.5";
    const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
    return <Tag className={cls}>{block.text}</Tag>;
  }
  if (block.type === "para") {
    return <p className="text-[15px] leading-[1.55] text-[#2A2420] mb-3">{block.text}</p>;
  }
  if (block.type === "note") {
    return (
      <p className="text-[13.5px] leading-relaxed text-[#5C534A] border-l-2 border-[#C9A227] pl-3 mb-3 italic">
        {block.text}
      </p>
    );
  }
  if (block.type === "callout") {
    return (
      <div className="rounded-md border border-[#E4D4A4] bg-[#FBF6E8] px-4 py-3 mb-5">
        <p className="text-[13px] font-semibold text-[#4B2E6F] mb-1">{block.title}</p>
        <p className="text-[14px] leading-relaxed text-[#3A322C]">{block.body}</p>
      </div>
    );
  }
  if (block.type === "list") {
    const List = block.ordered ? "ol" : "ul";
    return (
      <List className={`text-[15px] leading-[1.55] text-[#2A2420] mb-3 pl-5 space-y-1.5 ${block.ordered ? "list-decimal" : "list-disc"}`}>
        {block.items.map((item) => (
          <li key={item.slice(0, 48)}>{item}</li>
        ))}
      </List>
    );
  }
  return (
    <div className="mb-4 overflow-hidden rounded-md border border-[#E6DFD4]">
      {block.rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-0 border-b border-[#E6DFD4] last:border-b-0"
        >
          <div className="bg-[#F1ECE4] px-3 py-2 text-[12.5px] font-semibold text-[#5A5148]">{row.label}</div>
          <div className="bg-[#FFF9EC] px-3 py-2 text-[14px] text-[#1F1A16]">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

function Paper({ title, blocks }: { title: string; blocks: DocBlock[] }) {
  return (
    <article className="rounded-xl bg-[#F7F4EE] text-[#1C1917] shadow-[0_12px_40px_rgba(0,0,0,0.28)] overflow-hidden">
      <div className="h-1.5 bg-[#4B2E6F]" />
      <div className="px-5 sm:px-8 py-6 sm:py-8">
        <p className="sr-only">{title}</p>
        {blocks.map((block, index) => (
          <BlockView key={`${block.type}-${index}`} block={block} />
        ))}
      </div>
    </article>
  );
}

export default function SignEngagement() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["/api/sign", token], [token]);
  const [tab, setTab] = useState<"privacy" | "terms">("privacy");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<SignState>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/sign/${encodeURIComponent(token)}`);
      return readSign(res);
    },
    enabled: !!token,
    retry: false,
  });

  const sign = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sign/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, title, privacyAccepted, termsAccepted }),
      });
      return readSign(res);
    },
    onSuccess: (pack) => {
      queryClient.setQueryData(queryKey, pack);
      setNotice(null);
    },
    onError: (err: any) => setNotice(err.message || "Could not record the signature"),
  });

  if (!token || error) {
    const message = error instanceof Error ? error.message : "This signing link is not valid.";
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

  const privacy = populateBlocks(privacyNoticeBlocks(), data.fill);
  const letter = populateBlocks(engagementLetterBlocks(), data.fill);
  const canSign = Boolean(name.trim()) && privacyAccepted && termsAccepted;

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-40">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <img src="/images/strata-finance-logo.png" alt="Strata Finance" className="h-10 w-auto" />
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> Secure signing
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <p className="text-sm text-violet-200">Hi {data.contactFirstName}</p>
          <h1 className="text-2xl font-bold mt-1">Sign the papers for {data.companyName}</h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">
            This is the last step before we send the completed pack to Sterling Commercial Finance.
            Read both documents. Yellow boxes are already filled from your file — check they are right,
            then type your name and confirm.
          </p>
        </div>

        {data.signed ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100 space-y-1">
            <p className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Signed. Thank you.
            </p>
            <p>
              {data.signedName}
              {data.signedAt ? ` · ${new Date(data.signedAt).toLocaleString("en-GB")}` : ""}
            </p>
            <p className="text-emerald-100/80">You do not need to do anything else. The file can now go to Sterling.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-50 leading-relaxed">
            Two documents. One signature. Nothing leaves this desk for David at Sterling until both are confirmed.
          </div>
        )}

        <div className="flex gap-2">
          {(
            [
              ["privacy", "1. Privacy Notice"],
              ["terms", "2. Terms of Business"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold border ${
                tab === id
                  ? "bg-white text-slate-950 border-white"
                  : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
              }`}
            >
              <FileText className="inline h-4 w-4 mr-1.5 -mt-0.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === "privacy" ? (
          <Paper title="Privacy Notice" blocks={privacy} />
        ) : (
          <Paper title="Terms of Business" blocks={letter} />
        )}
      </main>

      {!data.signed && (
        <div className="fixed bottom-0 inset-x-0 border-t border-white/10 bg-slate-950/95 backdrop-blur">
          <form
            className="max-w-3xl mx-auto px-4 py-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSign) sign.mutate();
            }}
          >
            {notice && <p className="text-sm text-amber-200">{notice}</p>}
            <label className="flex items-start gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="mt-1"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
              />
              <span>
                I have read the Privacy Notice and consent to Strata Finance sharing my details with lenders so they can process this application.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="mt-1"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>
                I have read and agree to the Terms of Business and Brokers’ Terms and Conditions, for and on behalf of {data.companyName}.
              </span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Type your full name"
                autoComplete="name"
                className="flex-1 rounded-md bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title (optional)"
                className="sm:w-48 rounded-md bg-slate-900 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <Button type="submit" disabled={!canSign || sign.isPending} className="bg-[#4B2E6F] hover:bg-[#5b3a86] sm:w-44">
                {sign.isPending ? "Signing…" : "Sign both documents"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <footer className="max-w-3xl mx-auto px-4 pb-10 text-xs text-slate-500 space-y-1">
        <p>Sterling House, Unit 3 Wheatcroft Business Park, Edwalton, Nottingham NG12 4DG</p>
        <p>enquiries@stratafinance.co.uk · Sterling Commercial Finance Limited trading as Strata Finance. FCA FRN 733615.</p>
      </footer>
    </div>
  );
}
