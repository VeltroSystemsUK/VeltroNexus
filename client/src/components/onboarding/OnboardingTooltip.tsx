import { useEffect, useState, useRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

interface OnboardingTooltipProps {
    children: ReactNode;
    title?: string;
    message: string;
    step?: number;
    totalSteps?: number;
    position?: TooltipPosition;
    isActive: boolean;
    onNext?: () => void;
    onBack?: () => void;
    onSkip?: () => void;
    spotlightPadding?: number;
    className?: string;
}

export function OnboardingTooltip({
    children,
    title,
    message,
    step,
    totalSteps,
    position = "bottom",
    isActive,
    onNext,
    onBack,
    onSkip,
    spotlightPadding = 8,
    className,
}: OnboardingTooltipProps) {
    const targetRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

    // Calculate tooltip position based on target element
    useEffect(() => {
        if (!isActive || !targetRef.current || !tooltipRef.current) return;

        const updatePosition = () => {
            const targetRect = targetRef.current!.getBoundingClientRect();
            const tooltipRect = tooltipRef.current!.getBoundingClientRect();

            let top = 0;
            let left = 0;

            switch (position) {
                case "top":
                    top = targetRect.top - tooltipRect.height - 12;
                    left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case "bottom":
                    top = targetRect.bottom + 12;
                    left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case "left":
                    top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                    left = targetRect.left - tooltipRect.width - 12;
                    break;
                case "right":
                    top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                    left = targetRect.right + 12;
                    break;
            }

            // Keep tooltip within viewport
            left = Math.max(16, Math.min(left, window.innerWidth - tooltipRect.width - 16));
            top = Math.max(16, Math.min(top, window.innerHeight - tooltipRect.height - 16));

            setTooltipPosition({ top, left });
        };

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition);

        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition);
        };
    }, [isActive, position]);

    // Scroll target into view when active
    useEffect(() => {
        if (isActive && targetRef.current) {
            targetRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [isActive]);

    const arrowClasses = cn(
        "absolute w-3 h-3 bg-card border rotate-45",
        {
            "bottom-[-6px] left-1/2 -translate-x-1/2 border-t-0 border-l-0": position === "top",
            "top-[-6px] left-1/2 -translate-x-1/2 border-b-0 border-r-0": position === "bottom",
            "right-[-6px] top-1/2 -translate-y-1/2 border-b-0 border-l-0": position === "left",
            "left-[-6px] top-1/2 -translate-y-1/2 border-t-0 border-r-0": position === "right",
        }
    );

    return (
        <>
            {/* Target element wrapper */}
            <div
                ref={targetRef}
                className={cn(
                    "relative",
                    isActive && "z-[60] animate-onboarding-pulse rounded-lg",
                    className
                )}
                style={isActive ? {
                    boxShadow: `0 0 0 ${spotlightPadding}px rgba(217, 119, 6, 0.2)`,
                } : undefined}
            >
                {children}
            </div>

            {/* Backdrop overlay */}
            {isActive && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
                    onClick={onSkip}
                />
            )}

            {/* Tooltip */}
            {isActive && (
                <div
                    ref={tooltipRef}
                    className="fixed z-[70] w-80 bg-card border rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
                    style={{
                        top: tooltipPosition.top,
                        left: tooltipPosition.left,
                    }}
                    data-testid="onboarding-tooltip"
                >
                    {/* Arrow */}
                    <div className={arrowClasses} />

                    <div className="p-4 space-y-3">
                        {/* Header with step indicator */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                                {step && totalSteps && (
                                    <p className="text-xs text-muted-foreground mb-1">
                                        Step {step} of {totalSteps}
                                    </p>
                                )}
                                {title && (
                                    <h4 className="font-semibold text-sm">{title}</h4>
                                )}
                            </div>
                            {onSkip && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 -mt-1 -mr-1"
                                    onClick={onSkip}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>

                        {/* Message */}
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {message}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-1">
                            <div>
                                {onBack && step && step > 1 && (
                                    <Button variant="ghost" size="sm" onClick={onBack}>
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Back
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {onSkip && (
                                    <Button variant="ghost" size="sm" onClick={onSkip}>
                                        Skip tour
                                    </Button>
                                )}
                                {onNext && (
                                    <Button size="sm" onClick={onNext}>
                                        {step === totalSteps ? "Finish" : "Next"}
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
