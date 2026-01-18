import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Zap, ArrowRight, Check, Sparkles, Loader2, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProspectLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCount: number;
  limit: number;
  subscriptionTier: string;
}

// Pricing for upgrades based on current tier
const upgradePlans = {
  free: {
    recommended: {
      tier: "broker",
      name: "Broker",
      monthlyPrice: 49,
      yearlyPrice: 439,
      prospects: 50,
      features: [
        "50 prospects included",
        "Companies House integration",
        "Full due diligence suite",
        "PDF report generation",
        "Email support",
      ],
    },
    alternative: {
      tier: "team",
      name: "Team",
      monthlyPrice: 549,
      yearlyPrice: 5268,
      prospects: 250,
      features: [
        "5 team seats included",
        "250 prospects monthly",
        "Role-based access control",
        "Team collaboration",
        "Priority support",
      ],
    },
  },
  broker: {
    recommended: {
      tier: "team",
      name: "Team",
      monthlyPrice: 549,
      yearlyPrice: 5268,
      prospects: 250,
      features: [
        "5 team seats included",
        "250 prospects monthly",
        "Everything in Broker",
        "Role-based access control",
        "Priority support",
      ],
    },
    alternative: null,
  },
  team: {
    recommended: {
      tier: "lender",
      name: "Lender",
      monthlyPrice: 2499,
      yearlyPrice: 23988,
      prospects: "Unlimited",
      features: [
        "15 team seats included",
        "Unlimited prospects",
        "AI Credit Underwriting",
        "API access",
        "Dedicated account manager",
      ],
    },
    alternative: null,
  },
};

export default function ProspectLimitModal({
  open,
  onOpenChange,
  currentCount,
  limit,
  subscriptionTier,
}: ProspectLimitModalProps) {
  const { toast } = useToast();
  const [isAnnual, setIsAnnual] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const plans = upgradePlans[subscriptionTier as keyof typeof upgradePlans] || upgradePlans.free;
  const usagePercent = Math.min((currentCount / limit) * 100, 100);
  const overLimit = Math.max(currentCount - limit, 0);

  // Stripe checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async ({ tier, interval }: { tier: string; interval: "monthly" | "annual" }) => {
      const response = await apiRequest("POST", "/api/billing/checkout", {
        tier,
        interval,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
      setLoadingPlan(null);
    },
  });

  const handleUpgrade = (tier: string) => {
    setLoadingPlan(tier);
    checkoutMutation.mutate({
      tier,
      interval: isAnnual ? "annual" : "monthly",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">You've Hit Your Limit!</DialogTitle>
              <DialogDescription>
                Upgrade now to keep growing your pipeline
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {/* Usage indicator */}
          <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Prospects Used</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {currentCount} / {limit}
                </span>
              </div>
              <Progress value={usagePercent} className="h-3 bg-amber-200 dark:bg-amber-900" />
              {overLimit > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-2 font-medium">
                  ⚠️ {overLimit} prospect{overLimit > 1 ? "s" : ""} over your limit - upgrade to unlock!
                </p>
              )}
            </CardContent>
          </Card>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm ${!isAnnual ? "font-semibold" : "text-muted-foreground"}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative w-14 h-7 rounded-full transition-colors ${isAnnual ? "bg-primary" : "bg-muted"
                }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${isAnnual ? "translate-x-8" : "translate-x-1"
                  }`}
              />
            </button>
            <span className={`text-sm ${isAnnual ? "font-semibold" : "text-muted-foreground"}`}>
              Annual
            </span>
            {isAnnual && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Save 20%
              </Badge>
            )}
          </div>

          <Separator />

          {/* Recommended plan */}
          {plans.recommended && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Recommended Upgrade</h3>
              </div>

              <Card className="border-2 border-primary bg-gradient-to-br from-primary/5 via-transparent to-primary/10 overflow-hidden relative">
                <div className="absolute top-0 right-0">
                  <Badge className="rounded-none rounded-bl-lg">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Best Value
                  </Badge>
                </div>
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-xl font-bold">{plans.recommended.name} Plan</h4>
                      <p className="text-sm text-muted-foreground">
                        {typeof plans.recommended.prospects === "number"
                          ? `${plans.recommended.prospects} prospects/month`
                          : `${plans.recommended.prospects} prospects`}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        £{isAnnual
                          ? Math.round(plans.recommended.yearlyPrice / 12)
                          : plans.recommended.monthlyPrice}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        per month{isAnnual ? " (billed annually)" : ""}
                      </div>
                      {isAnnual && (
                        <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                          Save £{(plans.recommended.monthlyPrice * 12) - plans.recommended.yearlyPrice}/year
                        </div>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-2 mb-5">
                    {plans.recommended.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full gap-2 h-11 text-base"
                    onClick={() => handleUpgrade(plans.recommended!.tier)}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === plans.recommended.tier ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Upgrade to {plans.recommended.name}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Alternative plan */}
          {plans.alternative && (
            <Card className="border-muted">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{plans.alternative.name} Plan</h4>
                    <p className="text-xs text-muted-foreground">
                      {plans.alternative.prospects} prospects/month
                    </p>
                  </div>
                  <div className="text-right mr-4">
                    <span className="font-bold">
                      £{isAnnual
                        ? Math.round(plans.alternative.yearlyPrice / 12)
                        : plans.alternative.monthlyPrice}/mo
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpgrade(plans.alternative!.tier)}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === plans.alternative.tier ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Select"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground"
            >
              Maybe Later
            </Button>
            <p className="text-xs text-muted-foreground">
              Cancel anytime • 14-day money-back guarantee
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
