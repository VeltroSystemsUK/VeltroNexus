import { useEffect, useState } from "react";
import { calculateTtp, formatGBP } from "@shared/learnTools";
import { LearnCta, PackagerLine, setLearnMeta } from "./LearnHome";
import { EmailMeThis } from "./LearnTools";

export default function LearnToolTtp() {
  const [arrears, setArrears] = useState(10000);
  const [periodMonths, setPeriodMonths] = useState(12);
  const [includeInterest, setIncludeInterest] = useState(false);
  const [annualRatePercent, setAnnualRatePercent] = useState(7.5);

  useEffect(() => {
    setLearnMeta(
      "Time to Pay Calculator — Strata Learn",
      "Estimate a monthly instalment for HMRC arrears. Indicative only, not a Time to Pay offer.",
    );
  }, []);

  const result = calculateTtp({ arrears, periodMonths, includeInterest, annualRatePercent });

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-['Space_Mono'] text-emerald-400 text-sm">Tools</p>
        <h1 className="font-['Unbounded'] text-3xl md:text-4xl tracking-tight leading-tight">
          Time to Pay Calculator
        </h1>
        <p className="text-lg text-zinc-300 max-w-2xl">
          A rough monthly instalment for spreading HMRC arrears. This is not a Time to Pay offer — HMRC sets the
          actual terms.
        </p>
        <PackagerLine />
      </header>

      <div className="grid gap-8 md:grid-cols-2 max-w-3xl">
        <div className="space-y-5">
          <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-zinc-400">
            Total HMRC arrears (£)
            <input
              type="number"
              min={0}
              value={arrears}
              onChange={(e) => setArrears(Number(e.target.value))}
              className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-zinc-400">
            Repayment period (months, max 12)
            <input
              type="number"
              min={1}
              max={12}
              value={periodMonths}
              onChange={(e) => setPeriodMonths(Number(e.target.value))}
              className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={includeInterest}
              onChange={(e) => setIncludeInterest(e.target.checked)}
              className="mt-1"
            />
            <span>Include an estimated HMRC late-payment interest rate</span>
          </label>
          {includeInterest && (
            <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-zinc-400">
              Estimated annual rate (%)
              <input
                type="number"
                min={0}
                step={0.01}
                value={annualRatePercent}
                onChange={(e) => setAnnualRatePercent(Number(e.target.value))}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
              />
              <span className="normal-case text-zinc-500">Check gov.uk for the current published rate.</span>
            </label>
          )}
        </div>

        <div className="rounded-xl border border-white/10 p-6 space-y-4 self-start">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Estimated monthly instalment</p>
            <p className="font-['Unbounded'] text-3xl tracking-tight text-emerald-400">
              {formatGBP(result.monthlyInstalment)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">Total repayable</p>
              <p className="text-zinc-100">{formatGBP(result.totalRepayable)}</p>
            </div>
            {includeInterest && (
              <div>
                <p className="text-zinc-500">Estimated interest</p>
                <p className="text-zinc-100">{formatGBP(result.totalInterest)}</p>
              </div>
            )}
          </div>
          <EmailMeThis
            tool="ttp-calculator"
            payload={() => ({ arrears, periodMonths, includeInterest, annualRatePercent })}
          />
        </div>
      </div>

      <section className="space-y-4 rounded-xl border border-white/10 p-6 max-w-2xl">
        <p className="text-sm text-zinc-400">
          Indicative only, not a Time to Pay offer or a lending decision. Confirm the actual arrangement with
          HMRC's Business Payment Support Service. Strata Finance packages Time to Pay applications; we do not
          lend.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 p-6">
        <h2 className="font-['Unbounded'] text-xl tracking-tight">Next step</h2>
        <LearnCta />
      </section>
    </div>
  );
}
