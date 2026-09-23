import { useState } from "react";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logoChrome from "@assets/logo-chrome.png";
import {
  Building2,
  CheckCircle,
  LayoutDashboard,
  Loader2,
  Mail,
  Target,
} from "lucide-react";

const pillars = [
  {
    icon: Mail,
    title: "Email verification",
    body: "Check whether an address is real before you spend a send. Fewer bounces, cleaner lists.",
  },
  {
    icon: Target,
    title: "Lead generation",
    body: "Find companies worth talking to and keep the list moving, without a second spreadsheet.",
  },
  {
    icon: LayoutDashboard,
    title: "CRM pipeline",
    body: "See who you contacted, who opened, and what happens next in one board.",
  },
  {
    icon: Building2,
    title: "Business building",
    body: "Tools for operators who want a tighter sales desk, not another dashboard they ignore.",
  },
];

function briefingToken(search: string): string {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("b") || "";
}

export default function Veltro() {
  const search = useSearch();
  const token = briefingToken(search);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleConcierge = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/veltro/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setDone(true);
    } catch {
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col text-white">
      <header className="py-6 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <img src={logoChrome} alt="Veltro" className="h-8 md:h-10 object-contain" />
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#D97706] text-sm font-semibold tracking-wide uppercase mb-4">
            Veltro
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6 max-w-3xl">
            Sales tools for people who actually have to follow up
          </h1>
          <p className="text-gray-400 text-lg mb-4 max-w-2xl">
            Four honest pillars: email verification, lead generation, a CRM pipeline,
            and business building. No trial login yet. No live billing. Talk to Shaun
            if you want in.
          </p>
          <p className="text-gray-500 text-sm mb-12 max-w-2xl">
            This is not a loan. Strata packaging is a separate conversation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
            {pillars.map((pillar) => (
              <Card key={pillar.title} className="bg-white/[0.03] border-white/[0.06]">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-[#D97706]/10 flex items-center justify-center mb-4">
                    <pillar.icon className="h-5 w-5 text-[#D97706]" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">{pillar.title}</h2>
                  <p className="text-gray-400 text-sm leading-relaxed">{pillar.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-white/[0.03] border-white/[0.06] max-w-xl">
            <CardContent className="p-8">
              {done ? (
                <div className="text-center py-4">
                  <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <p className="text-xl font-semibold">We'll be in touch.</p>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-2">Talk to Shaun</h2>
                  <p className="text-gray-400 text-sm mb-6">
                    Concierge only. We'll flag your interest and come back to you —
                    nothing is billed from this page.
                  </p>
                  <Button
                    type="button"
                    data-testid="btn-veltro-concierge"
                    disabled={submitting}
                    onClick={handleConcierge}
                    className="w-full bg-[#D97706] hover:bg-[#B45309] text-white h-12"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : null}
                    {submitting ? "Sending..." : "Talk to Shaun"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
