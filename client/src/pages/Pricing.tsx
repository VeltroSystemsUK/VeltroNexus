import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const pricingTiers = [
  {
    name: "Free",
    price: "£0",
    period: "forever",
    prospects: 10,
    additionalCost: "£3",
    features: [
      "10 prospects included",
      "Companies House integration",
      "Basic due diligence tools",
      "Contact management",
      "Activity tracking",
    ],
    popular: false,
    tier: "free",
  },
  {
    name: "Standard",
    price: "£29",
    period: "per month",
    prospects: 100,
    additionalCost: "£2",
    features: [
      "100 prospects included",
      "Companies House integration",
      "Full due diligence suite",
      "Advanced contact management",
      "Activity tracking & reminders",
      "Priority support",
    ],
    popular: true,
    tier: "standard",
  },
  {
    name: "Premium",
    price: "£49",
    period: "per month",
    prospects: 500,
    additionalCost: "£1",
    features: [
      "500 prospects included",
      "Companies House integration",
      "Full due diligence suite",
      "Advanced contact management",
      "Activity tracking & reminders",
      "Priority support",
      "Custom integrations",
      "Dedicated account manager",
    ],
    popular: false,
    tier: "premium",
  },
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
    if (pendingTier && user && pendingTier !== 'free') {
      createBillingRequestMutation.mutate(pendingTier);
    }
  }, [user]);

  const handleSelectPlan = (tier: string) => {
    if (!user) {
      if (tier !== "free") {
        sessionStorage.setItem('subscription_tier', tier);
      }
      window.location.href = "/api/login";
      return;
    }

    if (tier === "free") {
      setLocation("/pipeline");
    } else {
      createBillingRequestMutation.mutate(tier);
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
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground ml-2">{plan.period}</span>
                </div>
                <CardDescription className="mt-2">
                  {plan.prospects} prospects included
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground text-center border-t border-b py-3">
                  Additional prospects: <span className="font-semibold text-foreground">{plan.additionalCost}</span> each
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSelectPlan(plan.tier)}
                  disabled={createBillingRequestMutation.isPending}
                  data-testid={`button-select-${plan.tier}`}
                >
                  {createBillingRequestMutation.isPending ? "Processing..." : 
                   plan.tier === "free" ? (user ? "Current Plan" : "Get Started Free") : 
                   user ? "Subscribe" : "Sign Up & Subscribe"}
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
            Need more? Contact us for enterprise pricing and custom solutions.
          </p>
        </div>
      </div>
    </div>
  );
}
