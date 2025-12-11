import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Calendar, Phone } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const pricingTiers = [
  {
    name: "Broker Starter",
    price: "£39",
    period: "per month",
    prospects: 50,
    additionalCost: "£2",
    trialDays: 14,
    description: "Perfect for independent brokers",
    features: [
      "50 prospects included",
      "Companies House integration",
      "Full due diligence suite",
      "Contact management",
      "Activity tracking & CRM",
      "PDF report generation",
      "Email support",
    ],
    popular: false,
    tier: "broker_starter",
    ctaText: "Start 14-Day Free Trial",
    ctaType: "trial" as const,
    highlight: "No credit card required",
  },
  {
    name: "Team",
    price: "£229",
    period: "per month",
    prospects: 250,
    additionalCost: "£1.50",
    seats: 5,
    description: "For growing sales teams",
    features: [
      "5 team seats included",
      "250 prospects included",
      "Everything in Broker Starter",
      "Role-based access control",
      "Internal underwriting workflow",
      "Team activity dashboard",
      "Priority email & chat support",
      "Onboarding assistance",
    ],
    popular: true,
    tier: "team",
    ctaText: "Book a Demo",
    ctaType: "demo" as const,
    highlight: "14-day team pilot available",
  },
  {
    name: "Lender",
    price: "£999",
    period: "per month",
    prospects: "Unlimited",
    additionalCost: null,
    description: "Enterprise credit teams & lenders",
    features: [
      "Unlimited prospects",
      "Unlimited team seats",
      "Everything in Team",
      "AI Credit Underwriting module",
      "Credit committee reports",
      "Custom scoring models",
      "White-label branding",
      "API access",
      "Dedicated account manager",
      "SLA & compliance support",
    ],
    popular: false,
    tier: "lender",
    ctaText: "Request Access",
    ctaType: "consultation" as const,
    highlight: "Tailored onboarding included",
  },
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [consultationDialogOpen, setConsultationDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");

  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const createBillingRequestMutation = useMutation({
    mutationFn: async (tier: string) => {
      sessionStorage.setItem('subscription_tier', tier);
      const result = await apiRequest('/api/gocardless/create-billing-request', 'POST', { tier });
      return result;
    },
    onSuccess: (data: any) => {
      window.location.href = data.authorisationUrl;
    },
    onError: (error: any) => {
      sessionStorage.removeItem('subscription_tier');
      toast({
        title: "Subscription Error",
        description: error.message || "Failed to initiate subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const pendingTier = sessionStorage.getItem('subscription_tier');
    if (pendingTier && user && pendingTier === 'broker_starter') {
      createBillingRequestMutation.mutate(pendingTier);
    }
  }, [user]);

  const handleSelectPlan = (plan: typeof pricingTiers[0]) => {
    setSelectedPlan(plan.tier);
    
    if (plan.ctaType === "trial") {
      // Broker Starter: 14-day free trial - sign up directly
      if (!user) {
        sessionStorage.setItem('subscription_tier', plan.tier);
        window.location.href = "/api/login";
      } else {
        // Start trial - redirect to pipeline
        toast({
          title: "Welcome to FlowLoan!",
          description: "Your 14-day free trial has started. Explore your pipeline!",
        });
        setLocation("/pipeline");
      }
    } else if (plan.ctaType === "demo") {
      // Team plan: Book a demo
      setDemoDialogOpen(true);
    } else if (plan.ctaType === "consultation") {
      // Lender plan: Request access
      setConsultationDialogOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start managing your commercial lending pipeline with FlowLoan. Select the plan that fits your needs.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingTiers.map((plan) => (
            <Card
              key={plan.tier}
              className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}
              data-testid={`pricing-card-${plan.tier}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="px-4 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="mt-1">{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground ml-2">{plan.period}</span>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {typeof plan.prospects === "number" ? `${plan.prospects} prospects included` : plan.prospects + " prospects"}
                </div>
                {plan.highlight && (
                  <Badge variant="secondary" className="mt-3">
                    {plan.highlight}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {plan.additionalCost && (
                  <div className="text-sm text-muted-foreground text-center border-t border-b py-3">
                    <div>Additional prospects: <span className="font-semibold text-foreground">{plan.additionalCost}</span> each</div>
                    <div className="text-xs text-primary mt-1">Value Packages Available</div>
                  </div>
                )}
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex-col gap-2">
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSelectPlan(plan)}
                  disabled={createBillingRequestMutation.isPending && selectedPlan === plan.tier}
                  data-testid={`button-select-${plan.tier}`}
                >
                  {plan.ctaType === "demo" && <Calendar className="w-4 h-4 mr-2" />}
                  {plan.ctaType === "consultation" && <Phone className="w-4 h-4 mr-2" />}
                  {createBillingRequestMutation.isPending && selectedPlan === plan.tier 
                    ? "Processing..." 
                    : plan.ctaText}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            All plans include access to Companies House integration, contact management, and activity tracking.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Questions? Email us at <a href="mailto:hello@flowloan.co.uk" className="text-primary hover:underline">hello@flowloan.co.uk</a>
          </p>
        </div>
      </div>

      {/* Book a Demo Dialog */}
      <Dialog open={demoDialogOpen} onOpenChange={setDemoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Book a Team Demo
            </DialogTitle>
            <DialogDescription>
              Our team will set up your account, invite your team members, and guide you through a 14-day pilot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">What's included:</h4>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Personalized demo of all Team features</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>We set up your account & invite your team</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>14-day fully-featured team pilot</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Optional: We import your existing leads</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <Button 
                className="w-full" 
                onClick={() => {
                  window.location.href = "mailto:sales@flowloan.co.uk?subject=Team%20Demo%20Request&body=Hi%2C%0A%0AI%27d%20like%20to%20book%20a%20demo%20for%20the%20Team%20plan.%0A%0ACompany%3A%20%0ATeam%20size%3A%20%0APreferred%20time%3A%20%0A%0AThanks!";
                }}
                data-testid="button-email-demo"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Email Us to Book
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Or call us: +44 (0) 20 1234 5678
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Access / Consultation Dialog */}
      <Dialog open={consultationDialogOpen} onOpenChange={setConsultationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Request Lender Access
            </DialogTitle>
            <DialogDescription>
              Our enterprise team will discuss your requirements and provide a tailored solution for your credit team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Enterprise consultation includes:</h4>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Discovery call to understand your workflow</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Custom AI underwriting model discussion</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>White-label branding options</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Compliance & security review</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Tailored onboarding & training plan</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <Button 
                className="w-full" 
                onClick={() => {
                  window.location.href = "mailto:enterprise@flowloan.co.uk?subject=Lender%20Plan%20Enquiry&body=Hi%2C%0A%0AI%27d%20like%20to%20discuss%20the%20Lender%20plan%20for%20our%20credit%20team.%0A%0AOrganisation%3A%20%0ATeam%20size%3A%20%0ACurrent%20lending%20volume%3A%20%0A%0AThanks!";
                }}
                data-testid="button-email-consultation"
              >
                <Phone className="w-4 h-4 mr-2" />
                Request a Consultation
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                We'll respond within 24 hours
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
