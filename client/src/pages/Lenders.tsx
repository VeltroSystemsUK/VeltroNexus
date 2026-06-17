import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Download, Check, Loader2 } from "lucide-react";
import { usePageTitle } from "@/context/LayoutContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const OUTCOME_MAP: Record<string, { label: string; cls: string }> = {
  interested: { label: "Interested", cls: "bg-primary/15 text-primary border-primary/25" },
  negotiating: { label: "Negotiating", cls: "bg-primary/15 text-primary border-primary/25" },
  no_answer: { label: "No answer", cls: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  not_interested: { label: "Not interested", cls: "bg-destructive/15 text-destructive border-destructive/25" },
  not_contacted: { label: "Not contacted", cls: "bg-white/[0.05] text-muted-foreground border-white/10" },
};

function OutcomeChip({ outcome }: { outcome?: string }) {
  const m = OUTCOME_MAP[outcome || "not_contacted"] || OUTCOME_MAP.not_contacted;
  return (
    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0", m.cls)}>
      {m.label}
    </span>
  );
}

function StatTile({ label, value, sub, emerald, delay = 0 }: { label: string; value: string | number; sub?: string; emerald?: boolean; delay?: number }) {
  return (
    <div className="tile reveal p-4 flex flex-col justify-between min-h-[100px]" style={{ animationDelay: `${delay}ms` }}>
      <span className="kicker">{label}</span>
      <div>
        <div className={cn("text-2xl md:text-3xl font-semibold tabular-nums leading-none", emerald ? "text-primary" : "text-foreground")}>{value}</div>
        {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

function TaskCheck({ label, done, doneNote, disabled, pending, onToggle }: { label: string; done: boolean; doneNote?: string; disabled?: boolean; pending?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={() => { if (!done && !disabled && !pending) onToggle(); }}
      disabled={done || disabled || pending}
      className={cn("flex items-center gap-2.5 text-sm text-left group w-full", done ? "cursor-default" : disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer")}
    >
      <span className={cn("h-5 w-5 rounded-md border flex items-center justify-center transition-all shrink-0",
        done ? "bg-primary border-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.45)]" : "border-white/20 group-hover:border-primary/60")}>
        {done ? <Check className="h-3.5 w-3.5" /> : pending ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : null}
      </span>
      <span className={cn("transition-colors", done ? "text-foreground/90 line-through decoration-primary/50" : "text-muted-foreground group-hover:text-foreground")}>{label}</span>
      {done && doneNote && <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">{doneNote}</span>}
    </button>
  );
}

function FilterGroup<T extends string>({ label, options, value, onChange, fmt }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; fmt?: (s: T) => string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">{label}</span>
      <div className="inline-flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)}
            className={cn("text-xs px-2.5 py-1 rounded-lg border transition-colors capitalize",
              value === o ? "bg-primary text-primary-foreground border-primary" : "border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20")}>
            {fmt ? fmt(o) : o}
          </button>
        ))}
      </div>
    </div>
  );
}

interface CDFI {
  id: string;
  name: string;
  website?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  postalAddress?: string;
  lendingMinQuantum?: number;
  lendingMaxQuantum?: number;
  geographicalScope?: string[];
  preferredClientTypes?: string[];
  backgroundInfo?: string;
  lastContacted?: string;
  contactOutcome?: "not_contacted" | "no_answer" | "interested" | "not_interested" | "negotiating";
  agreementStatus?: "unsigned" | "in_progress" | "signed";
  agreementSignedDate?: string;
  notes?: string;
}

// Hardcoded 25 UK Business CDFIs
const HARDCODED_CDFIS: CDFI[] = [
  { id: "1", name: "Charity Bank", website: "https://www.charitybank.org", contactName: "Business Lending", contactPhone: "+44 20 3848 4200", contactEmail: "lending@charitybank.org", postalAddress: "Cambridge CB4 0GE", lendingMinQuantum: 25000, lendingMaxQuantum: 1000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["Social Enterprises", "Charities"], backgroundInfo: "Specialist lender for charities", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "2", name: "Triodos Bank UK", website: "https://www.triodos.co.uk", contactName: "Business Lending", contactPhone: "+44 117 973 9339", contactEmail: "businesslending@triodos.co.uk", postalAddress: "Bristol BS1 5AS", lendingMinQuantum: 10000, lendingMaxQuantum: 2000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs", "Social Enterprises"], backgroundInfo: "Ethical bank", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "3", name: "Street UK", website: "https://www.street-uk.com", contactName: "Business Lending", contactPhone: "+44 207 100 1000", contactEmail: "lending@street-uk.com", postalAddress: "London EC2A 4QF", lendingMinQuantum: 5000, lendingMaxQuantum: 150000, geographicalScope: ["London", "South East"], preferredClientTypes: ["SMEs", "Entrepreneurs"], backgroundInfo: "Community lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "4", name: "Wessex Community Loans", website: "https://www.wessexcommunityloans.org.uk", contactName: "Business Lending", contactPhone: "+44 1823 327 333", contactEmail: "info@wessexcommunityloans.org.uk", postalAddress: "Taunton TA1 1RG", lendingMinQuantum: 1000, lendingMaxQuantum: 100000, geographicalScope: ["South West"], preferredClientTypes: ["SMEs"], backgroundInfo: "South West regional CDFI", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "5", name: "Aston Reinvest", website: "https://www.astonreinvest.org.uk", contactName: "Business Lending", contactPhone: "+44 121 464 6600", contactEmail: "info@astonreinvest.org.uk", postalAddress: "Birmingham B6 7BA", lendingMinQuantum: 1000, lendingMaxQuantum: 250000, geographicalScope: ["West Midlands"], preferredClientTypes: ["SMEs"], backgroundInfo: "Birmingham-based lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "6", name: "Scotwest Credit Union", website: "https://www.scotwest.co.uk", contactName: "Business Lending", contactPhone: "+44 141 248 8888", contactEmail: "business@scotwest.co.uk", postalAddress: "Glasgow G1 4LW", lendingMinQuantum: 500, lendingMaxQuantum: 50000, geographicalScope: ["Scotland"], preferredClientTypes: ["SMEs"], backgroundInfo: "Scottish business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "7", name: "Northstay", website: "https://www.northstay.org.uk", contactName: "Business Lending", contactPhone: "+44 191 281 6666", contactEmail: "business@northstay.org.uk", postalAddress: "Gateshead NE9 7JG", lendingMinQuantum: 1500, lendingMaxQuantum: 100000, geographicalScope: ["North East"], preferredClientTypes: ["SMEs"], backgroundInfo: "North East business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "8", name: "Aspire Foundation", website: "https://www.aspirefoundation.org.uk", contactName: "Business Lending", contactPhone: "+44 121 604 5000", contactEmail: "lending@aspirefoundation.org.uk", postalAddress: "Birmingham B12 0NP", lendingMinQuantum: 2000, lendingMaxQuantum: 150000, geographicalScope: ["Midlands"], preferredClientTypes: ["SMEs"], backgroundInfo: "Midlands business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "9", name: "Community Finance Solutions", website: "https://www.cfs.org.uk", contactName: "Lending Team", contactPhone: "+44 20 7588 9888", contactEmail: "lending@cfs.org.uk", postalAddress: "London N1 2HS", lendingMinQuantum: 5000, lendingMaxQuantum: 500000, geographicalScope: ["London", "South East"], preferredClientTypes: ["SMEs"], backgroundInfo: "London business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "10", name: "Funding North", website: "https://fundingnorth.com", contactName: "Business Finance", contactPhone: "+44 191 500 3000", contactEmail: "finance@fundingnorth.com", postalAddress: "Gateshead NE8 1DT", lendingMinQuantum: 2500, lendingMaxQuantum: 200000, geographicalScope: ["North East", "North West", "Yorkshire"], preferredClientTypes: ["SMEs"], backgroundInfo: "Northern regions lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "11", name: "Enterprise Kent", website: "https://www.enterprisekent.co.uk", contactName: "Business Lending", contactPhone: "+44 1227 783 000", contactEmail: "lending@enterprisekent.co.uk", postalAddress: "Canterbury CT2 7NE", lendingMinQuantum: 1000, lendingMaxQuantum: 100000, geographicalScope: ["South East"], preferredClientTypes: ["SMEs"], backgroundInfo: "South East business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "12", name: "Development Manager LTD", website: "https://www.developmentmanager.co.uk", contactName: "Business Lending", contactPhone: "+44 20 7100 0010", contactEmail: "lending@developmentmanager.co.uk", postalAddress: "London WC2N 5HS", lendingMinQuantum: 10000, lendingMaxQuantum: 500000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Development finance provider", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "13", name: "Business Development Bank", website: "https://www.bdb.co.uk", contactName: "Lending Department", contactPhone: "+44 845 600 0101", contactEmail: "lending@bdb.co.uk", postalAddress: "Dunmow CM6 3HN", lendingMinQuantum: 5000, lendingMaxQuantum: 300000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Business development lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "14", name: "Metro Bank Foundation", website: "https://www.metrobank.plc.uk", contactName: "Commercial Lending", contactPhone: "+44 20 3040 1000", contactEmail: "lending@metrobankfoundation.com", postalAddress: "London EC2R 6DA", lendingMinQuantum: 10000, lendingMaxQuantum: 1000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Community bank lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "15", name: "Unity Trust Bank", website: "https://www.unity.co.uk", contactName: "Commercial Lending", contactPhone: "+44 121 716 2000", contactEmail: "lending@unity.co.uk", postalAddress: "Birmingham B1 2JB", lendingMinQuantum: 5000, lendingMaxQuantum: 500000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs", "Social Enterprises"], backgroundInfo: "Ethical business bank", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "16", name: "Lend With Care", website: "https://www.lendwithcare.org", contactName: "Business Lending", contactPhone: "+44 20 3861 0000", contactEmail: "business@lendwithcare.org", postalAddress: "London SE1 8QH", lendingMinQuantum: 100, lendingMaxQuantum: 50000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Microfinance and business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "17", name: "Accord Mortgages", website: "https://www.accordmortgages.com", contactName: "Commercial Division", contactPhone: "+44 345 266 3322", contactEmail: "commercial@accordmortgages.com", postalAddress: "Wirral CH43 3AU", lendingMinQuantum: 50000, lendingMaxQuantum: 2000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Commercial and business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "18", name: "Santander Business Banking", website: "https://www.business.santander.co.uk", contactName: "Commercial Lending", contactPhone: "+44 345 606 0141", contactEmail: "business@santander.co.uk", postalAddress: "London E14 5EA", lendingMinQuantum: 10000, lendingMaxQuantum: 5000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Major bank business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "19", name: "Barclays Business Bank", website: "https://www.barclays.co.uk/business", contactName: "SME Lending", contactPhone: "+44 345 602 3004", contactEmail: "smallbusiness@barclays.com", postalAddress: "London E14 5HP", lendingMinQuantum: 10000, lendingMaxQuantum: 5000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Major bank business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "20", name: "HSBC Business Banking", website: "https://www.business.hsbc.co.uk", contactName: "Commercial Lending", contactPhone: "+44 345 740 4404", contactEmail: "businesslending@hsbc.co.uk", postalAddress: "London E14 5HQ", lendingMinQuantum: 10000, lendingMaxQuantum: 5000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Major bank business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "21", name: "Lloyds Business Bank", website: "https://www.business.lloydsbankinggroup.com", contactName: "SME Lending", contactPhone: "+44 345 300 0000", contactEmail: "sme@lloydsbankinggroup.com", postalAddress: "London EC2V 7HN", lendingMinQuantum: 10000, lendingMaxQuantum: 5000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Major bank business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "22", name: "Co-operative Bank Business", website: "https://www.co-operativebank.co.uk/business", contactName: "Business Lending", contactPhone: "+44 345 721 2212", contactEmail: "business@co-operativebank.co.uk", postalAddress: "Manchester M4 4AB", lendingMinQuantum: 5000, lendingMaxQuantum: 1000000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Ethical bank business lending", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "23", name: "Invest Northern Ireland", website: "https://www.investni.com", contactName: "Business Lending", contactPhone: "+44 28 9069 8000", contactEmail: "business@investni.com", postalAddress: "Belfast BT2 7ES", lendingMinQuantum: 5000, lendingMaxQuantum: 500000, geographicalScope: ["Northern Ireland"], preferredClientTypes: ["SMEs"], backgroundInfo: "Northern Ireland development agency", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "24", name: "Business Development Board", website: "https://www.bdb-lending.co.uk", contactName: "Commercial Team", contactPhone: "+44 333 456 0123", contactEmail: "commercial@bdb-lending.co.uk", postalAddress: "Manchester M15 6SE", lendingMinQuantum: 10000, lendingMaxQuantum: 750000, geographicalScope: ["UK-wide"], preferredClientTypes: ["SMEs"], backgroundInfo: "Independent business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
  { id: "25", name: "Community Ventures", website: "https://www.communityventures.org.uk", contactName: "Lending Team", contactPhone: "+44 20 7100 5000", contactEmail: "lending@communityventures.org.uk", postalAddress: "London SE1 3UB", lendingMinQuantum: 5000, lendingMaxQuantum: 250000, geographicalScope: ["London", "South East"], preferredClientTypes: ["SMEs"], backgroundInfo: "Community business lender", contactOutcome: "not_contacted", agreementStatus: "unsigned" },
];

export default function Lenders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "unsigned" | "in_progress" | "signed">("all");
  const [filterContactOutcome, setFilterContactOutcome] = useState<"all" | "not_contacted" | "interested" | "no_answer" | "not_interested">("all");
  const [lenders, setLenders] = useState<CDFI[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  usePageTitle("CDFI Database", "Month-1 KPI — 10 signed agreements");

  // Fetch CDFIs on mount and auto-seed if empty
  useEffect(() => {
    const load = async () => {
      try {
        // Initialize database first
        await fetch("/api/cdfis/init", { method: "POST" });

        // Fetch CDFIs
        const res = await fetch("/api/cdfis");
        const data = await res.json();
        setLenders(data);

        // If empty, auto-seed
        if (data.length === 0) {
          const seedRes = await fetch("/api/cdfis/seed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: "system" }),
          });
          if (seedRes.ok) {
            const seededRes = await fetch("/api/cdfis");
            const seededData = await seededRes.json();
            setLenders(seededData);
            toast.success("CDFI database loaded!");

            // Kick off live Firecrawl enrichment in the background (first-time only).
            // Curated data shows immediately; details refresh from each CDFI's website.
            fetch("/api/cdfis/enrich", { method: "POST" }).catch(() => {});
          }
        }
      } catch (error) {
        console.error("Error loading CDFIs:", error);
        toast.error("Failed to load CDFIs");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const contactMutation = useMutation({
    mutationFn: async ({ id, outcome, notes }: { id: string; outcome: string; notes?: string }) => {
      const res = await fetch(`/api/cdfis/${id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, notes }),
      });
      if (!res.ok) throw new Error("Failed to update contact");
      return res.json();
    },
    onSuccess: () => {
      // Refetch to get updated data
      fetch("/api/cdfis").then((r) => r.json()).then(setLenders);
      toast.success("Contact updated");
    },
  });

  const signAgreementMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cdfis/${id}/sign-agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to sign agreement");
      return res.json();
    },
    onSuccess: () => {
      // Refetch to get updated data
      fetch("/api/cdfis").then((r) => r.json()).then(setLenders);
      toast.success("Agreement signed!");
    },
  });

  const filteredLenders = useMemo(() => {
    return lenders.filter((lender) => {
      const matchesSearch =
        lender.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lender.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lender.contactPhone?.includes(searchTerm) ||
        lender.postalAddress?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAgreementStatus =
        filterStatus === "all" || lender.agreementStatus === filterStatus;

      const matchesContactOutcome =
        filterContactOutcome === "all" || lender.contactOutcome === filterContactOutcome;

      return matchesSearch && matchesAgreementStatus && matchesContactOutcome;
    });
  }, [lenders, searchTerm, filterStatus, filterContactOutcome]);

  const stats = {
    total: lenders.length,
    signed: lenders.filter((l) => l.agreementStatus === "signed").length,
    notContacted: lenders.filter((l) => l.contactOutcome === "not_contacted").length,
    interested: lenders.filter((l) => l.contactOutcome === "interested").length,
  };

  return (
    <div className="px-4 md:px-6 py-6 md:py-8 space-y-6 pb-24 md:pb-28">
      <div>
        <span className="kicker">Sales · Lender Panel</span>
        <h2 className="text-xl md:text-2xl font-semibold tracking-tight mt-1">CDFI Database</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Onboard Community Development Finance Institutions — month-1 target is 10 signed agreements.
        </p>
      </div>

      {/* KPI + stats */}
      {lenders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="tile gradient-border reveal p-5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="kicker">Agreements signed</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.5)]" />
                KPI
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-5xl font-semibold tabular-nums text-primary leading-none">{stats.signed}</span>
              <span className="text-xl text-muted-foreground mb-1">/ 10</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, (stats.signed / 10) * 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{Math.round((stats.signed / 10) * 100)}% of target</p>
          </div>

          <div className="lg:col-span-2 grid grid-cols-3 gap-4">
            <StatTile label="Total CDFIs" value={stats.total} delay={80} />
            <StatTile label="Not contacted" value={stats.notContacted} delay={140} />
            <StatTile label="Interested" value={stats.interested} emerald delay={200} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact, phone, or location…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/[0.03] border-white/10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <FilterGroup
            label="Agreement"
            options={["all", "unsigned", "in_progress", "signed"] as const}
            value={filterStatus}
            onChange={setFilterStatus}
            fmt={(s) => (s === "in_progress" ? "In progress" : s)}
          />
          <FilterGroup
            label="Contact"
            options={["all", "not_contacted", "interested", "no_answer", "not_interested"] as const}
            value={filterContactOutcome}
            onChange={setFilterContactOutcome}
            fmt={(s) => s.replace(/_/g, " ")}
          />
        </div>
      </div>

      {/* Database */}
      <div>
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <span className="kicker">Database</span>
            <h3 className="text-lg font-semibold tracking-tight mt-1 tabular-nums">
              {filteredLenders.length}{" "}
              <span className="text-muted-foreground font-normal text-sm">of {lenders.length} CDFIs</span>
            </h3>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button size="sm" className="accent-glow">
              <Plus className="h-4 w-4 mr-2" /> Add CDFI
            </Button>
          </div>
        </div>

        {isLoading && lenders.length === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="tile p-5 h-44 animate-pulse" />
            ))}
          </div>
        ) : filteredLenders.length === 0 ? (
          <div className="glass p-12 text-center text-muted-foreground">No CDFIs match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
            {filteredLenders.map((lender, idx) => {
              const contacted = !!lender.contactOutcome && lender.contactOutcome !== "not_contacted";
              const signed = lender.agreementStatus === "signed";
              const done = (contacted ? 1 : 0) + (signed ? 1 : 0);
              return (
                <div
                  key={lender.id}
                  className="tile reveal p-4 md:p-5 flex flex-col"
                  style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold tracking-tight truncate">{lender.name}</h3>
                        <OutcomeChip outcome={lender.contactOutcome} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {[lender.contactName, lender.postalAddress].filter(Boolean).join(" · ")}
                      </p>
                      {lender.lendingMaxQuantum && (
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                          £{(lender.lendingMinQuantum || 0).toLocaleString()}–£{lender.lendingMaxQuantum.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="kicker">Steps</div>
                      <div className="text-sm font-semibold tabular-nums mt-0.5">
                        <span className="text-primary">{done}</span>
                        <span className="text-muted-foreground">/2</span>
                      </div>
                    </div>
                  </div>

                  {lender.geographicalScope && lender.geographicalScope.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {lender.geographicalScope.map((scope) => (
                        <span key={scope} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-muted-foreground">
                          {scope}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Task checklist */}
                  <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-2.5">
                    <TaskCheck
                      label="Contacted"
                      done={contacted}
                      pending={contactMutation.isPending}
                      onToggle={() => contactMutation.mutate({ id: lender.id, outcome: "interested", notes: "Initial contact" })}
                    />
                    <TaskCheck
                      label="Agreement signed"
                      done={signed}
                      disabled={!contacted}
                      pending={signAgreementMutation.isPending}
                      doneNote={lender.agreementSignedDate ? new Date(lender.agreementSignedDate).toLocaleDateString("en-GB") : undefined}
                      onToggle={() => signAgreementMutation.mutate(lender.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
