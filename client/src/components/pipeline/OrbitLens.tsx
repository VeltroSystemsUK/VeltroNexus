import { useMemo, useState } from "react";
import { useLocation } from "wouter";

interface OrbitProspect {
  id: number;
  company?: { name?: string } | null;
  companyName?: string;
  loanAmount?: number | null;
  stage: string;
}

interface Stage {
  value: string;
  label: string;
}

interface OrbitLensProps {
  prospects: OrbitProspect[];
  /** Active stages, ordered outer ring → inner ring (e.g. lead … submitted). */
  stages: Stage[];
  formatCurrency: (amount: number) => string;
}

function nameOf(p: OrbitProspect): string {
  return p.company?.name || p.companyName || `Deal ${p.id}`;
}

/**
 * Orbit lens — the pipeline as a spatial map. Each deal is a node on its
 * stage's ring; node size scales with loan amount; the core shows total value.
 */
export function OrbitLens({ prospects, stages, formatCurrency }: OrbitLensProps) {
  const [, navigate] = useLocation();
  const [hover, setHover] = useState<number | null>(null);

  const SIZE = 560;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const rMax = SIZE / 2 - 44;
  const rMin = 70;

  const ringRadius = (i: number) =>
    stages.length <= 1
      ? (rMax + rMin) / 2
      : rMin + (rMax - rMin) * (1 - i / (stages.length - 1));

  const byStage = useMemo(() => {
    const m: Record<string, OrbitProspect[]> = {};
    stages.forEach((s) => (m[s.value] = []));
    prospects.forEach((p) => {
      if (m[p.stage]) m[p.stage].push(p);
    });
    return m;
  }, [prospects, stages]);

  const maxAmount = Math.max(1, ...prospects.map((p) => p.loanAmount || 0));
  const nodeR = (amt: number) => 5 + Math.sqrt((amt || 0) / maxAmount) * 9;
  const total = prospects.reduce((s, p) => s + (p.loanAmount || 0), 0);
  const hovered = hover != null ? prospects.find((p) => p.id === hover) : null;

  return (
    <div className="tile p-4 md:p-6 relative overflow-hidden">
      <div className="kicker mb-3">Orbit · spatial deal map</div>

      <div className="w-full flex justify-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[560px]" style={{ aspectRatio: "1 / 1" }}>
          {/* Stage rings */}
          {stages.map((s, i) => {
            const r = ringRadius(i);
            return (
              <g key={s.value}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--foreground) / 0.08)" strokeWidth={1} strokeDasharray="2 6" />
                <text
                  x={cx}
                  y={cy - r - 6}
                  textAnchor="middle"
                  fill="hsl(var(--muted-foreground))"
                  style={{ fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}
                >
                  {s.label.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Core */}
          <circle cx={cx} cy={cy} r={rMin - 14} fill="hsl(var(--card) / 0.65)" stroke="hsl(var(--primary) / 0.4)" strokeWidth={1} />
          <text x={cx} y={cy - 2} textAnchor="middle" fill="hsl(var(--foreground))" style={{ fontSize: 19, fontWeight: 600 }}>
            {formatCurrency(total)}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="hsl(var(--muted-foreground))" style={{ fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: "0.14em" }}>
            PIPELINE
          </text>

          {/* Deal nodes */}
          {stages.map((s, i) => {
            const r = ringRadius(i);
            const list = byStage[s.value] || [];
            return list.map((p, j) => {
              const angle = (j / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2 + i * 0.45;
              const x = cx + r * Math.cos(angle);
              const y = cy + r * Math.sin(angle);
              const nr = nodeR(p.loanAmount || 0);
              const isHover = hover === p.id;
              return (
                <circle
                  key={p.id}
                  cx={x}
                  cy={y}
                  r={isHover ? nr + 3 : nr}
                  fill="hsl(var(--primary) / 0.85)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1}
                  style={{
                    cursor: "pointer",
                    filter: isHover ? "drop-shadow(0 0 7px hsl(var(--primary) / 0.7))" : "none",
                    transition: "r 0.15s ease, filter 0.15s ease",
                  }}
                  onMouseEnter={() => setHover(p.id)}
                  onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
                  onClick={() => navigate(`/prospect/${p.id}`)}
                />
              );
            });
          })}
        </svg>
      </div>

      {/* Hover readout */}
      {hovered && (
        <div className="absolute top-4 right-4 glass-subtle rounded-lg px-3 py-2 text-xs pointer-events-none">
          <div className="font-medium text-foreground">{nameOf(hovered)}</div>
          <div className="text-muted-foreground tabular-nums">
            {hovered.loanAmount ? formatCurrency(hovered.loanAmount) : "—"}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground mt-3">
        {prospects.length} deals · hover to identify · click to open the credit file
      </p>
    </div>
  );
}
