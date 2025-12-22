import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Calendar, Phone, Package, Plus, Minus, ShoppingCart, Sparkles } from "lucide-react";
import { useLocation, Link } from "wouter";
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
    name: "Starter",
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
    tier: "starter",
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

const valuePackages = {
  starter: [
    {
      id: "starter-10",
      name: "10 Extra Prospects",
      prospects: 10,
      price: 10,
      pricePerProspect: "£1.00",
      savings: "50%",
    },
    {
      id: "starter-30",
      name: "30 Extra Prospects",
      prospects: 30,
      price: 25,
      pricePerProspect: "£0.83",
      savings: "58%",
      popular: true,
    },
    {
      id: "starter-100",
      name: "100 Extra Prospects",
      prospects: 100,
      price: 49,
      pricePerProspect: "£0.49",
      savings: "76%",
    },
  ],
  team: [
    {
      id: "team-100",
      name: "100 Extra Prospects",
      prospects: 100,
      price: 50,
      pricePerProspect: "£0.50",
      savings: "67%",
    },
    {
      id: "team-250",
      name: "250 Extra Prospects",
      prospects: 250,
      price: 75,
      pricePerProspect: "£0.30",
      savings: "80%",
      popular: true,
    },
    {
      id: "team-500",
      name: "500 Extra Prospects",
      prospects: 500,
      price: 99,
      pricePerProspect: "£0.20",
      savings: "87%",
    },
  ],
};

