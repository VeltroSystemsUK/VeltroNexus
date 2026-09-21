import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { ChargeLetter } from "@shared/chargeLetter";

export default function ChargeLetters() {
  const { data, isLoading, error } = useQuery<{ letters: ChargeLetter[] }>({
    queryKey: ["/api/god/crm/charge-letters?format=json&limit=20"],
  });
  const letters = data?.letters || [];

  return (
    <div className="charge-letters-page min-h-screen bg-[#f4f1ea] text-[#1a1814]">
      <div className="toolbar print:hidden border-b border-stone-200 bg-white px-4 py-3 text-sm flex items-center justify-between gap-3">
        <div>
          <Link href="/crm" className="underline mr-3">
            Clients
          </Link>
          Personal letters for business-loan charges. Print → PDF, black, second class. Together-only is omitted.
        </div>
        <button type="button" className="rounded border px-3 py-1" onClick={() => window.print()}>
          Print
        </button>
      </div>
      {isLoading && <p className="p-8">Loading letters…</p>}
      {error && <p className="p-8">Could not load letters. Stay signed in on this tab.</p>}
      {!isLoading && !error && letters.length === 0 && (
        <p className="p-8 max-w-xl">
          No letters yet. Jev has to mark a card <code>charge_sme</code> with a business-loan lender (Iwoca etc.). Together-only property charges are left out on purpose.
        </p>
      )}
      {letters.map((letter, i) => (
        <article
          key={i}
          className="letter mx-auto my-4 box-border max-w-[210mm] bg-[#fffef8] px-[22mm] py-[22mm] print:my-0"
          style={{ pageBreakAfter: "always" }}
        >
          <p className="mb-7 text-right">{letter.dateLine}</p>
          <p className="mb-7 leading-relaxed">
            {letter.addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
          <p className="mb-4">{letter.greeting}</p>
          {letter.body.map((p) => (
            <p key={p.slice(0, 24)} className="mb-3.5 max-w-[36em] text-[12.5pt] leading-relaxed">
              {p}
            </p>
          ))}
          <p className="mt-7">Yours sincerely,</p>
          <p className="mt-1 italic text-[16pt]">{letter.signOff}</p>
          <p className="m-0 text-[11pt] text-stone-600">{letter.signRole}</p>
        </article>
      ))}
    </div>
  );
}
