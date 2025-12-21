import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SubscriptionComplete() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const completeSubscriptionMutation = useMutation({
    mutationFn: async (billingRequestFlowId: string) => {
      throw new Error("Payment processing is temporarily unavailable. Please contact support.");
    },
    onError: (error: any) => {
      setStatus("error");
      sessionStorage.removeItem("subscription_tier");
      toast({
        title: "Subscription Unavailable",
        description:
          error.message || "Payment processing is temporarily unavailable. Please contact support.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const billingRequestFlowId = urlParams.get("billing_request_flow_id");

    if (!billingRequestFlowId) {
      setStatus("error");
      toast({
        title: "Invalid Request",
        description: "Missing billing request flow information.",
        variant: "destructive",
      });
      return;
    }

    completeSubscriptionMutation.mutate(billingRequestFlowId);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full" data-testid="subscription-complete-card">
        <CardHeader className="text-center">
          {status === "processing" && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
              </div>
              <CardTitle>Processing Your Subscription</CardTitle>
              <CardDescription>Please wait while we set up your subscription...</CardDescription>
            </>
          )}
          {status === "success" && (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-green-500" data-testid="icon-success" />
              </div>
              <CardTitle>Subscription Activated!</CardTitle>
              <CardDescription>
                Your subscription has been successfully activated. You can now access all premium
                features.
              </CardDescription>
            </>
          )}
          {status === "error" && (
            <>
              <div className="flex justify-center mb-4">
                <XCircle className="w-16 h-16 text-destructive" data-testid="icon-error" />
              </div>
              <CardTitle>Subscription Failed</CardTitle>
              <CardDescription>
                We couldn't complete your subscription. Please try again or contact support.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {status === "success" && (
            <Button
              className="w-full"
              onClick={() => setLocation("/pipeline")}
              data-testid="button-go-to-pipeline"
            >
              Go to Pipeline
            </Button>
          )}
          {status === "error" && (
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => setLocation("/pricing")}
                data-testid="button-try-again"
              >
                Try Again
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setLocation("/pipeline")}
                data-testid="button-back-to-pipeline"
              >
                Back to Pipeline
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
