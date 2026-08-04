import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, PoundSterling, Briefcase, MapPin, Coins, TrendingUp, Building2, ShieldCheck, Sparkles, RotateCcw, RefreshCcw, Star, ArrowRight, Search } from "lucide-react";
import { type Lender, PRODUCT_TYPES, SECTORS, REGIONS } from "@shared/schema";
import { useLocation } from "wouter";

// Utility for formatting currency locally in the tab
const formatCurrency = (value?: number | null) => {
  if (value == null) return "TBA";
  if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `£${(value / 1000).toFixed(0)}k`;
  return `£${value}`;
};

// Simplified Tier Badge
const TierBadge = ({ type, tier }: { type?: string | null, tier?: number | null }) => {
  let label = "Tier 3.0";
  if (tier !== null && tier !== undefined) {
    label = `Tier ${tier.toFixed(1)}`;
  } else if (type) {
    label = type.replace('tier', 'Tier ');
  }
  return (
    <Badge variant="outline" className="text-[10px] uppercase font-black tracking-wider bg-background/50 backdrop-blur-sm">
      {label}
    </Badge>
  );
};

export function LenderFinderTab({ lenders }: { lenders: Lender[] }) {
  const [, setLocation] = useLocation();
  const [isMatching, setIsMatching] = useState(false);
  const [matchedLenders, setMatchedLenders] = useState<Lender[]>([]);
  const [matchRequirements, setMatchRequirements] = useState<{
    productType?: string;
    amount?: number;
    sector?: string;
    region?: string;
    turnover?: number;
    profit?: number;
    netWorth?: number;
    creditStatus?: string;
  }>({});

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-0">
      <div className="lg:col-span-4 space-y-6">
        <Card className="border-border/50 shadow-md overflow-hidden bg-card/50 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-br from-primary/5 via-background to-background border-b border-border/50 py-5 px-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-black tracking-widest uppercase text-primary">Requirement Panel</span>
            </div>
            <CardTitle className="text-xl font-black tracking-tight">Deal Specification</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {[
                { id: "productType", label: "Product Category", value: matchRequirements.productType || "", onChange: (v: string) => setMatchRequirements(prev => ({ ...prev, productType: v })), icon: Layers, type: "select", options: PRODUCT_TYPES, placeholder: "Select..." },
                { id: "amount", label: "Loan Amount", value: matchRequirements.amount, onChange: (v: any) => setMatchRequirements(prev => ({ ...prev, amount: parseInt(v) || undefined })), icon: PoundSterling, type: "number", placeholder: "e.g. 500k" },
                { id: "sector", label: "Sector Focus", value: matchRequirements.sector || "", onChange: (v: string) => setMatchRequirements(prev => ({ ...prev, sector: v })), icon: Briefcase, type: "select", options: SECTORS, placeholder: "Select..." },
                { id: "region", label: "Region", value: matchRequirements.region || "", onChange: (v: string) => setMatchRequirements(prev => ({ ...prev, region: v })), icon: MapPin, type: "select", options: REGIONS, placeholder: "Select..." },
                { id: "turnover", label: "Last Year Turnover", value: matchRequirements.turnover, onChange: (v: any) => setMatchRequirements(prev => ({ ...prev, turnover: parseInt(v) || undefined })), icon: Coins, type: "number", placeholder: "e.g. 2M", bg: "bg-primary/[0.01]" },
                { id: "profit", label: "Profit / Loss", value: matchRequirements.profit, onChange: (v: any) => setMatchRequirements(prev => ({ ...prev, profit: parseInt(v) || undefined })), icon: TrendingUp, type: "number", placeholder: "e.g. 250k", bg: "bg-primary/[0.01]" },
                { id: "netWorth", label: "Net Worth", value: matchRequirements.netWorth, onChange: (v: any) => setMatchRequirements(prev => ({ ...prev, netWorth: parseInt(v) || undefined })), icon: Building2, type: "number", placeholder: "e.g. 1.5M", bg: "bg-primary/[0.01]" },
                { id: "creditStatus", label: "Credit Status", value: matchRequirements.creditStatus || "", onChange: (v: string) => setMatchRequirements(prev => ({ ...prev, creditStatus: v })), icon: ShieldCheck, type: "select", options: ["Very Good", "Good", "Average", "Poor", "Very Poor"], placeholder: "Select...", bg: "bg-primary/[0.02]" },
              ].map((field, idx) => (
                <div key={idx} className={`p-3.5 sm:p-4 grid grid-cols-5 items-center gap-3 ${field.bg || ''}`}>
                  <label htmlFor={field.id} className="col-span-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2 px-1 truncate cursor-pointer">
                    <field.icon className="h-3.5 w-3.5 shrink-0" /> {field.label}
                  </label>
                  <div className="col-span-3">
                    {field.type === "select" ? (
                      <Select value={field.value as string} onValueChange={field.onChange}>
                        <SelectTrigger id={field.id} className="h-9 bg-muted/20 border-border/40 font-semibold text-xs rounded-xl focus:ring-primary/20">
                          <SelectValue placeholder={field.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map((opt: any) => {
                             const val = typeof opt === 'object' ? String(opt.value) : String(opt);
                             const label = typeof opt === 'object' ? (opt.label ?? opt.value) : opt;
                             return (
                               <SelectItem key={val} value={val} className="text-xs font-medium">{String(label)}</SelectItem>
                             );
                           })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">£</span>
                        <Input
                          id={field.id}
                          type="number"
                          placeholder={field.placeholder}
                          className="h-9 pl-6 bg-muted/20 border-border/40 font-bold text-xs rounded-xl focus:ring-primary/20"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 bg-muted/5 border-t border-border/40 mt-1">
              <Button
                className="w-full h-11 bg-primary hover:bg-primary/95 text-primary-foreground font-black rounded-xl shadow-lg shadow-primary/10 transition-all hover:scale-[1.02] active:scale-95 group"
                onClick={() => {
                  setIsMatching(true);
                  setTimeout(() => {
                    const isSubPrime = ["Average", "Poor", "Very Poor"].includes(matchRequirements.creditStatus || "");
                    const isPrime = ["Very Good", "Good"].includes(matchRequirements.creditStatus || "");
                    const hasBlemish = (matchRequirements.profit !== undefined && matchRequirements.profit <= 0) || (matchRequirements.netWorth !== undefined && matchRequirements.netWorth < 0);

                    const results = lenders.filter(l => {
                      const pts = (l.productTypes as string[]) || [];
                      const matchesProduct = !matchRequirements.productType || pts.some(p => p.toLowerCase() === matchRequirements.productType?.toLowerCase());
                      const matchesAmount = !matchRequirements.amount || (
                        (!l.minLoanAmount || matchRequirements.amount >= l.minLoanAmount) &&
                        (!l.maxLoanAmount || matchRequirements.amount <= l.maxLoanAmount)
                      );

                      if (!(matchesProduct && matchesAmount)) return false;

                      if (isSubPrime && (l.tier === 1.0 || l.lenderType === "tier1.0" || l.lenderType === "tier1.5")) return false;
                      if (isPrime && !hasBlemish && (l.tier === 3.0 || l.lenderType === "tier3.0")) return false;

                      return true;
                    }).sort((a, b) => {
                      let scoreA = 0; let scoreB = 0;
                      if (a.isFavourite) scoreA += 2;
                      if (b.isFavourite) scoreB += 2;
                      if (a.panelStatus === "preferred") scoreA += 3;
                      if (b.panelStatus === "preferred") scoreB += 3;
                      if (a.panelStatus === "panel") scoreA += 1;
                      if (b.panelStatus === "panel") scoreB += 1;

                      const tierA = a.tier ?? (parseFloat(a.lenderType?.replace("tier", "") || "3.0"));
                      const tierB = b.tier ?? (parseFloat(b.lenderType?.replace("tier", "") || "3.0"));

                      scoreA += (4 - tierA) * 5;
                      scoreB += (4 - tierB) * 5;

                      if (matchRequirements.sector && (a.sectors as string[])?.includes(matchRequirements.sector)) scoreA += 2;
                      if (matchRequirements.sector && (b.sectors as string[])?.includes(matchRequirements.sector)) scoreB += 2;
                      return scoreB - scoreA;
                    }).slice(0, 5);
                    setMatchedLenders(results);
                    setIsMatching(false);
                  }, 700);
                }}
                disabled={isMatching}
              >
                {isMatching ? <RotateCcw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2 group-hover:rotate-12 transition-all" />}
                {isMatching ? "Analysing Market..." : "Find Best Matches"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-8 space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-black tracking-tight flex items-center gap-2.5 uppercase">
            Ranked Results
            {matchedLenders.length > 0 && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black px-2 shadow-none uppercase">Top 5 Matches</Badge>
            )}
          </h3>
          {matchedLenders.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setMatchedLenders([])} className="text-[10px] font-black h-8 uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
              <RefreshCcw className="h-3 w-3 mr-2" /> Reset Search
            </Button>
          )}
        </div>

        {matchedLenders.length > 0 ? (
          <div className="space-y-3">
            {matchedLenders.map((lender, index) => (
              <Card
                key={lender.id}
                className={`group cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-primary/40 border-border/40 overflow-hidden rounded-2xl ${index === 0 ? 'ring-1 ring-primary/40 bg-primary/[0.02]' : 'bg-card'}`}
                onClick={() => setLocation(`/lenders/${lender.id}`)}
              >
                <div className="flex flex-col md:flex-row items-stretch min-h-[90px]">
                  <div className={`w-12 md:w-16 flex items-center justify-center border-b md:border-b-0 md:border-r border-border/40 ${index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground/60'}`}>
                    <span className="text-2xl font-black">{index + 1}</span>
                  </div>
                  <div className="flex-1 p-4 flex flex-col md:flex-row items-center gap-4">
                    <div className="h-14 w-14 bg-white border border-border/40 rounded-xl p-2 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      {lender.logoUrl ? (
                        <img src={lender.logoUrl} className="max-h-full max-w-full object-contain" alt="" />
                      ) : (
                        <Building2 className="h-7 w-7 text-muted-foreground/20" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-center md:text-left">
                      <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2.5 mb-1">
                        <h4 className="font-black text-base truncate group-hover:text-primary transition-colors">{lender.institutionName}</h4>
                        <TierBadge type={lender.lenderType} tier={lender.tier} />
                        {lender.isFavourite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                      </div>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                        <div className="flex items-center gap-1.5">
                          <PoundSterling className="h-3 w-3 text-primary opacity-50" />
                          <span className="text-sm font-black text-primary/90">{formatCurrency(lender.minLoanAmount)} - {formatCurrency(lender.maxLoanAmount)}</span>
                        </div>
                        <span className="text-border h-3 w-[1px] bg-border/60 hidden md:block" />
                        <div className="flex flex-wrap gap-1.5">
                          {(lender.productTypes as string[])?.slice(0, 2).map(p => (
                            <Badge key={p} variant="secondary" className="text-[9px] font-bold h-4.5 px-2 bg-muted/60 text-muted-foreground border-none">
                              {p}
                            </Badge>
                          ))}
                          {(lender.productTypes as string[])?.length > 2 && (
                            <span className="text-[10px] font-bold text-muted-foreground/50">+{(lender.productTypes as string[]).length - 2}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-5 pr-2">
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5 opacity-60">Typical Rate</p>
                        <p className="text-xl font-black leading-none text-foreground">{lender.typicalRateFrom || "?"}%</p>
                      </div>
                      <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-muted/50 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-sm border border-border/20">
                        <ArrowRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            <p className="text-center text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest pt-2">Showing top 5 matches only</p>
          </div>
        ) : (
          <div className="border border-dashed border-border/60 rounded-3xl p-16 flex flex-col items-center justify-center text-center bg-muted/5 backdrop-blur-[2px]">
            <div className="p-5 bg-muted/20 border border-border/40 rounded-full mb-5 shadow-inner">
              <Search className="h-10 w-10 text-muted-foreground/20" />
            </div>
            <h4 className="text-xl font-black text-foreground/80 tracking-tight uppercase">Search Best Fit</h4>
            <p className="text-sm font-medium text-muted-foreground/60 max-w-[320px] mt-2 leading-relaxed">
              Enter deal requirements on the left to reveal the top 5 matched lenders.
            </p>
            <div className="flex gap-2 mt-8">
              <Badge variant="outline" className="opacity-30">Whole of Market</Badge>
              <Badge variant="outline" className="opacity-30">Suitability Matrix</Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
