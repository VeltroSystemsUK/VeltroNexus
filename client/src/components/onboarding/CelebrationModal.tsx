import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "./OnboardingProvider";
import { CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

interface ConfettiPiece {
    id: number;
    left: number;
    delay: number;
    duration: number;
    color: string;
}

export function CelebrationModal() {
    const { showCelebration, setShowCelebration, celebrationMessage } = useOnboarding();
    const [, navigate] = useLocation();
    const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

    // Generate confetti on open
    useEffect(() => {
        if (showCelebration) {
            const colors = ["#D97706", "#4F46E5", "#22C55E", "#EAB308", "#EC4899"];
            const pieces: ConfettiPiece[] = [];
            for (let i = 0; i < 50; i++) {
                pieces.push({
                    id: i,
                    left: Math.random() * 100,
                    delay: Math.random() * 0.5,
                    duration: 2 + Math.random() * 2,
                    color: colors[Math.floor(Math.random() * colors.length)],
                });
            }
            setConfetti(pieces);
        }
    }, [showCelebration]);

    const handleContinue = () => {
        setShowCelebration(false);
        navigate("/pipeline");
    };

    return (
        <Dialog open={showCelebration} onOpenChange={setShowCelebration}>
            <DialogContent
                className="sm:max-w-md overflow-hidden"
                data-testid="onboarding-celebration-modal"
            >
                {/* Confetti animation */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {confetti.map((piece) => (
                        <div
                            key={piece.id}
                            className="absolute w-2 h-2 rounded-full animate-confetti-fall"
                            style={{
                                left: `${piece.left}%`,
                                backgroundColor: piece.color,
                                animationDelay: `${piece.delay}s`,
                                animationDuration: `${piece.duration}s`,
                            }}
                        />
                    ))}
                </div>

                {/* Success gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-success/10 via-transparent to-primary/10 pointer-events-none" />

                <DialogHeader className="relative space-y-4 pt-6 text-center">
                    {/* Animated checkmark */}
                    <div className="relative mx-auto">
                        <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center animate-pulse-slow">
                            <CheckCircle2 className="w-12 h-12 text-success animate-scale-in" />
                        </div>
                        <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-warning animate-spin-slow" />
                    </div>

                    <DialogTitle className="text-3xl font-bold tracking-tight">
                        Done. ✅
                    </DialogTitle>

                    <DialogDescription className="text-base text-foreground/80 max-w-xs mx-auto">
                        {celebrationMessage || (
                            <>
                                In <span className="font-semibold text-primary">90 seconds</span>, you just sourced data,
                                ran an AI underwrite, and logged a compliance check.
                                <span className="block mt-2 font-medium">The work that used to take an hour is now a click.</span>
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="relative space-y-4 py-6">
                    <p className="text-center text-muted-foreground text-sm">
                        Ready to import your real pipeline and see what else you can automate?
                    </p>

                    <Button
                        size="lg"
                        className="w-full gap-2"
                        onClick={handleContinue}
                        data-testid="onboarding-celebration-continue"
                    >
                        Let's Do It
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
