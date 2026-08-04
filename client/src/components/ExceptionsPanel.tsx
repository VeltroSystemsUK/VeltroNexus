import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, MapPin } from "lucide-react";
import { toast } from "sonner";

interface VerificationException {
  id: number;
  source: "companies_house" | "google_places" | "due_diligence";
  severity: "low" | "medium" | "high";
  message: string;
  status: "open" | "acknowledged" | "resolved";
  createdAt: string;
}

const SOURCE_LABELS: Record<VerificationException["source"], string> = {
  companies_house: "Companies House",
  google_places: "Address Verification",
  due_diligence: "Due Diligence",
};

const SEVERITY_VARIANT: Record<VerificationException["severity"], "default" | "destructive" | "secondary"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

export default function ExceptionsPanel({ prospectId }: { prospectId: number }) {
  const { data: exceptions = [] } = useQuery<VerificationException[]>({
    queryKey: [`/api/prospects/${prospectId}/exceptions`],
    enabled: !!prospectId,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/exceptions/${id}/resolve`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/exceptions`] });
    },
  });

  const verifyAddressMutation = useMutation({
    mutationFn: () => apiRequest(`/api/prospects/${prospectId}/verify-address`, "POST"),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/exceptions`] });
      toast[result.confidence === "high" ? "success" : "warning"](
        result.confidence === "high"
          ? "Address verified against Google Places"
          : "Address could not be confirmed — exception filed"
      );
    },
    onError: (error: any) => {
      toast.error(error.message || "Address verification failed");
    },
  });

  const openExceptions = exceptions.filter((e) => e.status === "open");

  return (
    <Card className={openExceptions.length > 0 ? "border-amber-500/50" : undefined} data-testid="card-exceptions">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Open Exceptions ({openExceptions.length})
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => verifyAddressMutation.mutate()}
          disabled={verifyAddressMutation.isPending}
          data-testid="button-verify-address"
        >
          <MapPin className="h-4 w-4 mr-1" />
          {verifyAddressMutation.isPending ? "Verifying..." : "Verify Address"}
        </Button>
      </CardHeader>
      {openExceptions.length > 0 && (
      <CardContent className="space-y-2">
        {openExceptions.map((exception) => (
          <div
            key={exception.id}
            className="flex items-start justify-between gap-3 rounded-md border p-3"
            data-testid={`exception-${exception.id}`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={SEVERITY_VARIANT[exception.severity]}>{exception.severity}</Badge>
                <span className="text-xs text-muted-foreground">{SOURCE_LABELS[exception.source]}</span>
              </div>
              <p className="text-sm">{exception.message}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => resolveMutation.mutate(exception.id)}
              disabled={resolveMutation.isPending}
              data-testid={`button-resolve-exception-${exception.id}`}
            >
              <Check className="h-4 w-4 mr-1" />
              Resolve
            </Button>
          </div>
        ))}
      </CardContent>
      )}
    </Card>
  );
}
