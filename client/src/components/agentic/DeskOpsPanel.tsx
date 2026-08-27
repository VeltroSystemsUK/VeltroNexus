import { useQuery } from "@tanstack/react-query";
import { summariseDeskOps } from "@shared/deskOps";
import type { AgenticDealFile } from "@shared/agenticWorkflow";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type MailPayload = {
  messages?: Array<{ agentId?: string; direction?: string; status?: string }>;
};

export function DeskOpsPanel({ onDelegate }: { onDelegate?: (agentId: string) => void }) {
  const { data: deals = [], isLoading: dealsLoading } = useQuery<AgenticDealFile[]>({
    queryKey: ["/api/agentic/deals"],
  });
  const { data: mail, isLoading: mailLoading } = useQuery<MailPayload>({
    queryKey: ["/api/agent-mail"],
  });

  if (dealsLoading || mailLoading) {
    return <p className="text-sm text-muted-foreground">Loading desk counts…</p>;
  }

  const rows = summariseDeskOps({ deals, mail: mail?.messages || [] });
  const waitingYou = rows.reduce((sum, row) => sum + row.waitingYou, 0);
  const mailed = rows.reduce((sum, row) => sum + row.mailed, 0);
  const notDelivered = rows.reduce((sum, row) => sum + row.notDelivered, 0);
  const open = rows.reduce((sum, row) => sum + row.open, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Open files" value={open} />
        <Stat label="Waiting on you" value={waitingYou} warn={waitingYou > 0} />
        <Stat label="Emails delivered" value={mailed} />
        <Stat label="Not delivered" value={notDelivered} warn={notDelivered > 0} />
      </div>
      <p className="text-xs text-slate-500">
        Counts come from Deal files and the mail log. Mock or failed SMTP is “not delivered”. Hibernated
        desks (Oliver, Nathan, ARES) are not listed.
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-950 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Desk</th>
              <th className="px-3 py-2 font-medium">Open</th>
              <th className="px-3 py-2 font-medium">Waiting on you</th>
              <th className="px-3 py-2 font-medium">Mailed</th>
              <th className="px-3 py-2 font-medium">Not delivered</th>
              <th className="px-3 py-2 font-medium">Last file</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.agentId} className="border-t border-slate-800">
                <td className="px-3 py-2">
                  <p className="text-white font-medium">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.role}</p>
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-200">{row.open}</td>
                <td className={`px-3 py-2 tabular-nums ${row.waitingYou ? "text-amber-200" : "text-slate-400"}`}>
                  {row.waitingYou}
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-200">{row.mailed}</td>
                <td className={`px-3 py-2 tabular-nums ${row.notDelivered ? "text-red-300" : "text-slate-400"}`}>
                  {row.notDelivered}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {row.lastFile ? (
                    <span>
                      {row.lastFile}
                      {row.lastEvent ? <span className="block text-[11px] text-slate-500">{row.lastEvent}</span> : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDelegate?.(row.agentId)}
                  >
                    Delegate
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`text-2xl font-semibold tabular-nums ${warn ? "text-amber-200" : "text-white"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
