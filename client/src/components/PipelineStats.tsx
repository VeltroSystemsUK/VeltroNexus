import { Building2, TrendingUp, CheckCircle2 } from "lucide-react";
import type { MouseEvent } from "react";

interface PipelineStatsProps {
  totalProspects: number;
  activeProspects: number;
  totalValue: string;
  approvedCount: number;
}

function handleSpotlight(e: MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
  el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
}

function SmallTile({
  label,
  value,
  sub,
  icon: Icon,
  emerald,
  delay,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: typeof Building2;
  emerald?: boolean;
  delay: number;
}) {
  return (
    <div
      className="tile reveal flex flex-col justify-between p-4 md:p-5 min-h-[120px] md:min-h-[148px]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="kicker">{label}</span>
        <span className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-primary/10 border border-primary/15 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </span>
      </div>
      <div>
        <div
          className={`text-2xl md:text-4xl font-semibold tracking-tight tabular-nums ${
            emerald ? "text-primary" : "text-foreground"
          }`}
        >
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{sub}</p>
      </div>
    </div>
  );
}

export default function PipelineStats({
  totalProspects,
  activeProspects,
  totalValue,
  approvedCount,
}: PipelineStatsProps) {
  const conversion =
    totalProspects > 0 ? Math.round((approvedCount / totalProspects) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
      {/* Hero — pipeline value, liquid chrome + spotlight + animated border */}
      <div
        onMouseMove={handleSpotlight}
        className="tile gradient-border spotlight reveal col-span-2 lg:col-span-3 overflow-hidden p-5 md:p-7 flex flex-col justify-between min-h-[152px] md:min-h-[316px]"
        data-testid="text-pipeline-value"
      >
        <div className="relative z-[1] flex items-center justify-between">
          <span className="kicker">Pipeline value</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.5)]" />
            Live
          </span>
        </div>

        <div className="relative z-[1]">
          <div className="chrome-text font-semibold tracking-tight leading-none tabular-nums text-4xl md:text-7xl">
            {totalValue}
          </div>
          <div className="mt-4 md:mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium tabular-nums">{activeProspects}</span> active
            </span>
            <span className="text-muted-foreground">
              <span className="text-primary font-medium tabular-nums">{approvedCount}</span> approved
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium tabular-nums">{conversion}%</span> conversion
            </span>
          </div>
        </div>
      </div>

      {/* Supporting tiles — monochrome, emerald accent only */}
      <div className="col-span-2 lg:col-span-3 grid grid-cols-2 gap-3 md:gap-4 lg:grid-rows-2">
        <SmallTile
          label="Prospects"
          value={totalProspects}
          sub="Total in pipeline"
          icon={Building2}
          delay={80}
        />
        <SmallTile
          label="Active"
          value={activeProspects}
          sub="Currently processing"
          icon={TrendingUp}
          delay={140}
        />
        <div className="col-span-2">
          <SmallTile
            label="Approved"
            value={approvedCount}
            sub="Successfully closed"
            icon={CheckCircle2}
            emerald
            delay={200}
          />
        </div>
      </div>
    </div>
  );
}
