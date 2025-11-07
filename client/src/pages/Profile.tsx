import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Crown, Mail, Calendar, TrendingUp, CreditCard, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { toast } = useToast();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<"standard" | "premium" | null>(null);
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);

  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const { data: prospects } = useQuery<any[]>({
    queryKey: ["/api/prospects"],
  });

  const createBillingRequestMutation = useMutation({
    mutationFn: async (tier: string) => {
      const response = await apiRequest("POST", "/api/gocardless/create-billing-request", {
        tier,
      });
      return response;
    },
    onSuccess: (data) => {
      sessionStorage.setItem("selectedTier", selectedTier || "");
      window.location.href = data.billingRequestFlowUrl;
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate payment flow",
        variant: "destructive",
      });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/gocardless/cancel-subscription", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled and you've been downgraded to the Free tier.",
      });
      setCancellationDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  const handleUpgrade = (tier: "standard" | "premium") => {
    setSelectedTier(tier);
    setUpgradeDialogOpen(true);
  };

  const confirmUpgrade = () => {
    if (selectedTier) {
      createBillingRequestMutation.mutate(selectedTier);
    }
    setUpgradeDialogOpen(false);
  };

  const confirmCancellation = () => {
    cancelSubscriptionMutation.mutate();
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-profile" />
      </div>
    );
  }

  const tierInfo = {
    free: {
      name: "Free",
      color: "bg-muted",
      limit: 10,
      price: "£0/month",
      features: [
        "10 prospects included",
        "Basic pipeline management",
        "£3 per additional prospect",
      ],
    },
    standard: {
      name: "Standard",
      color: "bg-primary",
      limit: 100,
      price: "£29/month",
      features: [
        "100 prospects included",
        "All due diligence tools",
        "Companies House integration",
        "PDF report generation",
        "£2 per additional prospect",
      ],
    },
    premium: {
      name: "Premium",
      color: "bg-primary",
      limit: 500,
      price: "£49/month",
      features: [
        "500 prospects included",
        "All Standard features",
        "Priority support",
        "Advanced analytics",
        "£1 per additional prospect",
      ],
    },
  };

  const currentTier = user?.subscriptionTier || "free";
  const currentTierInfo = tierInfo[currentTier as keyof typeof tierInfo];
  const prospectCount = prospects?.length || 0;
  const prospectLimit = user?.prospectLimit || 10;

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="heading-profile">Profile & Subscription</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-account-info">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16" data-testid="avatar-user">
                <AvatarImage src={user?.profileImageUrl} />
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-lg" data-testid="text-user-name">
                  {user?.firstName} {user?.lastName}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span data-testid="text-user-email">{user?.email}</span>
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Member since</span>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm" data-testid="text-member-since">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB") : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-subscription">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Current Subscription
            </CardTitle>
            <CardDescription>Manage your subscription plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plan</span>
              <Badge className={currentTierInfo.color} data-testid="badge-current-tier">
                {currentTierInfo.name}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Price</span>
              <span className="font-semibold" data-testid="text-current-price">{currentTierInfo.price}</span>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Prospects Used</span>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold" data-testid="text-prospect-usage">
                    {prospectCount} / {prospectLimit}
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((prospectCount / prospectLimit) * 100, 100)}%` }}
                />
              </div>
            </div>
            {currentTier !== "free" && user?.gocardlessSubscriptionId && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setCancellationDialogOpen(true)}
                data-testid="button-cancel-subscription"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Cancel Subscription
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {currentTier !== "premium" && (
        <Card data-testid="card-upgrade">
          <CardHeader>
            <CardTitle>Upgrade Your Plan</CardTitle>
            <CardDescription>Get more prospects and unlock premium features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {currentTier !== "standard" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Standard</CardTitle>
                    <div className="text-3xl font-bold">£29<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {tierInfo.standard.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => handleUpgrade("standard")}
                      disabled={createBillingRequestMutation.isPending}
                      data-testid="button-upgrade-standard"
                    >
                      {createBillingRequestMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Crown className="mr-2 h-4 w-4" />
                      )}
                      Upgrade to Standard
                    </Button>
                  </CardFooter>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Premium</CardTitle>
                  <div className="text-3xl font-bold">£49<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tierInfo.premium.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade("premium")}
                    disabled={createBillingRequestMutation.isPending}
                    data-testid="button-upgrade-premium"
                  >
                    {createBillingRequestMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Crown className="mr-2 h-4 w-4" />
                    )}
                    Upgrade to Premium
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <AlertDialogContent data-testid="dialog-upgrade-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Upgrade</AlertDialogTitle>
            <AlertDialogDescription>
              You will be redirected to GoCardless to set up your Direct Debit payment for the{" "}
              <span className="font-semibold">{selectedTier === "standard" ? "Standard" : "Premium"}</span> plan.
              Your subscription will start immediately after authorization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-upgrade">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUpgrade} data-testid="button-confirm-upgrade">
              Continue to Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancellationDialogOpen} onOpenChange={setCancellationDialogOpen}>
        <AlertDialogContent data-testid="dialog-cancel-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your subscription? You will be downgraded to the Free tier
              and your prospect limit will be reduced to 10.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-cancellation">No, Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancellation}
              data-testid="button-confirm-cancellation"
              disabled={cancelSubscriptionMutation.isPending}
            >
              {cancelSubscriptionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Yes, Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
