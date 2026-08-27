import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { SterlingShell } from "@/pages/sterling/SterlingShell";

type HandoffRow = {
  id: number;
  companyName: string;
  status?: string;
  flagCount?: number;
  sentAt?: string;
  updatedAt?: string;
  loanAmount?: number;
  term?: number;
};

function when(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function statusLabel(status?: string) {
  if (status === "sent") return "Sent";
  if (status === "returned") return "Returned to Nexus";
  return "Awaiting recommendation";
}

export default function BrokerPortal() {
  const { data: handoffs, isLoading } = useQuery<HandoffRow[]>({
    queryKey: ["/api/broker-portal/handoffs"],
  });

  return (
    <SterlingShell>
      <div className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#1b5f9e", fontWeight: 600 }}>
        Open files
      </div>
      <h1>Cases</h1>
      <p className="lede">Files sent from Nexus, ready for recommendation.</p>
      <section className="scf-card">
        {isLoading && <p className="lede" style={{ margin: 0 }}>Checking files…</p>}
        {!isLoading && (!handoffs || handoffs.length === 0) && (
          <p className="lede" style={{ margin: 0 }}>No files have been sent to you yet.</p>
        )}
        {handoffs?.map((h) => (
          <Link key={h.id} href={`/broker-portal/${h.id}`} className="scf-row">
            <div>
              <strong>{h.companyName}</strong>
              <span className="meta">
                {statusLabel(h.status)}
                {h.flagCount ? ` · ${h.flagCount} flags` : ""}
                {h.updatedAt || h.sentAt ? ` · ${when(h.updatedAt || h.sentAt)}` : ""}
              </span>
            </div>
            <span className="scf-open">Open</span>
          </Link>
        ))}
      </section>
    </SterlingShell>
  );
}
