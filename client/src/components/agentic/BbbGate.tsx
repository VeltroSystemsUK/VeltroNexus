import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BBB_QUESTIONS, BBB_SCHEME_NAME, type BbbAssessment } from "@shared/bbbEligibility";
import type { AgenticDealFile } from "@shared/agenticWorkflow";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

export function BbbGate({ deal }: { deal: AgenticDealFile }) {
  const assessment: BbbAssessment | undefined = deal.bbbEligibility;
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>(assessment?.answers || {});

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/agentic/deals/${deal.id}/bbb`, "POST", { answers });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agentic/deals"] }),
  });

  const tone =
    assessment?.status === "pass"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : assessment?.status === "fail"
        ? "border-red-500/30 bg-red-500/10 text-red-100"
        : "border-amber-500/30 bg-amber-500/10 text-amber-100";

  return (
    <div className={`space-y-3 rounded-md border px-3 py-3 ${tone}`}>
      <div>
        <p className="text-xs uppercase tracking-wide opacity-80">{BBB_SCHEME_NAME}</p>
        <p className="text-sm font-medium">
          {assessment?.status === "pass"
            ? "Eligible — application may be considered"
            : assessment?.status === "fail"
              ? "Not eligible — application cannot be considered"
              : "Eligibility not confirmed — application is held"}
        </p>
      </div>
      {assessment?.reasons?.length ? (
        <ul className="text-xs space-y-1 opacity-90">
          {assessment.reasons.slice(0, 4).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {assessment?.status !== "pass" && (
        <div className="space-y-2">
          {BBB_QUESTIONS.map((question) => (
            <label key={question.id} className="flex items-start justify-between gap-3 text-xs">
              <span className="text-slate-200">{question.text}</span>
              <select
                className="bg-black/30 border border-white/10 rounded px-1 py-0.5"
                value={answers[question.id] === true ? "yes" : answers[question.id] === false ? "no" : ""}
                onChange={(event) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [question.id]: event.target.value === "" ? undefined : event.target.value === "yes",
                  }))
                }
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          ))}
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save BBB check"}
          </Button>
        </div>
      )}
    </div>
  );
}
