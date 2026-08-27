import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SterlingShell } from "./SterlingShell";

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

export default function SterlingFile() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading } = useQuery<FilePayload>({
    queryKey: [`/api/broker-portal/handoffs/${id}`],
    enabled: Boolean(id),
  });
  const [recommendation, setRecommendation] = useState("");
  const [desk, setDesk] = useState<"proposal" | "handover">("proposal");
  const [sendOpen, setSendOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.recommendation != null) setRecommendation(data.recommendation);
  }, [data?.recommendation]);

  const saveRec = useMutation({
    mutationFn: async (text: string) => {
      await apiRequest(`/api/broker-portal/handoffs/${id}/recommendation`, "PUT", { recommendation: text });
    },
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
        <aside className="scf-rail">
          <Link href="/broker-portal" className="scf-crumb">
            ← Cases
          </Link>
          <div>
            <div className="scf-name">{data.companyName}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span className="scf-pill navy">
                {data.status === "sent" ? "Sent" : data.status === "returned" ? "Returned" : "Awaiting recommendation"}
              </span>
              {data.loanAmount ? <span className="scf-pill muted">{money(data.loanAmount)}{data.term ? ` · ${data.term} months` : ""}</span> : null}
              {missingCount ? <span className="scf-pill warn">{missingCount} missing</span> : null}
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

          <div className="scf-block">
            <h4>Documents · {data.attachments.filter((a) => a.attached).length} of {data.attachments.length}</h4>
            <div style={{ maxHeight: 280, overflow: "auto" }}>
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
          </div>

          <div className="scf-block">
            <h4>Recommendation</h4>
            <textarea
              className="scf-area"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              onBlur={() => saveRec.mutate(recommendation)}
              placeholder="Write the recommendation here. It stays in this portal."
            />
          </div>

          <button
            className="scf-go"
            type="button"
            onClick={() => {
              if (!recommendation.trim()) {
                setError("Write a recommendation before approving.");
                return;
              }
              setError(null);
              saveRec.mutate(recommendation);
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
        <section className="scf-desk">
          <div className="scf-desk-tabs">
            <button type="button" className={desk === "proposal" ? "on" : ""} onClick={() => setDesk("proposal")}>
              Funding proposal
            </button>
            <button type="button" className={desk === "handover" ? "on" : ""} onClick={() => setDesk("handover")}>
              Handover pack
              {data.handover ? ` · ${data.handover.answered}/${data.handover.total}` : ""}
            </button>
          </div>
          {desk === "proposal" ? (
            <iframe title="Funding proposal" src={`/api/broker-portal/handoffs/${id}/report.html`} />
          ) : (
            <iframe title="Handover pack" src={`/api/broker-portal/handoffs/${id}/handover.html`} />
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
