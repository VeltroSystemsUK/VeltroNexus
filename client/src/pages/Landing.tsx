import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, FileCheck, Shield, BarChart3, Star } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Link } from "wouter";
import logoUrl from "@assets/Gemini_Generated_Image_w096n4w096n4w096_1762508125080.png";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="FlowLoan" className="h-12" data-testid="img-logo" />
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pricing">
              <Button variant="ghost" data-testid="button-pricing">
                Pricing
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleLogin} data-testid="button-sign-in">
              Sign In
            </Button>
            <Button onClick={handleLogin} data-testid="button-sign-up">
              Sign Up Free
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-5xl font-bold mb-6" data-testid="text-hero-title">
              Commercial Lending Workflow Management Platform
            </h2>
            <p className="text-xl text-muted-foreground mb-8" data-testid="text-hero-description">
              Streamline your commercial lending pipeline with visual workflow management, company tracking, and real-time deal progression.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" onClick={handleLogin} data-testid="button-get-started">
                Sign Up Free
              </Button>
              <Button size="lg" variant="outline" onClick={handleLogin} data-testid="button-sign-in-hero">
                Sign In
              </Button>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-2">Company Management</h3>
                <p className="text-muted-foreground">
                  Track company details, loan amounts, and priority levels in one centralized location.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-2">Visual Pipeline</h3>
                <p className="text-muted-foreground">
                  Drag-and-drop interface to move prospects through 9 pipeline stages from lead to approval.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-2">Team Collaboration</h3>
                <p className="text-muted-foreground">
                  Secure authentication and user-specific data isolation for your lending team.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="bg-muted py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <h3 className="text-3xl font-bold mb-4">Everything you need to manage commercial loans</h3>
              <p className="text-lg text-muted-foreground">
                FlowLoan helps lending teams track prospects from initial contact through final approval with powerful tools designed specifically for commercial lending workflows.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="text-center">
                <div className="bg-background rounded-lg p-6 h-full">
                  <FileCheck className="h-10 w-10 mx-auto mb-4 text-primary" />
                  <h4 className="font-semibold mb-2">Due Diligence Tools</h4>
                  <p className="text-sm text-muted-foreground">
                    Built-in calculators for DSCR, affordability, and financial ratios. Complete checklists to ensure nothing gets missed.
                  </p>
                </div>
              </div>

              <div className="text-center">
                <div className="bg-background rounded-lg p-6 h-full">
                  <Building2 className="h-10 w-10 mx-auto mb-4 text-primary" />
                  <h4 className="font-semibold mb-2">Companies House Integration</h4>
                  <p className="text-sm text-muted-foreground">
                    Instantly pull company information, directors, financials, and charges directly from Companies House.
                  </p>
                </div>
              </div>

              <div className="text-center">
                <div className="bg-background rounded-lg p-6 h-full">
                  <BarChart3 className="h-10 w-10 mx-auto mb-4 text-primary" />
                  <h4 className="font-semibold mb-2">Track Progress Visually</h4>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop prospects through your workflow stages. See exactly where each deal stands at a glance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold mb-8 text-center">Built for lending professionals</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Shield className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Secure & Private</h4>
                    <p className="text-sm text-muted-foreground">
                      Each user's data is completely isolated. Your prospects and company information remain private to your account.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Users className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Contact Management</h4>
                    <p className="text-sm text-muted-foreground">
                      Store key contacts for each prospect. Track directors, guarantors, accountants, and solicitors all in one place.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <Star className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Priority Management</h4>
                    <p className="text-sm text-muted-foreground">
                      Mark prospects as high, medium, or low priority. Focus your team's attention where it matters most.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <FileCheck className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold mb-1">Activity Tracking</h4>
                    <p className="text-sm text-muted-foreground">
                      Log calls, meetings, and notes against each prospect. Maintain a complete audit trail of your lending process.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 text-center">
          <h3 className="text-3xl font-bold mb-6">Ready to streamline your lending pipeline?</h3>
          <p className="text-muted-foreground mb-6">Start with 10 free prospects. No credit card required.</p>
          <Button size="lg" onClick={handleLogin} data-testid="button-sign-up-cta">
            Sign Up Free
          </Button>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 FlowLoan. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
