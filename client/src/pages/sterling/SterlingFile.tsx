import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SterlingShell } from "./SterlingShell";
import {
  STERLING_CAMPARI_FIELDS,
  STERLING_COPY_LABELS,
  type SterlingCopyEdits,
  type SterlingCopyField,
} from "@shared/sterlingEdits";
import type { SterlingLenderId } from "@shared/sterlingPortal";
import { STERLING_PAPER_CSS } from "@shared/sterlingPaper";

type PackLine = { label: string; ok: boolean };
type Lender = { id: string; label: string; sendLabel: string; logo: string };
type FilePayload = {
  id: number;
  status: string;
  recommendation: string;
  companyName: string;
  companyNumber?: string;
  loanAmount?: number;
  term?: number;
  attachments: { id: string; label: string; attached: boolean; files?: { id: number; fileName: string }[] }[];
  missing: { id: string; label: string }[];
  packLines: PackLine[];
  documents: { id: number; fileName: string }[];
  otherDocuments?: { id: number; fileName: string }[];
  lenders: Lender[];
  handover?: { answered: number; total: number };
  copy?: SterlingCopyEdits;
  application?: {
    status?: string;
    sentAt?: string;
    signed?: boolean;
    signedName?: string;
    signedAt?: string;
  };
};

function Tick({ ok }: { ok: boolean }) {
  return ok ? (
    <svg className="scf-ico scf-tick" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" />
      <path d="M6 10.2l2.4 2.4L14.2 7" />
    </svg>
  ) : (
    <svg className="scf-ico scf-cross" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" />
      <path d="M7 7l6 6M13 7l-6 6" />
    </svg>
  );
}

function money(value?: number) {
  if (value == null) return "";
  return `£${Number(value).toLocaleString("en-GB")}`;
}

const RAIL_KEY = "scf-rail-width";
const RAIL_MIN = 280;
const RAIL_MAX = 720;
const RAIL_DEFAULT = 360;
const RAIL_WIDE = 560;

function clampRail(n: number) {
  return Math.min(RAIL_MAX, Math.max(RAIL_MIN, n));
}

function readRailWidth() {
  if (typeof window === "undefined") return RAIL_DEFAULT;
  const raw = window.localStorage.getItem(RAIL_KEY);
  if (raw == null || raw === "") return RAIL_DEFAULT;
  const n = Number(raw);
  return Number.isFinite(n) ? clampRail(n) : RAIL_DEFAULT;
}

