import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Building2, Users, CheckCircle } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary rounded-md flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold" data-testid="text-app-title">LoanFlow</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleLogin} data-testid="button-sign-in">
              Sign in
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
            <Button size="lg" onClick={handleLogin} data-testid="button-get-started">
              Get Started
            </Button>
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
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-primary" />
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
            <div className="max-w-2xl mx-auto">
              <h3 className="text-3xl font-bold mb-8 text-center">Pipeline Stages</h3>
              <div className="space-y-3">
                {[
                  "Lead - Initial prospect identification",
                  "Contacted - First outreach completed",
                  "Qualified - Eligibility verified",
                  "Proposal - Loan terms presented",
                  "Due Diligence - In-depth review",
                  "Approval - Final decision stage",
                  "Approved - Loan approved",
                  "Declined - Application rejected",
                  "Withdrawn - Applicant withdrew"
                ].map((stage, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm">{stage}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-20 text-center">
          <h3 className="text-3xl font-bold mb-6">Ready to streamline your lending pipeline?</h3>
          <Button size="lg" onClick={handleLogin} data-testid="button-sign-in-cta">
            Sign in to continue
          </Button>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 LoanFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
