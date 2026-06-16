import PipelineStats from "@/components/PipelineStats";
import ActivityCalendar from "@/components/ActivityCalendar";
import TaskReminders from "@/components/TaskReminders";
import ToDoList from "@/components/ToDoList";
import { AutoQualifiedLeadsWidget } from "@/components/dashboard/AutoQualifiedLeadsWidget";
import { OnboardingChecklist } from "@/components/onboarding";

interface StageSummary {
  label: string;
  count: number;
  value?: string;
}

interface FlightDeckProps {
  stats: {
    totalProspects: number;
    activeProspects: number;
    totalValue: string;
    approvedCount: number;
  };
  stages: StageSummary[];
  userName?: string;
}

/** Live stage funnel — bar width is proportional to deal count per stage. */
function StageFunnel({ stages }: { stages: StageSummary[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="tile p-5 reveal">
      <div className="kicker">Stage funnel</div>
      <div className="mt-4 space-y-3.5">
        {stages.map((s, i) => {
          const pct = Math.round((s.count / max) * 100);
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground truncate">{s.label}</span>
                <span className="text-foreground font-medium tabular-nums shrink-0 ml-2">
                  {s.count}
                  {s.value ? <span className="text-muted-foreground"> · {s.value}</span> : null}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(pct, 4)}%`, opacity: 1 - i * 0.11 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FlightDeck({ stats, stages, userName }: FlightDeckProps) {
  return (
    <div className="px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8 pb-24 md:pb-28">
      <OnboardingChecklist />

      {/* Hero metrics */}
      <section>
        <div className="mb-4 md:mb-5">
          <span className="kicker">Mission control</span>
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight mt-1">
            {userName ? `Good to see you, ${userName}.` : "Overview"}
          </h2>
        </div>
        <PipelineStats
          totalProspects={stats.totalProspects}
          activeProspects={stats.activeProspects}
          totalValue={stats.totalValue}
          approvedCount={stats.approvedCount}
        />
      </section>

      {/* Live feed + funnel */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-2 min-h-[360px]">
          <AutoQualifiedLeadsWidget />
        </div>
        <StageFunnel stages={stages} />
      </section>

      {/* Activity */}
      <section className="space-y-4 md:space-y-5">
        <span className="kicker">Activity</span>
        <ActivityCalendar />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          <TaskReminders />
          <ToDoList />
        </div>
      </section>
    </div>
  );
}
