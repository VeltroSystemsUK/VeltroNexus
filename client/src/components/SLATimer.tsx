
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock } from "lucide-react";

interface SLATimerProps {
    submittedAt: string | Date; // ISO string or Date
    slaSettings: { green: number; amber: number; red: number }; // hours
}

export function SLATimer({ submittedAt, slaSettings }: SLATimerProps) {
    const [elapsed, setElapsed] = useState(0);

    const submitTime = new Date(submittedAt).getTime();
    const greenMs = slaSettings.green * 60 * 60 * 1000;
    const amberMs = slaSettings.amber * 60 * 60 * 1000;
    const redMs = slaSettings.red * 60 * 60 * 1000;

    useEffect(() => {
        const calculateElapsed = () => {
            setElapsed(Date.now() - submitTime);
        };
        calculateElapsed();
        const interval = setInterval(calculateElapsed, 1000); // Update every second for digital clock
        return () => clearInterval(interval);
    }, [submitTime]);

    // Format elapsed time (HH:MM:SS)
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

    const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
    let className = "text-green-500 border-green-500 font-mono"; // Default Green
    let icon = <Clock className="h-3 w-3 mr-1" />;

    if (elapsed > redMs) {
        variant = "destructive";
        className = "bg-red-500/10 text-red-600 border-red-500 font-mono font-bold";
        icon = <AlertCircle className="h-3 w-3 mr-1" />;
    } else if (elapsed > amberMs) {
        variant = "secondary";
        className = "bg-amber-500/10 text-amber-600 border-amber-500 font-mono font-medium";
        icon = <Clock className="h-3 w-3 mr-1" />;
    } else if (elapsed > greenMs) {
        // Should this be amber or remain green? User said Green -> Amber -> Red.
        // Assuming green limit is just the start of amber?
        // Actually "amber in the second SLA period" implies > Green limit.
        variant = "secondary";
        className = "bg-amber-500/10 text-amber-600 border-amber-500 font-mono font-medium";
    }

    // Wait, typical SLA:
    // < 4h = Green
    // 4h - 8h = Amber
    // > 8h = Red
    // My logic: if > redMs (e.g. 8h) -> Red. if > amberMs (e.g. 4h) -> Amber. Else Green.
    // User said: "green for the first SLA period, amber in the second SLA period and Red in the final SLA period"
    // So if SLA settings are { green: 4, amber: 8, red: 24 }
    // 0-4h: Green
    // 4-8h: Amber
    // 8h+: Red (and warning sign)

    // Re-evaluating logic with simple thresholds:
    // If we say "amber: 4", "red: 8"
    if (elapsed > slaSettings.red * 3600000) {
        className = "bg-red-500/10 text-red-600 border-red-500/50 font-mono font-bold animate-pulse";
        icon = <AlertCircle className="h-3 w-3 mr-1" />;
    } else if (elapsed > slaSettings.amber * 3600000) {
        className = "bg-amber-500/10 text-amber-600 border-amber-500/50 font-mono";
    }

    return (
        <Badge variant={variant} className={className}>
            {icon}
            {formattedTime}
        </Badge>
    );
}
