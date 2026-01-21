import { useOnboarding, ONBOARDING_CHECKLIST } from "./OnboardingProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ChevronRight, X, Rocket } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface OnboardingChecklistProps {
    className?: string;
    collapsible?: boolean;
}

export function OnboardingChecklist({ className, collapsible = true }: OnboardingChecklistProps) {
    const [, navigate] = useLocation();
    const {
        enabled,
        progress,
        progressPercentage,
        completedStepsCount,
        totalStepsCount,
        toggleOnboarding,
        isLoading,
    } = useOnboarding();

    const [dismissed, setDismissed] = useState(false);

    // Don't show if disabled, dismissed, or all completed
    if (!enabled || dismissed || progressPercentage === 100) {
        return null;
    }

    const handleStepClick = (stepId: string) => {
        // Navigate to appropriate page based on step
        switch (stepId) {
            case "first_underwrite":
                navigate("/search");
                break;
            case "first_lead":
                navigate("/leads");
                break;
            case "custom_pipeline":
                navigate("/settings");
                break;
            case "first_task":
                navigate("/pipeline");
                break;
            case "invite_team":
                navigate("/teams");
                break;
        }
    };

    const handleDismiss = () => {
        setDismissed(true);
    };

    if (isLoading) {
        return null;
    }

    return (
        <Card className={cn("relative overflow-hidden", className)} data-testid="onboarding-checklist">
            {/* Gradient accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-success" />

            {/* Dismiss button */}
            {collapsible && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={handleDismiss}
                    data-testid="onboarding-checklist-dismiss"
                >
                    <X className="h-4 w-4" />
                </Button>
            )}

            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Rocket className="h-5 w-5 text-primary" />
                    Your Path to Peak Efficiency
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Progress bar */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {completedStepsCount} of {totalStepsCount} completed
                        </span>
                        <span className="font-medium text-primary">{progressPercentage}%</span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                </div>

                {/* Checklist items */}
                <ul className="space-y-2">
                    {ONBOARDING_CHECKLIST.map((step) => {
                        const isCompleted = progress.completed.includes(step.id);

                        return (
                            <li key={step.id}>
                                <button
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                                        "hover:bg-muted/50 group",
                                        isCompleted && "opacity-60"
                                    )}
                                    onClick={() => !isCompleted && handleStepClick(step.id)}
                                    disabled={isCompleted}
                                    data-testid={`onboarding-step-${step.id}`}
                                >
                                    {/* Checkbox/Status icon */}
                                    <div className={cn(
                                        "flex-shrink-0 transition-transform",
                                        isCompleted && "animate-check-bounce"
                                    )}>
                                        {isCompleted ? (
                                            <CheckCircle2 className="h-5 w-5 text-success" />
                                        ) : (
                                            <Circle className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                                        )}
                                    </div>

                                    {/* Icon */}
                                    <span className="text-lg">{step.icon}</span>

                                    {/* Label */}
                                    <span className={cn(
                                        "flex-1 text-sm font-medium",
                                        isCompleted && "line-through text-muted-foreground"
                                    )}>
                                        {step.label}
                                    </span>

                                    {/* Arrow for incomplete items */}
                                    {!isCompleted && (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>

                {/* Complete message when all done */}
                {progressPercentage === 100 && (
                    <div className="pt-2 text-center">
                        <p className="text-sm text-success font-medium">
                            🎉 You're all set! You've mastered the basics.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
