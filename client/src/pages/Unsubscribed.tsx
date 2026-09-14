import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import type { OpenerRecord } from "@shared/openers";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePageTitle } from "@/context/LayoutContext";

function openerTitle(opener: Pick<OpenerRecord, "companyName" | "email">) {
  return opener.companyName?.trim() || opener.email;
}

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function unsubscribedAt(opener: OpenerRecord) {
  return opener.nurture?.stoppedAt || opener.updatedAt || opener.lastOpenedAt;
}

export default function Unsubscribed() {
  usePageTitle("Unsubscribed", "Opted out — not a sales queue");
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery<OpenerRecord[]>({
    queryKey: ["/api/openers/unsubscribed"],
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data || [];
    if (!q) return list;
    return list.filter((opener) => {
      const haystack = [opener.companyName, opener.email, opener.companyNumber, ...(opener.emails || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data, search]);

  return (
    <div className="min-h-screen bg-transparent pb-24" data-testid="page-unsubscribed">
      <main className="w-full px-4 md:px-6 py-6 space-y-4">
        <h1 className="text-2xl font-semibold">Unsubscribed</h1>
        <p className="text-sm text-muted-foreground">
          Opted out — not a sales queue. PECR record only.
        </p>

        <div className="relative max-w-md w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search unsubscribed"
            className="h-9 pl-8"
          />
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading unsubscribed…
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive">Unable to load unsubscribed. Super admin access is required.</p>
        )}

        <div className="space-y-3 max-w-2xl">
          {!isLoading && !error && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No unsubscribed companies.</p>
          )}
          {rows.map((opener) => (
            <Card key={opener.id}>
              <CardContent className="p-3 space-y-1">
                <p className="font-medium text-sm truncate">{openerTitle(opener)}</p>
                <p className="text-sm text-muted-foreground truncate">{opener.email}</p>
                <p className="text-xs text-muted-foreground">{formatWhen(unsubscribedAt(opener))}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
