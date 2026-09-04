import { useEffect, useState } from "react";
import {
  calculateDebtStress,
  emptyOutgoings,
  formatGBP,
  type DebtFrequency,
  type DebtRow,
  type Outgoings,
} from "@shared/learnTools";
import { LearnCta, PackagerLine, setLearnMeta } from "./LearnHome";
import { EmailMeThis } from "./LearnTools";

const OUTGOING_FIELDS: { key: keyof Outgoings; label: string }[] = [
  { key: "payroll", label: "Payroll" },
  { key: "rent", label: "Rent / overheads" },
  { key: "hmrcVat", label: "HMRC / VAT" },
  { key: "suppliers", label: "Suppliers" },
  { key: "other", label: "Other" },
];

let nextRowId = 1;

function newDebtRow(): DebtRow {
  return { id: String(nextRowId++), label: "", balance: 0, repaymentAmount: 0, frequency: "monthly" };
}

export default function LearnToolDebtStress() {
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [cashOnHand, setCashOnHand] = useState(0);
  const [outgoings, setOutgoings] = useState<Outgoings>(emptyOutgoings());
  const [debts, setDebts] = useState<DebtRow[]>([newDebtRow()]);

  useEffect(() => {
    setLearnMeta(
      "Debt Stress Check — Strata Learn",
      "See your combined debt repayments against income, cost per trading day, and whether facilities are stacking.",
    );
  }, []);

  const result = calculateDebtStress({ monthlyIncome, outgoings, debts, cashOnHand });

  function updateDebt(id: string, patch: Partial<DebtRow>) {
    setDebts((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-['Space_Mono'] text-emerald-400 text-sm">Tools</p>
        <h1 className="font-['Unbounded'] text-3xl md:text-4xl tracking-tight leading-tight">Debt Stress Check</h1>
        <p className="text-lg text-zinc-300 max-w-2xl">
          Income, outgoings, and every facility you're repaying — in one place, updating as you type.
        </p>
        <PackagerLine />
      </header>

      <section className="space-y-4 max-w-xl">
        <h2 className="font-['Unbounded'] text-xl tracking-tight">Income &amp; cash</h2>
        <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-zinc-400">
          Monthly income (£)
          <input
            type="number"
            min={0}
            value={monthlyIncome}
            onChange={(e) => setMonthlyIncome(Number(e.target.value))}
            className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-zinc-400">
          Cash on hand (£, optional)
          <input
            type="number"
            min={0}
            value={cashOnHand}
            onChange={(e) => setCashOnHand(Number(e.target.value))}
            className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
          />
        </label>
      </section>

      <section className="space-y-4 max-w-xl">
        <h2 className="font-['Unbounded'] text-xl tracking-tight">Monthly outgoings</h2>
        <div className="grid grid-cols-2 gap-4">
          {OUTGOING_FIELDS.map((field) => (
            <label key={field.key} className="grid gap-1 text-xs uppercase tracking-[0.12em] text-zinc-400">
              {field.label} (£)
              <input
                type="number"
                min={0}
                value={outgoings[field.key]}
                onChange={(e) => setOutgoings({ ...outgoings, [field.key]: Number(e.target.value) })}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-['Unbounded'] text-xl tracking-tight">Debts &amp; facilities</h2>
          <button
            type="button"
            onClick={() => setDebts((rows) => [...rows, newDebtRow()])}
            className="text-sm text-emerald-400 hover:underline"
          >
            + Add facility
          </button>
        </div>
        <div className="space-y-3">
          {debts.map((row) => (
            <div key={row.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
              <label className="grid gap-1 text-xs uppercase tracking-[0.1em] text-zinc-500">
                Facility
                <input
                  value={row.label}
                  onChange={(e) => updateDebt(row.id, { label: e.target.value })}
                  placeholder="e.g. MCA — Lender A"
                  className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                />
              </label>
              <label className="grid gap-1 text-xs uppercase tracking-[0.1em] text-zinc-500">
                Balance (£)
                <input
                  type="number"
                  min={0}
                  value={row.balance}
                  onChange={(e) => updateDebt(row.id, { balance: Number(e.target.value) })}
                  className="w-28 rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                />
              </label>
              <label className="grid gap-1 text-xs uppercase tracking-[0.1em] text-zinc-500">
                Repayment (£)
                <input
                  type="number"
                  min={0}
                  value={row.repaymentAmount}
                  onChange={(e) => updateDebt(row.id, { repaymentAmount: Number(e.target.value) })}
                  className="w-28 rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                />
              </label>
              <label className="grid gap-1 text-xs uppercase tracking-[0.1em] text-zinc-500">
                Frequency
                <select
                  value={row.frequency}
                  onChange={(e) => updateDebt(row.id, { frequency: e.target.value as DebtFrequency })}
                  className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setDebts((rows) => rows.filter((r) => r.id !== row.id))}
                disabled={debts.length === 1}
                className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-30 pb-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 p-6 space-y-5 max-w-2xl">
        <h2 className="font-['Unbounded'] text-xl tracking-tight">Your position</h2>
        <div className="grid grid-cols-2 gap-5 text-sm">
          <div>
            <p className="text-zinc-500">Total outstanding debt</p>
            <p className="text-lg text-zinc-100">{formatGBP(result.totalOutstandingDebt)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Combined monthly debt repayments</p>
            <p className="text-lg text-zinc-100">{formatGBP(result.totalMonthlyDebtService)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Cost per trading day</p>
            <p className="font-['Unbounded'] text-2xl text-emerald-400">{formatGBP(result.costPerTradingDay)}</p>
          </div>
          <div>
            <p className="text-zinc-500">Net monthly position</p>
            <p className={`text-lg ${result.netMonthlyPosition < 0 ? "text-red-400" : "text-zinc-100"}`}>
              {formatGBP(result.netMonthlyPosition)}
            </p>
          </div>
          {monthlyIncome > 0 && (
            <div>
              <p className="text-zinc-500">Debt-service ratio</p>
              <p className="text-lg text-zinc-100">{Math.round(result.debtServiceRatio * 100)}% of income</p>
            </div>
          )}
          {result.runwayMonths != null && (
            <div>
              <p className="text-zinc-500">Cash runway at this rate</p>
              <p className="text-lg text-red-400">{result.runwayMonths.toFixed(1)} months</p>
            </div>
          )}
        </div>
        {result.isStacking && (
          <p className="text-sm text-amber-400/90 border-t border-white/10 pt-4">
            You have {result.stackedFacilityCount} facilities pulling from your account daily or weekly — this is
            what stacking looks like. Each one competes for the same cash before you see it.
          </p>
        )}
        <EmailMeThis
          tool="debt-stress-check"
          payload={() => ({ monthlyIncome, cashOnHand, outgoings, debts })}
        />
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 p-6 max-w-2xl">
        <p className="text-sm text-zinc-400">
          This is an indicative snapshot of your own numbers, not financial advice. Strata Finance packages UK SME
          distress-refinance files; we do not lend.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 p-6">
        <h2 className="font-['Unbounded'] text-xl tracking-tight">Next step</h2>
        <LearnCta />
      </section>
    </div>
  );
}
