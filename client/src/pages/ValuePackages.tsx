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
import { Check, ArrowLeft, Package, Sparkles } from "lucide-react";
import { Link, useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const starterPackages = [
  {
    name: "Starter Pack 10",
    prospects: 10,
    price: "£10",
    period: "per month",
    pricePerProspect: "£1.00",
    savings: "50% savings",
    popular: false,
  },
  {
    name: "Starter Pack 30",
    prospects: 30,
    price: "£25",
    period: "per month",
    pricePerProspect: "£0.83",
    savings: "58% savings",
    popular: true,
  },
  {
    name: "Starter Pack 100",
    prospects: 100,
    price: "£49",
    period: "per month",
    pricePerProspect: "£0.49",
    savings: "76% savings",
    popular: false,
  },
];

const teamPackages = [
  {
    name: "Team Pack 100",
    prospects: 100,
    price: "£50",
    period: "per month",
    pricePerProspect: "£0.50",
    savings: "67% savings",
    popular: false,
  },
  {
    name: "Team Pack 250",
    prospects: 250,
    price: "£75",
    period: "per month",
    pricePerProspect: "£0.30",
    savings: "80% savings",
    popular: true,
  },
  {
    name: "Team Pack 500",
    prospects: 500,
    price: "£99",
    period: "per month",
    pricePerProspect: "£0.20",
    savings: "87% savings",
    popular: false,
  },
];

export default function ValuePackages() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const selectedPlan = params.get("plan") || "starter";
  const { toast } = useToast();

  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const packages = selectedPlan === "team" ? teamPackages : starterPackages;
  const planName = selectedPlan === "team" ? "Team" : "Starter";
  const basePrice = selectedPlan === "team" ? "£1.50" : "£2.00";

  const handleSelectPackage = (pkg: (typeof starterPackages)[0]) => {
    if (!user) {
      setLocation("/auth");
      return;
    }

    toast({
      title: "Package Selected",
      description: `${pkg.name} will be added to your subscription. Contact us to complete your order.`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Link href="/pricing">
          <Button variant="ghost" className="mb-6" data-testid="button-back-pricing">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pricing
          </Button>
        </Link>

        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <Package className="w-3.5 h-3.5 mr-2" />
            {planName} Plan Add-ons
          </Badge>
          <h1 className="text-4xl font-bold mb-4" data-testid="text-page-title">
            Value Packages
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Save more when you buy additional prospects in bulk. All packages are billed monthly and
            can be cancelled anytime.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Standard rate: <span className="font-semibold text-foreground">{basePrice}</span> per
            additional prospect
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <Link href="/value-packages?plan=starter">
            <Button
              variant={selectedPlan === "starter" ? "default" : "outline"}
              data-testid="button-tab-starter"
            >
              Starter Packages
            </Button>
          </Link>
          <Link href="/value-packages?plan=team">
            <Button
              variant={selectedPlan === "team" ? "default" : "outline"}
              data-testid="button-tab-team"
            >
              Team Packages
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {packages.map((pkg) => (
            <Card
              key={pkg.name}
              className={`relative ${pkg.popular ? "border-primary shadow-lg" : ""}`}
              data-testid={`package-card-${pkg.prospects}`}
            >
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge variant="default" className="px-4 py-1">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Best Value
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-xl">{pkg.name}</CardTitle>
                <CardDescription>{pkg.prospects} additional prospects</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{pkg.price}</span>
                  <span className="text-muted-foreground ml-2">{pkg.period}</span>
                </div>
                <Badge
                  variant="secondary"
                  className="mt-3 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                >
                  {pkg.savings}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center border-t border-b py-4">
                  <div className="text-2xl font-bold text-primary">{pkg.pricePerProspect}</div>
                  <div className="text-sm text-muted-foreground">per prospect</div>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Billed monthly</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Cancel anytime</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Prospects roll over</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={pkg.popular ? "default" : "outline"}
                  onClick={() => handleSelectPackage(pkg)}
                  data-testid={`button-select-package-${pkg.prospects}`}
                >
                  {user ? "Add to Subscription" : "Sign Up to Purchase"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold mb-4">How Value Packages Work</h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-muted-foreground">
            <div>
              <div className="font-medium text-foreground mb-1">1. Choose a Package</div>
              <p>Select the package that fits your pipeline needs</p>
            </div>
            <div>
              <div className="font-medium text-foreground mb-1">2. Added to Subscription</div>
              <p>Package is added to your monthly billing</p>
            </div>
            <div>
              <div className="font-medium text-foreground mb-1">3. Use Anytime</div>
              <p>Prospects roll over month-to-month</p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Questions about packages? Email us at{" "}
            <a href="mailto:hello@veltro.co.uk" className="text-primary hover:underline">
              hello@veltro.co.uk
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
