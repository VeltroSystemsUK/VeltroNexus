import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import logoChrome from "@assets/logo-chrome.png";
import { useLocation } from "wouter";
import { CheckCircle, Loader2, MailX } from "lucide-react";

export default function Unsubscribe() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | "not_found" | "error" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/marketing/waitlist/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.status === 404) {
        setResult("not_found");
      } else if (res.ok) {
        setResult("success");
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
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <Card className="bg-white/[0.03] border-white/[0.06] backdrop-blur-sm max-w-md w-full">
          <CardContent className="p-8">
            {result === "success" ? (
              <div className="text-center py-4">
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Unsubscribed</h2>
                <p className="text-gray-400 mb-6">
                  You've been removed from our waiting list. Sorry to see you go.
                </p>
                <Button
                  variant="outline"
                  className="border-white/10 text-gray-300 hover:bg-white/10"
                  onClick={() => setLocation("/")}
                >
                  Back to Home
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <MailX className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-white mb-2">Unsubscribe</h2>
                  <p className="text-gray-400 text-sm">
                    Enter your email to remove yourself from the waiting list.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    type="email"
                    required
                    placeholder="Your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-gray-500 h-12"
                  />
                  <Button
                    type="submit"
                    disabled={submitting || !email.trim()}
                    className="w-full bg-red-600 hover:bg-red-700 text-white h-12"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <MailX className="h-5 w-5 mr-2" />
                    )}
                    {submitting ? "Processing..." : "Unsubscribe"}
                  </Button>
                  {result === "not_found" && (
                    <p className="text-amber-400 text-sm text-center">
                      That email wasn't found on our waiting list.
                    </p>
                  )}
                  {result === "error" && (
                    <p className="text-red-400 text-sm text-center">
                      Something went wrong. Please try again.
                    </p>
                  )}
                </form>
              </>
            )}
          </CardContent>
        </Card>
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