export default function Pricing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [consultationDialogOpen, setConsultationDialogOpen] = useState(false);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Fetch Stripe products
  const { data: billingProducts } = useQuery<{
    products: Array<{
      id: string;
      name: string;
      metadata: Record<string, string>;
      prices: Array<{
        id: string;
        unit_amount: number;
        currency: string;
        recurring: { interval: string } | null;
      }>;
    }>;
  }>({
    queryKey: ["/api/billing/products"],
    enabled: !!user,
  });

  const createCheckoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await apiRequest("/api/billing/checkout", "POST", { priceId });
      return response as unknown as { url: string };
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Helper to find Stripe price for a tier
  const getStripePriceForTier = (tierName: string, interval: "month" | "year" = "month") => {
    if (!billingProducts?.products || billingProducts.products.length === 0) {
      console.log("No billing products available");
      return null;
    }
    
    const tierLower = tierName.toLowerCase();
    const product = billingProducts.products.find((p) => {
      // Check metadata.tier first
      const metadataTier = p.metadata?.tier?.toLowerCase();
      if (metadataTier === tierLower) return true;
      
      // Fall back to product name matching
      const nameLower = p.name.toLowerCase();
      return nameLower.includes(tierLower) || nameLower.startsWith(tierLower);
    });
    
    if (!product) {
      console.log(`No product found for tier: ${tierName}`, billingProducts.products);
      return null;
    }
    
    // Find matching price by interval
    const price = product.prices.find((p) => p.recurring?.interval === interval);
    if (!price) {
      console.log(`No ${interval} price found for product:`, product);
    }
    return price;
  };

  const createBillingRequestMutation = useMutation({
    mutationFn: async (tier: string) => {
      const price = getStripePriceForTier(tier);
      if (price) {
        return createCheckoutMutation.mutateAsync(price.id);
      }
      throw new Error("Please set up subscription products in Stripe dashboard first.");
    },
    onError: (error: any) => {
      sessionStorage.removeItem("subscription_tier");
      toast({
        title: "Subscription Unavailable",
        description:
          error.message || "Payment processing is temporarily unavailable. Please contact support.",
        variant: "destructive",
      });
    },
  });

  // Handle pending checkout after login - wait for products to load
  useEffect(() => {
    const pendingTier = sessionStorage.getItem("subscription_tier");
    if (pendingTier && user && billingProducts?.products && billingProducts.products.length > 0) {
      sessionStorage.removeItem("subscription_tier");
      sessionStorage.removeItem("value_package");
      createBillingRequestMutation.mutate(pendingTier);
    }
  }, [user, billingProducts]);

  const handleSelectPlan = (plan: (typeof pricingTiers)[0]) => {
    setSelectedPlan(plan.tier);

    if (plan.ctaType === "trial") {
      // Broker Starter: Show checkout dialog with optional value packages
      setSelectedPackage(null);
      setCheckoutDialogOpen(true);
    } else if (plan.ctaType === "demo") {
      // Team plan: Book a demo
      setDemoDialogOpen(true);
    } else if (plan.ctaType === "consultation") {
      // Lender plan: Request access
      setConsultationDialogOpen(true);
    }
  };

  const handleProceedToCheckout = () => {
    if (!user) {
      // Store pending tier and redirect to login
      sessionStorage.setItem("subscription_tier", selectedPlan);
      if (selectedPackage) {
        sessionStorage.setItem("value_package", selectedPackage);
      }
      window.location.href = "/api/login";
    } else {
      // User is logged in - initiate Stripe checkout
      setCheckoutDialogOpen(false);
      createBillingRequestMutation.mutate(selectedPlan);
    }
  };

  const getSelectedPackageDetails = () => {
    if (!selectedPackage || !selectedPlan) return null;
    const packages = valuePackages[selectedPlan as keyof typeof valuePackages];
    return packages?.find((p) => p.id === selectedPackage);
  };

  const currentPlanDetails = pricingTiers.find((p) => p.tier === selectedPlan);
  const availablePackages = selectedPlan
    ? valuePackages[selectedPlan as keyof typeof valuePackages]
    : [];
  const selectedPackageDetails = getSelectedPackageDetails();

  const calculateTotal = () => {
    const basePrice = currentPlanDetails ? parseInt(currentPlanDetails.price.replace("£", "")) : 0;
    const packagePrice = selectedPackageDetails?.price || 0;
    return basePrice + packagePrice;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start managing your commercial lending pipeline with FlowLoan. Select the plan that fits
            your needs.
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
                  {typeof plan.prospects === "number"
                    ? `${plan.prospects} prospects included`
                    : plan.prospects + " prospects"}
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
                    <div>
                      Additional prospects:{" "}
                      <span className="font-semibold text-foreground">{plan.additionalCost}</span>{" "}
                      each
                    </div>
                    <Link href={`/value-packages?plan=${plan.tier}`}>
                      <span className="text-xs text-primary hover:underline cursor-pointer mt-1 inline-block">
                        Value Packages Available
                      </span>
                    </Link>
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
            All plans include access to Companies House integration, contact management, and
            activity tracking.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Questions? Email us at{" "}
            <a href="mailto:hello@flowloan.co.uk" className="text-primary hover:underline">
              hello@flowloan.co.uk
            </a>
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
              Our team will set up your account, invite your team members, and guide you through a
              14-day pilot.
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
                  window.location.href =
                    "mailto:sales@flowloan.co.uk?subject=Team%20Demo%20Request&body=Hi%2C%0A%0AI%27d%20like%20to%20book%20a%20demo%20for%20the%20Team%20plan.%0A%0ACompany%3A%20%0ATeam%20size%3A%20%0APreferred%20time%3A%20%0A%0AThanks!";
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
              Our enterprise team will discuss your requirements and provide a tailored solution for
              your credit team.
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
                  window.location.href =
                    "mailto:enterprise@flowloan.co.uk?subject=Lender%20Plan%20Enquiry&body=Hi%2C%0A%0AI%27d%20like%20to%20discuss%20the%20Lender%20plan%20for%20our%20credit%20team.%0A%0AOrganisation%3A%20%0ATeam%20size%3A%20%0ACurrent%20lending%20volume%3A%20%0A%0AThanks!";
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

      {/* Checkout Dialog with Value Packages */}
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Complete Your Order
            </DialogTitle>
            <DialogDescription>
              Start your 14-day free trial. Add a value package to save on additional prospects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Selected Plan */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">{currentPlanDetails?.name} Plan</h4>
                  <p className="text-sm text-muted-foreground">
                    {currentPlanDetails?.prospects} prospects included
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">{currentPlanDetails?.price}</div>
                  <div className="text-xs text-muted-foreground">per month</div>
                </div>
              </div>
              <Badge variant="secondary" className="mt-2">
                14-day free trial
              </Badge>
            </div>

            {/* Value Packages */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-primary" />
                <h4 className="font-medium">Add a Value Package</h4>
                <Badge variant="outline" className="text-xs">
                  Optional
                </Badge>
              </div>
              <div className="space-y-2">
                {availablePackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`relative border rounded-lg p-3 cursor-pointer transition-colors hover-elevate ${
                      selectedPackage === pkg.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => setSelectedPackage(selectedPackage === pkg.id ? null : pkg.id)}
                    data-testid={`checkout-package-${pkg.id}`}
                  >
                    {pkg.popular && (
                      <Badge
                        variant="default"
                        className="absolute -top-2 right-2 text-xs px-2 py-0"
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        Best Value
                      </Badge>
                    )}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            selectedPackage === pkg.id
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {selectedPackage === pkg.id && (
                            <Check className="w-3 h-3 text-primary-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{pkg.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {pkg.pricePerProspect}/prospect
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">£{pkg.price}</div>
                        <Badge
                          variant="secondary"
                          className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        >
                          Save {pkg.savings}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Value packages are billed monthly and can be cancelled anytime.
              </p>
            </div>

            {/* Order Summary */}
            <div className="border-t pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{currentPlanDetails?.name} Plan</span>
                  <span>{currentPlanDetails?.price}/mo</span>
                </div>
                {selectedPackageDetails && (
                  <div className="flex justify-between text-sm">
                    <span>{selectedPackageDetails.name}</span>
                    <span>£{selectedPackageDetails.price}/mo</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total after trial</span>
                  <span>£{calculateTotal()}/mo</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleProceedToCheckout}
              data-testid="button-proceed-checkout"
            >
              {user ? "Start Free Trial" : "Sign Up to Start Trial"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              No payment required during trial. Cancel anytime.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
