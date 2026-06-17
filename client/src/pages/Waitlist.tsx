import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import logoChrome from "@assets/logo-chrome.png";
import { useLocation } from "wouter";
import {
  CheckCircle,
  Loader2,
  Mail,
  ArrowRight,
  Zap,
  Search,
  TrendingUp,
} from "lucide-react";

export default function Waitlist() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [trialInterest, setTrialInterest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | "exists" | "error" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/marketing/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          companyName: companyName.trim() || undefined,
          trialInterest,
          source: "waitlist-page",
        }),
      });
      if (res.status === 409) {
        setResult("exists");
      } else if (res.ok) {
        setResult("success");
        setEmail("");
        setFirstName("");
        setCompanyName("");
        setTrialInterest(false);
      } else {
        setResult("error");
      }
    } catch {
      setResult("error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      {/* Header */}
      <header className="py-6 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <img
            src={logoChrome}
            alt="Veltro"
            className="h-8 md:h-10 object-contain cursor-pointer"
            onClick={() => setLocation("/")}
          />
          <Button
            variant="ghost"
            className="text-gray-400 hover:text-white hover:bg-white/10"
            onClick={() => setLocation("/auth")}
          >
            Login
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Copy */}
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Get Early Access to{" "}
              <span className="text-[#10b981]">Smarter Tools</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8">
              Join the waiting list and be the first to access automation tools
              that save your business time and money.
            </p>
            <div className="space-y-4">
              {[
                { icon: Search, text: "Find qualified leads automatically" },
                { icon: Zap, text: "Automate repetitive admin tasks" },
                { icon: TrendingUp, text: "Close more deals, faster" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4 text-[#10b981]" />
                  </div>
                  <span className="text-gray-300">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Form */}
          <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm">
            <CardContent className="p-8">
              {result === "success" ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">You're on the list!</h2>
                  <p className="text-gray-400 mb-6">
                    We'll be in touch soon with updates and exclusive offers.
                  </p>
                  <Button
                    variant="outline"
                    className="border-white/10 text-gray-300 hover:bg-white/10"
                    onClick={() => setLocation("/")}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Back to Home
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-2">Join the Waiting List</h2>
                  <p className="text-gray-400 text-sm mb-6">
                    No commitment. We'll let you know when your spot is ready.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      type="email"
                      required
                      placeholder="Your email address *"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-gray-500 h-12"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="First name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-gray-500 h-12"
                      />
                      <Input
                        placeholder="Company name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-gray-500 h-12"
                      />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        checked={trialInterest}
                        onCheckedChange={(checked) => setTrialInterest(checked === true)}
                        className="border-white/20 data-[state=checked]:bg-[#10b981] data-[state=checked]:border-[#10b981]"
                      />
                      <span className="text-sm text-gray-300">
                        I'm interested in the{" "}
                        <span className="text-[#10b981] font-medium">£49/month trial</span> for
                        lead generation tools
                      </span>
                    </label>
                    <Button
                      type="submit"
                      disabled={submitting || !email.trim()}
                      className="w-full bg-[#10b981] hover:bg-[#047857] text-white h-12 text-lg"
                    >
                      {submitting ? (
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      ) : (
                        <Mail className="h-5 w-5 mr-2" />
                      )}
                      {submitting ? "Joining..." : "Join the Waiting List"}
                    </Button>
                    {result === "exists" && (
                      <p className="text-amber-400 text-sm text-center">
                        You're already on the waiting list — we'll be in touch!
                      </p>
                    )}
                    {result === "error" && (
                      <p className="text-red-400 text-sm text-center">
                        Something went wrong. Please try again.
                      </p>
                    )}
                    <p className="text-gray-600 text-xs text-center">
                      No spam, ever. Unsubscribe anytime.
                    </p>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 text-center">
        <p className="text-gray-600 text-sm">
          &copy; {new Date().getFullYear()} Veltro - Forward Development Engineering
        </p>
      </footer>
    </div>
  );
}