function CopyArea({
  field,
  value,
  onChange,
  onSave,
  rows = 3,
  placeholder,
  labelled = true,
}: {
  field: SterlingCopyField;
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  rows?: number;
  placeholder?: string;
  labelled?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 600 }}>
      {labelled ? STERLING_COPY_LABELS[field] : null}
      <textarea
        className="scf-area"
        data-testid={`sterling-copy-${field}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onSave(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </label>
  );
}

function PreviewFrame({ title, src }: { title: string; src: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(null);
    fetch(src, { credentials: "include" })
      .then(async (res) => {
        const text = await res.text();
        if (!res.ok) throw new Error(text.slice(0, 180) || `Could not load (${res.status})`);
        if (!cancelled) setHtml(text);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load preview");
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (error) return <p className="scf-miss">{error}</p>;
  if (!html) return <p className="lede">Loading {title}…</p>;
  let doc = html;
  if (!doc.includes("width: 210mm")) {
    doc = doc.includes("</head>")
      ? doc.replace("</head>", `<style>${STERLING_PAPER_CSS}</style></head>`)
      : `<style>${STERLING_PAPER_CSS}</style>${doc}`;
    if (!/\sclass=["']doc["']/.test(doc)) {
      doc = doc.replace(/<body([^>]*)>/i, `<body$1><div class="doc">`).replace(/<\/body>/i, "</div></body>");
    }
  }
  return <iframe title={title} srcDoc={doc} />;
}

export default function SterlingFile() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading } = useQuery<FilePayload>({
    queryKey: [`/api/broker-portal/handoffs/${id}`],
    enabled: Boolean(id),
  });
  const [recommendation, setRecommendation] = useState("");
  const [copy, setCopy] = useState<SterlingCopyEdits>({});
  const [previewKey, setPreviewKey] = useState(0);
  const [desk, setDesk] = useState<"proposal" | "handover" | "application">("proposal");
  const [appLender, setAppLender] = useState<SterlingLenderId>("ffe");
  const [sendOpen, setSendOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [customerLink, setCustomerLink] = useState<string | null>(null);
  const [railWidth, setRailWidth] = useState(readRailWidth);

  function persistRail(n: number) {
    const next = clampRail(n);
    setRailWidth(next);
    window.localStorage.setItem(RAIL_KEY, String(next));
  }

  function onRailResizeStart(e: ReactPointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = railWidth;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    function move(ev: PointerEvent) {
      setRailWidth(clampRail(startW + (ev.clientX - startX)));
    }
    function up(ev: PointerEvent) {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      persistRail(startW + (ev.clientX - startX));
    }
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  useEffect(() => {
    if (data?.recommendation != null) setRecommendation(data.recommendation);
    if (data?.copy) setCopy(data.copy);
  }, [data?.recommendation, data?.copy]);

  const saveCopy = useMutation({
    mutationFn: async (next: SterlingCopyEdits) => {
      await apiRequest(`/api/broker-portal/handoffs/${id}/copy`, "PUT", next);
    },
    onSuccess: () => {
      setPreviewKey((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: [`/api/broker-portal/handoffs/${id}`] });
    },
  });

  const sendToCustomer = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/broker-portal/handoffs/${id}/application/send`, "POST");
      return res.json() as Promise<{ url: string; sentAt?: string; status?: string }>;
    },
    onSuccess: (body) => {
      setCustomerLink(body.url);
      if (body.url && navigator.clipboard?.writeText) void navigator.clipboard.writeText(body.url);
      queryClient.invalidateQueries({ queryKey: [`/api/broker-portal/handoffs/${id}`] });
    },
    onError: (err: Error) => setError(err.message || "Could not create the customer link"),
  });

  const returnFile = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/broker-portal/handoffs/${id}/return`, "POST", { note: returnNote });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/broker-portal/handoffs/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/broker-portal/handoffs"] });
      setReturnOpen(false);
    },
  });

  async function sendPack(lenderId: string) {
    setError(null);
    const res = await fetch(`/api/broker-portal/handoffs/${id}/pack`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lenderId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || `Could not build the pack (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data?.companyName || "file"}-${lenderId}-pack.zip`;
    a.click();
    URL.revokeObjectURL(url);
    queryClient.invalidateQueries({ queryKey: [`/api/broker-portal/handoffs/${id}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/broker-portal/handoffs"] });
    setSendOpen(false);
  }

  if (isLoading || !data) {
    return (
      <SterlingShell>
        <p>Opening file…</p>
      </SterlingShell>
    );
  }

  const missingCount = data.missing?.length || 0;

  return (
    <SterlingShell wide>
      <div className="scf-file">
        <aside className="scf-rail" style={{ width: railWidth }} data-testid="sterling-rail">
          <div className="scf-rail-head">
            <Link href="/broker-portal" className="scf-crumb">
              ← Cases
            </Link>
            <button
              type="button"
              className="scf-rail-expand"
              data-testid="sterling-rail-expand"
              onClick={() => persistRail(railWidth >= RAIL_WIDE - 20 ? RAIL_DEFAULT : RAIL_WIDE)}
            >
              {railWidth >= RAIL_WIDE - 20 ? "Narrow" : "Expand"}
            </button>
          </div>
          <div>
            <div className="scf-name">{data.companyName}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span className="scf-pill navy">
                {data.status === "sent" ? "Sent" : data.status === "returned" ? "Returned" : "Awaiting recommendation"}
              </span>
              {data.loanAmount ? <span className="scf-pill muted">{money(data.loanAmount)}{data.term ? ` · ${data.term} months` : ""}</span> : null}
              {missingCount ? <span className="scf-pill warn">{missingCount} missing</span> : null}
              {data.application?.signed ? (
                <span className="scf-pill navy">Application signed</span>
              ) : data.application?.sentAt ? (
                <span className="scf-pill warn">Awaiting customer signature</span>
              ) : (
                <span className="scf-pill muted">Application not sent</span>
              )}
            </div>
          </div>

          {missingCount ? (
            <div className="scf-block scf-flag">
              <h4>Flags</h4>
              {data.missing.map((item) => (
                <div key={item.id} className="scf-doc">
                  <span>{item.label}</span>
                  <span className="scf-miss">Missing</span>
                </div>
              ))}
            </div>
          ) : null}

          <details className="scf-acc">
            <summary>Documents · {data.attachments.filter((a) => a.attached).length} of {data.attachments.length}</summary>
            <div className="scf-acc-body">
              {data.attachments.map((item) => (
                <div key={item.id} className="scf-doc" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{item.label}</span>
                    {item.attached ? <span className="scf-ok">On file</span> : <span className="scf-miss">Missing</span>}
                  </div>
                  {item.files?.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {item.files.map((file) => (
                        <a
                          key={file.id}
                          className="scf-file-link"
                          href={`/api/broker-portal/handoffs/${id}/documents/${file.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {file.fileName}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {data.otherDocuments?.length ? (
                <div className="scf-doc" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
                  <span>Other files on the Nexus record</span>
                  {data.otherDocuments.map((file) => (
                    <a
                      key={file.id}
                      className="scf-file-link"
                      href={`/api/broker-portal/handoffs/${id}/documents/${file.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {file.fileName}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </details>

          {(["background", "theBusiness"] as SterlingCopyField[]).map((field) => (
            <details key={field} className="scf-acc" data-testid={`sterling-acc-${field}`}>
              <summary>{STERLING_COPY_LABELS[field]}</summary>
              <div className="scf-acc-body">
                <CopyArea
                  field={field}
                  value={copy[field] || ""}
                  labelled={false}
                  onChange={(value) => setCopy((prev) => ({ ...prev, [field]: value }))}
                  onSave={(value) => saveCopy.mutate({ ...copy, recommendation, [field]: value })}
                />
              </div>
            </details>
          ))}

          <details className="scf-acc" data-testid="sterling-acc-campari">
            <summary>CAMPARI</summary>
            <div className="scf-acc-body">
              {STERLING_CAMPARI_FIELDS.map((field) => (
                <CopyArea
                  key={field}
                  field={field}
                  value={copy[field] || ""}
                  onChange={(value) => setCopy((prev) => ({ ...prev, [field]: value }))}
                  onSave={(value) => saveCopy.mutate({ ...copy, recommendation, [field]: value })}
                />
              ))}
            </div>
          </details>

          {(["financials", "dealSummary", "forecastCritique"] as SterlingCopyField[]).map((field) => (
            <details key={field} className="scf-acc" data-testid={`sterling-acc-${field}`}>
              <summary>{STERLING_COPY_LABELS[field]}</summary>
              <div className="scf-acc-body">
                <CopyArea
                  field={field}
                  value={copy[field] || ""}
                  labelled={false}
                  onChange={(value) => setCopy((prev) => ({ ...prev, [field]: value }))}
                  onSave={(value) => saveCopy.mutate({ ...copy, recommendation, [field]: value })}
                  rows={5}
                />
              </div>
            </details>
          ))}

          <details className="scf-acc" open data-testid="sterling-acc-recommendation">
            <summary>Recommendation</summary>
            <div className="scf-acc-body">
              <p className="lede" style={{ fontSize: 12 }}>Needed before you approve. Reprints on the proposal.</p>
              <CopyArea
                field="recommendation"
                value={recommendation}
                labelled={false}
                onChange={(value) => {
                  setRecommendation(value);
                  setCopy((prev) => ({ ...prev, recommendation: value }));
                }}
                onSave={(value) => {
                  setRecommendation(value);
                  saveCopy.mutate({ ...copy, recommendation: value });
                }}
                rows={5}
                placeholder="Write the recommendation here."
              />
            </div>
          </details>

          <button
            className="scf-go"
            type="button"
            data-testid="sterling-send-customer"
            disabled={sendToCustomer.isPending}
            onClick={() => sendToCustomer.mutate()}
          >
            {data.application?.sentAt ? "Copy customer link again" : "Send application to customer"}
          </button>
          {customerLink ? (
            <p className="lede" style={{ fontSize: 12, wordBreak: "break-all" }}>
              Customer link:{" "}
              <a className="scf-file-link" href={customerLink} target="_blank" rel="noreferrer">
                {customerLink}
              </a>
            </p>
          ) : null}
          <button
            className="scf-go"
            type="button"
            onClick={() => {
              if (!recommendation.trim()) {
                setError("Write a recommendation before approving.");
                return;
              }
              if (!data.application?.signed) {
                setError("Wait for the customer to complete and e-sign before sending the pack.");
                return;
              }
              setError(null);
              saveCopy.mutate({ ...copy, recommendation });
              setSendOpen(true);
            }}
          >
            Approve
          </button>
          <button className="scf-back" type="button" onClick={() => setReturnOpen(true)}>
            Return to Nexus
          </button>
          {error ? <p className="scf-miss">{error}</p> : null}
        </aside>
        <button
          type="button"
          className="scf-rail-grip"
          aria-label="Resize navigation"
          data-testid="sterling-rail-grip"
          onPointerDown={onRailResizeStart}
        />
        <section className="scf-desk">
          <div className="scf-desk-tabs">
            <button type="button" className={desk === "proposal" ? "on" : ""} onClick={() => setDesk("proposal")}>
              Funding proposal
            </button>
            <button type="button" className={desk === "handover" ? "on" : ""} onClick={() => setDesk("handover")}>
              Handover pack
              {data.handover ? ` · ${data.handover.answered}/${data.handover.total}` : ""}
            </button>
            <button
              type="button"
              className={desk === "application" ? "on" : ""}
              data-testid="sterling-tab-application"
              onClick={() => setDesk("application")}
            >
              Application form
            </button>
          </div>
          {desk === "application" ? (
            <>
              <div className="scf-desk-tabs">
                {data.lenders.map((lender) => (
                  <button
                    key={lender.id}
                    type="button"
                    className={appLender === lender.id ? "on" : ""}
                    data-testid={`sterling-app-lender-${lender.id}`}
                    onClick={() => setAppLender(lender.id as SterlingLenderId)}
                  >
                    {lender.label}
                  </button>
                ))}
              </div>
              <a
                className="scf-crumb"
                data-testid="sterling-app-docx"
                href={`/api/broker-portal/handoffs/${id}/application.docx?lender=${appLender}`}
              >
                Download Word form
              </a>
            </>
          ) : null}
          {desk === "proposal" ? (
            <PreviewFrame title="Funding proposal" src={`/api/broker-portal/handoffs/${id}/report.html?r=${previewKey}`} />
          ) : desk === "handover" ? (
            <PreviewFrame title="Handover pack" src={`/api/broker-portal/handoffs/${id}/handover.html`} />
          ) : (
            <PreviewFrame
              title="Application form"
              src={`/api/broker-portal/handoffs/${id}/application.html?lender=${appLender}&r=${previewKey}`}
            />
          )}
        </section>
      </div>

      {sendOpen ? (
        <div className="scf-overlay" onClick={() => setSendOpen(false)}>
          <div className="scf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="scf-modal-bar" />
            <div className="scf-modal-body">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <p className="scf-crumb">{data.companyName}</p>
                  <h1>Send the application</h1>
                  <p className="lede">Each pack is auto-filled from the Nexus file. You download the zip and email the lender.</p>
                </div>
                <button className="scf-back" type="button" onClick={() => setSendOpen(false)}>
                  Cancel
                </button>
              </div>
              {missingCount ? (
                <div className="scf-warn">
                  {missingCount} items still missing. They appear on every pack. Send is not blocked.
                </div>
              ) : null}
              <div className="scf-sends">
                {data.lenders.map((lender) => (
                  <article key={lender.id} className="scf-send">
                    <div className="scf-brand">
                      <img src={lender.logo} alt={lender.label} />
                    </div>
                    <div className="scf-send-inner">
                      <p className="scf-ok" style={{ marginBottom: 8 }}>AUTO-FILLED</p>
                      {data.packLines.map((line, i) => (
                        <div key={i} className="scf-doc">
                          <span style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <Tick ok={line.ok} />
                            {line.label}
                          </span>
                        </div>
                      ))}
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eef2f6" }}>
                        <button className="scf-send-btn" type="button" onClick={() => void sendPack(lender.id)}>
                          {lender.sendLabel}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {returnOpen ? (
        <div className="scf-overlay" onClick={() => setReturnOpen(false)}>
          <div className="scf-modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="scf-modal-bar" />
            <div className="scf-modal-body">
              <h1>Return to Nexus</h1>
              <p className="lede">Tell the team what is missing or why the file is not ready to send.</p>
              <textarea className="scf-area" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="scf-go" type="button" disabled={!returnNote.trim() || returnFile.isPending} onClick={() => returnFile.mutate()}>
                  Return file
                </button>
                <button className="scf-back" type="button" onClick={() => setReturnOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </SterlingShell>
  );
}
