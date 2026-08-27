import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SterlingShell } from "./SterlingShell";
import type { SterlingLenderDestination } from "@shared/sterlingPortal";

type LenderRow = {
  id: string;
  label: string;
  logo: string;
  destination: SterlingLenderDestination;
};

export default function SterlingSettings() {
  const { data } = useQuery<{ lenders: LenderRow[] }>({
    queryKey: ["/api/broker-portal/settings"],
  });
  const [draft, setDraft] = useState<Record<string, SterlingLenderDestination>>({});

  useEffect(() => {
    if (!data?.lenders) return;
    const next: Record<string, SterlingLenderDestination> = {};
    for (const row of data.lenders) next[row.id] = { ...row.destination };
    setDraft(next);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/broker-portal/settings", "PUT", draft);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker-portal/settings"] });
    },
  });

  function patch(id: string, field: keyof SterlingLenderDestination, value: string) {
    setDraft((current) => ({
      ...current,
      [id]: { ...(current[id] || { email: "", apiUrl: "", apiKey: "" }), [field]: value },
    }));
  }

  return (
    <SterlingShell>
      <h1>Lender destinations</h1>
      <p className="lede">
        Store the email and/or API for each lender. Send still downloads a zip today — wiring these into the send step comes next.
      </p>
      {(data?.lenders || []).map((lender) => {
        const dest = draft[lender.id] || { email: "", apiUrl: "", apiKey: "" };
        return (
          <section key={lender.id} className="scf-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <img src={lender.logo} alt="" style={{ height: 36, width: "auto", objectFit: "contain" }} />
              <h2 style={{ margin: 0, fontSize: 18, color: "#123a66" }}>{lender.label}</h2>
            </div>
            <label className="scf-field">
              Contact email
              <input value={dest.email} onChange={(e) => patch(lender.id, "email", e.target.value)} placeholder="enquiries@lender.co.uk" />
            </label>
            <label className="scf-field">
              API URL
              <input value={dest.apiUrl} onChange={(e) => patch(lender.id, "apiUrl", e.target.value)} placeholder="https://…" />
            </label>
            <label className="scf-field">
              API key
              <input value={dest.apiKey} onChange={(e) => patch(lender.id, "apiKey", e.target.value)} type="password" autoComplete="off" />
            </label>
          </section>
        );
      })}
      <button className="scf-go" type="button" style={{ width: 220 }} disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : save.isSuccess ? "Saved" : "Save destinations"}
      </button>
    </SterlingShell>
  );
}
