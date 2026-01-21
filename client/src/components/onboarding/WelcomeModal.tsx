import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useOnboarding, WalkthroughPath } from "./OnboardingProvider";
import { Flame, BarChart3, Compass, Settings } from "lucide-react";

interface WelcomeModalProps {
    userName?: string;
}

export function WelcomeModal({ userName = "there" }: WelcomeModalProps) {
    const [, navigate] = useLocation();
    const { showWelcome, setShowWelcome, startWalkthrough, skipWalkthrough } = useOnboarding();

    const handlePathSelect = (path: WalkthroughPath) => {
        if (path === "explore") {
            skipWalkthrough();
        } else if (path === "settings") {
            startWalkthrough(path);
            navigate("/settings");
        } else {
            startWalkthrough(path);
        }
    };

    return (
        <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
            <DialogContent
                className="sm:max-w-md overflow-hidden"
                data-testid="onboarding-welcome-modal"
            >
                {/* Decorative gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />

                <DialogHeader className="relative space-y-4 pt-4">
                    <div className="text-4xl animate-bounce">👋</div>
                    <DialogTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
                        Hey {userName}! Welcome to <span className="italic text-primary">VELTRO</span>.
                    </DialogTitle>
                    <DialogDescription className="text-base text-foreground/80">
                        Let's eliminate your admin headaches. What's your top priority right now?
                    </DialogDescription>
                </DialogHeader>

                <div className="relative space-y-3 py-6">
                    {/* Option 1: Process Lead */}
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-4 h-auto p-4 text-left hover:bg-primary/5 hover:border-primary/30 transition-all group"
                        onClick={() => handlePathSelect("lead")}
                        data-testid="onboarding-path-lead"
                    >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                            <Flame className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-foreground">Process my first lead, fast</div>
                            <div className="text-sm text-muted-foreground">See the AI underwriter in action</div>
                        </div>
                    </Button>

                    {/* Option 2: Pipeline Setup */}
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-4 h-auto p-4 text-left hover:bg-primary/5 hover:border-primary/30 transition-all group"
                        onClick={() => handlePathSelect("pipeline")}
                        data-testid="onboarding-path-pipeline"
                    >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-foreground">Set up my deal pipeline</div>
                            <div className="text-sm text-muted-foreground">Organize your workflow your way</div>
                        </div>
                    </Button>

                    {/* Option 3: Preferences */}
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-4 h-auto p-4 text-left hover:bg-primary/5 hover:border-primary/30 transition-all group"
                        onClick={() => handlePathSelect("settings")}
                        data-testid="onboarding-path-settings"
                    >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                            <Settings className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-foreground">Set up your preferences</div>
                            <div className="text-sm text-muted-foreground">Configure the site to look the way you want</div>
                        </div>
                    </Button>

                    {/* Option 4: Explore */}
                    <Button
                        variant="outline"
                        className="w-full justify-start gap-4 h-auto p-4 text-left hover:bg-muted/50 transition-all group"
                        onClick={() => handlePathSelect("explore")}
                        data-testid="onboarding-path-explore"
                    >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 group-hover:scale-110 transition-transform">
                            <Compass className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-foreground">I'd just like to explore</div>
                            <div className="text-sm text-muted-foreground">Jump right in at your own pace</div>
                        </div>
                    </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground pb-2">
                    You can always restart this guide from Settings
                </p>
            </DialogContent>
        </Dialog>
    );
}
