import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Package, Zap, ArrowRight, Check, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface ProspectLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCount: number;
  limit: number;
  subscriptionTier: string;
}

const valuePackages = {
  free: [
    { id: "free-10", name: "10 Extra Prospects", prospects: 10, price: 15, pricePerProspect: "£1.50" },
    { id: "free-25", name: "25 Extra Prospects", prospects: 25, price: 30, pricePerProspect: "£1.20", popular: true },
    { id: "free-50", name: "50 Extra Prospects", prospects: 50, price: 50, pricePerProspect: "£1.00" },
  ],
  starter: [
    { id: "starter-10", name: "10 Extra Prospects", prospects: 10, price: 10, pricePerProspect: "£1.00" },
    { id: "starter-30", name: "30 Extra Prospects", prospects: 30, price: 25, pricePerProspect: "£0.83", popular: true },
    { id: "starter-100", name: "100 Extra Prospects", prospects: 100, price: 49, pricePerProspect: "£0.49" },
  ],
  team: [
    { id: "team-100", name: "100 Extra Prospects", prospects: 100, price: 50, pricePerProspect: "£0.50" },
    { id: "team-250", name: "250 Extra Prospects", prospects: 250, price: 75, pricePerProspect: "£0.30", popular: true },
    { id: "team-500", name: "500 Extra Prospects", prospects: 500, price: 99, pricePerProspect: "£0.20" },
  ],
};

const upgradeOptions = {
  free: { tier: "starter", name: "Starter", price: "£39/mo", prospects: 50 },
  starter: { tier: "team", name: "Team", price: "£229/mo", prospects: 250 },
  team: { tier: "lender", name: "Lender", price: "£999/mo", prospects: "Unlimited" },
};

export default function ProspectLimitModal({
  open,
  onOpenChange,
  currentCount,
  limit,
  subscriptionTier,
}: ProspectLimitModalProps) {
  const { toast } = useToast();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  
  const packages = valuePackages[subscriptionTier as keyof typeof valuePackages] || valuePackages.free;
  const upgrade = upgradeOptions[subscriptionTier as keyof typeof upgradeOptions];
  
  const usagePercent = Math.min((currentCount / limit) * 100, 100);
  const isAtLimit = currentCount >= limit;
  const overLimit = currentCount - limit;

  const purchasePackageMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const result = await apiRequest('/api/gocardless/create-package-payment', 'POST', { packageId });
      return result;
    },
    onSuccess: (data: any) => {
      if (data.authorisationUrl) {
        window.location.href = data.authorisationUrl;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePurchasePackage = (packageId: string) => {
    setSelectedPackage(packageId);
    purchasePackageMutation.mutate(packageId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-xl">Prospect Limit Reached</DialogTitle>
              <DialogDescription>
                You've reached the limit on your {subscriptionTier} plan
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Current Usage</span>
                <span className="text-sm text-muted-foreground">
                  {currentCount} / {limit} prospects
                </span>
              </div>
              <Progress value={usagePercent} className="h-2" />
              {isAtLimit && overLimit > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  You have {overLimit} prospect{overLimit > 1 ? 's' : ''} over your limit
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              Buy Extra Prospects
            </h3>
            <div className="grid gap-3">
              {packages.map((pkg) => (
                <Card 
                  key={pkg.id} 
                  className={`cursor-pointer transition-all hover-elevate ${
                    pkg.popular ? 'border-primary' : ''
                  }`}
                  onClick={() => handlePurchasePackage(pkg.id)}
                  data-testid={`button-package-${pkg.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{pkg.name}</span>
                            {pkg.popular && (
                              <Badge variant="secondary" className="text-xs">Best Value</Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {pkg.pricePerProspect} per prospect
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold">£{pkg.price}</span>
                        <p className="text-xs text-muted-foreground">one-time</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {upgrade && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Or Upgrade Your Plan
                </h3>
                <Card className="border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Sparkles className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg">{upgrade.name} Plan</span>
                            <Badge variant="default">Recommended</Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {upgrade.prospects} prospects included
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold">{upgrade.price}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <ul className="flex-1 grid grid-cols-2 gap-1 text-sm">
                        <li className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          <span>More prospects</span>
                        </li>
                        <li className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          <span>Priority support</span>
                        </li>
                        <li className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          <span>Advanced features</span>
                        </li>
                        <li className="flex items-center gap-1">
                          <Check className="h-3 w-3 text-green-500" />
                          <span>Team collaboration</span>
                        </li>
                      </ul>
                      <Link href="/pricing">
                        <Button className="gap-2" data-testid="button-upgrade-plan">
                          Upgrade Now
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-limit-modal">
              Close
            </Button>
            <Link href="/value-packages">
              <Button variant="secondary" className="gap-2" data-testid="button-view-all-packages">
                View All Packages
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
