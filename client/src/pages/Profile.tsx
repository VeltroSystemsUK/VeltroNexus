import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import {
  Crown,
  Mail,
  Calendar,
  TrendingUp,
  CreditCard,
  CheckCircle,
  Loader2,
  Users,
  Briefcase,
  Shield,
  UserCog,
  ArrowLeft,
  ShoppingBag,
  Package,
  Plus,
  History,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";

export default function Profile() {
  const [, navigate] = useLocation();
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

  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/role"],
  });

  const { data: addOnProducts, isLoading: addOnsLoading } = useQuery<any[]>({
    queryKey: ["/api/add-ons"],
  });

  const { data: purchases } = useQuery<any[]>({
    queryKey: ["/api/add-ons/purchases"],
  });

  const { data: creditsData } = useQuery<{ credits: number }>({
    queryKey: ["/api/add-ons/credits"],
  });

  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const purchaseMutation = useMutation({
    mutationFn: async (productId: number) => {
      const response = await apiRequest("/api/add-ons/purchase", "POST", {
        productId,
        quantity: 1,
      });
      return response as unknown as { success: boolean; purchase: any; message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/add-ons/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/add-ons/credits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Purchase Successful",
        description: data.message,
      });
      setPurchaseDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to complete purchase",
        variant: "destructive",
      });
      setPurchaseDialogOpen(false);
    },
  });

  const handlePurchase = (product: any) => {
    setSelectedProduct(product);
    setPurchaseDialogOpen(true);
  };

  const confirmPurchase = () => {
    if (selectedProduct) {
      purchaseMutation.mutate(selectedProduct.id);
    }
  };

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      const response = await apiRequest("/api/auth/role", "POST", { role: newRole });
      return response as unknown as { role: string; message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/role"] });
      toast({
        title: "Role Switched",
        description: `You are now viewing the app as a ${data.role}. Refresh to see the updated navigation.`,
      });
      // Reload the page to update navigation
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to switch role",
        variant: "destructive",
      });
    },
  });

  const createBillingRequestMutation = useMutation({
    mutationFn: async (tier: string) => {
      throw new Error("Payment processing is temporarily unavailable. Please contact support.");
    },
    onError: (error: any) => {
      toast({
        title: "Subscription Unavailable",
        description:
          error.message || "Payment processing is temporarily unavailable. Please contact support.",
        variant: "destructive",
      });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      throw new Error(
        "Subscription management is temporarily unavailable. Please contact support."
      );
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error.message ||
          "Subscription management is temporarily unavailable. Please contact support.",
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
    <div className="min-h-screen bg-background pb-24">
      <PageHeader
        title="Profile & Subscription"
        showBackButton={true}
      />

      <div className="container max-w-6xl mx-auto p-6 space-y-6">
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
                <span className="font-semibold" data-testid="text-current-price">
                  {currentTierInfo.price}
                </span>
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

        <Card data-testid="card-role-switcher">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Role Switcher
            </CardTitle>
            <CardDescription>
              Switch between roles for testing (in production, only admins can change roles)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                {roleData?.role === "super_admin" && <Shield className="h-5 w-5 text-red-500" />}
                {roleData?.role === "sales_admin" && <UserCog className="h-5 w-5 text-orange-500" />}
                {roleData?.role === "broker" && <Briefcase className="h-5 w-5 text-primary" />}
                {roleData?.role === "underwriter" && <Users className="h-5 w-5 text-purple-500" />}
                <div>
                  <p className="font-medium">
                    Current Role:{" "}
                    {roleData?.role?.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {roleData?.role === "super_admin" &&
                      "Full platform access, manage users and teams"}
                    {roleData?.role === "sales_admin" &&
                      "Team-level prospect oversight and management"}
                    {roleData?.role === "broker" && "Manage prospects and submit for review"}
                    {roleData?.role === "underwriter" &&
                      "Review and approve underwriting submissions"}
                  </p>
                </div>
              </div>
              <Select
                value={roleData?.role || "broker"}
                onValueChange={(value) => switchRoleMutation.mutate(value)}
                disabled={switchRoleMutation.isPending}
              >
                <SelectTrigger className="w-44" data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin" data-testid="option-super-admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-500" />
                      Super Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="sales_admin" data-testid="option-sales-admin">
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-orange-500" />
                      Sales Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="broker" data-testid="option-broker">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Broker
                    </div>
                  </SelectItem>
                  <SelectItem value="underwriter" data-testid="option-underwriter">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      Underwriter
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {switchRoleMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Switching role...
              </div>
            )}
          </CardContent>
        </Card>



        {/* Add-Ons Marketplace */}
        <Card data-testid="card-add-ons">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Add-Ons Marketplace
            </CardTitle>
            <CardDescription>Purchase additional prospect packs and feature add-ons</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Credits Display */}
            {creditsData?.credits !== undefined && creditsData.credits > 0 && (
              <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Available Prospect Credits</p>
                    <p className="text-sm text-muted-foreground">From purchased add-on packs</p>
                  </div>
                </div>
                <Badge className="text-lg px-4 py-1" data-testid="badge-credits">
                  {creditsData.credits}
                </Badge>
              </div>
            )}

            {/* Products Grid */}
            {addOnsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : addOnProducts && addOnProducts.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {addOnProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="relative"
                    data-testid={`card-product-${product.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{product.title}</CardTitle>
                        <Badge variant={product.category === "prospects" ? "default" : "secondary"}>
                          {product.category === "prospects" ? "Prospects" : "Feature"}
                        </Badge>
                      </div>
                      {product.description && (
                        <CardDescription>{product.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="space-y-2">
                        {product.category === "prospects" && product.quantityIncluded && (
                          <div className="flex items-center gap-2 text-sm">
                            <Plus className="h-4 w-4 text-primary" />
                            <span>{product.quantityIncluded} additional prospects</span>
                          </div>
                        )}
                        {product.featureKey && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-primary" />
                            <span>Unlocks: {product.featureKey.replace(/_/g, " ")}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="text-2xl font-bold">
                          £{(product.priceInPence / 100).toFixed(2)}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handlePurchase(product)}
                          disabled={purchaseMutation.isPending || !user?.gocardlessMandateId}
                          data-testid={`button-purchase-${product.id}`}
                        >
                          {purchaseMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShoppingBag className="h-4 w-4 mr-1" />
                          )}
                          Buy Now
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No add-ons available at the moment</p>
                <p className="text-sm">Check back later for prospect packs and feature add-ons</p>
              </div>
            )}

            {!user?.gocardlessMandateId && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Payment method required:</strong> Set up a subscription first to enable
                  one-click purchases.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Purchase History */}
        {purchases && purchases.length > 0 && (
          <Card data-testid="card-purchase-history">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Purchase History
              </CardTitle>
              <CardDescription>Your add-on purchase history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                    data-testid={`row-purchase-${purchase.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{purchase.product?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(purchase.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        £{(purchase.totalPaidInPence / 100).toFixed(2)}
                      </span>
                      <Badge
                        variant={purchase.status === "completed" ? "default" : "secondary"}
                        className={purchase.status === "completed" ? "bg-green-600" : ""}
                      >
                        {purchase.status}
                      </Badge>
                    </div>
                  </div>
                ))}
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
                <span className="font-semibold">
                  {selectedTier === "standard" ? "Standard" : "Premium"}
                </span>{" "}
                plan. Your subscription will start immediately after authorization.
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
                Are you sure you want to cancel your subscription? You will be downgraded to the Free
                tier and your prospect limit will be reduced to 10.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-cancellation">
                No, Keep Subscription
              </AlertDialogCancel>
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

        <AlertDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
          <AlertDialogContent data-testid="dialog-purchase-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Purchase</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to purchase{" "}
                <span className="font-semibold">{selectedProduct?.title}</span> for{" "}
                <span className="font-semibold">
                  £{selectedProduct ? (selectedProduct.priceInPence / 100).toFixed(2) : "0.00"}
                </span>
                .
                {selectedProduct?.category === "prospects" && selectedProduct?.quantityIncluded && (
                  <>
                    {" "}
                    This will add{" "}
                    <span className="font-semibold">
                      {selectedProduct.quantityIncluded} prospect credits
                    </span>{" "}
                    to your account.
                  </>
                )}
                <br />
                <br />
                The payment will be collected via your existing Direct Debit mandate.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-purchase">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmPurchase}
                disabled={purchaseMutation.isPending}
                data-testid="button-confirm-purchase"
              >
                {purchaseMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingBag className="mr-2 h-4 w-4" />
                )}
                Confirm Purchase
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>

  );
}
