import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TrialBanner() {
    const { user } = useAuth();
    const [dismissed, setDismissed] = useState(false);
    const [daysLeft, setDaysLeft] = useState<number | null>(null);

    useEffect(() => {
        if (user?.trialEndsAt) {
            const trialEnd = new Date(user.trialEndsAt);
            const now = new Date();
            const diffTime = trialEnd.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDaysLeft(diffDays > 0 ? diffDays : 0);
        }
    }, [user?.trialEndsAt]);

    // Don't show if no trial, trial expired, or user has subscription, or dismissed
    if (!user?.trialEndsAt || daysLeft === null || daysLeft <= 0 || dismissed) {
        // Check if trial expired - show different message
        if (user?.trialEndsAt && daysLeft !== null && daysLeft <= 0) {
            return (
                <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-destructive">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>
                            <strong>Your trial has expired.</strong>{" "}
                            Subscribe now to continue using Veltro.
                        </span>
                    </div>
                    <Link href="/settings?tab=billing">
                        <Button size="sm" variant="destructive" className="shrink-0">
                            Subscribe Now
                        </Button>
                    </Link>
                </div>
            );
        }
        return null;
    }

    const tierName = user.trialTier === "team" ? "Team" : "Broker";

    return (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-foreground">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <span>
                    <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> left on your {tierName} trial.
                </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Link href="/settings?tab=billing">
                    <Button size="sm" variant="default" className="h-7 text-xs">
                        Upgrade Now
                    </Button>
                </Link>
                <button
                    onClick={() => setDismissed(true)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded"
                    aria-label="Dismiss"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
