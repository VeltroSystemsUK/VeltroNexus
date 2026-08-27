import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Packaging = {
  caseId?: string;
  title?: string;
  status?: "ready" | "error" | "disabled";
  launchUrl?: string;
  embedPath?: string;
  lastError?: string;
};

function embedSrc(packaging?: Packaging | null) {
  if (packaging?.embedPath) return packaging.embedPath;
  if (!packaging?.launchUrl) return "";
  try {
    const url = new URL(packaging.launchUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

export default function StrataWorkspace({ prospectId }: { prospectId: number }) {
  const statusQuery = useQuery<{ configured: boolean; packaging: Packaging | null }>({
    queryKey: [`/api/prospects/${prospectId}/strata-packaging`],
    enabled: prospectId > 0,
  });

  const start = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/prospects/${prospectId}/strata-packaging`, "POST", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prospects/${prospectId}/strata-packaging`] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const packaging = statusQuery.data?.packaging;
  const src = embedSrc(packaging);
  const ready = packaging?.status === "ready" && Boolean(src);

  useEffect(() => {
    if (statusQuery.isSuccess && statusQuery.data?.configured && !packaging?.caseId && !start.isPending && !start.isSuccess) {
      start.mutate();
    }
  }, [statusQuery.isSuccess, statusQuery.data?.configured, packaging?.caseId, start]);

  if (statusQuery.isLoading || start.isPending) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Opening the full Strata app inside Nexus…
      </div>
    );
  }

  if (!statusQuery.data?.configured) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Strata is not configured. Set STRATA_API_URL and STRATA_INTEGRATION_TOKEN, and keep the
        standalone Strata web/API running.
      </div>
    );
  }

  if (packaging?.status === "error") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
        {packaging.lastError || "Could not open Strata."}
        <div className="mt-3">
          <Button size="sm" onClick={() => start.mutate()}>Try again</Button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="rounded-lg border p-6">
        <p className="text-sm text-muted-foreground mb-3">No Strata case is open for this file yet.</p>
        <Button onClick={() => start.mutate()} disabled={start.isPending}>
          Open Strata
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0">
      <iframe
        title={packaging?.title || "Strata"}
        src={src}
        className="w-full h-full min-h-[calc(100vh-3.5rem)] border-0 bg-white"
      />
    </div>
  );
}
