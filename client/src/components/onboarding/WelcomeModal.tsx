import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useOnboarding, WalkthroughPath } from "./OnboardingProvider";
import { Flame, BarChart3, Compass, Settings, ChevronRight, Zap } from "lucide-react";
import logoChrome from "@assets/logo-chrome.png";

interface WelcomeModalProps {
    userName?: string;
}

const paths: {
    id: WalkthroughPath;
    label: string;
    description: string;
    icon: React.ElementType;
    accent: string;
    iconBg: string;
    testId: string;
}[] = [
    {
        id: "lead",
        label: "Process my first lead",
        description: "See the AI underwriter in action",
        icon: Flame,
        accent: "group-hover:text-orange-500",
        iconBg: "bg-orange-500/10 text-orange-500",
        testId: "onboarding-path-lead",
    },
    {
        id: "pipeline",
        label: "Set up my deal pipeline",
        description: "Organise your workflow your way",
        icon: BarChart3,
        accent: "group-hover:text-blue-500",
        iconBg: "bg-blue-500/10 text-blue-500",
        testId: "onboarding-path-pipeline",
    },
    {
        id: "settings",
        label: "Configure preferences",
        description: "Tailor the platform to your workflow",
        icon: Settings,
        accent: "group-hover:text-violet-500",
        iconBg: "bg-violet-500/10 text-violet-500",
        testId: "onboarding-path-settings",
    },
    {
        id: "explore",
        label: "I'll explore on my own",
        description: "Jump straight in at your own pace",
        icon: Compass,
        accent: "group-hover:text-slate-400",
        iconBg: "bg-slate-500/10 text-slate-400",
        testId: "onboarding-path-explore",
    },
];

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
                className="p-0 overflow-hidden border border-white/[0.06] shadow-2xl sm:max-w-[480px] bg-[#0c0e16] [&>button]:text-white/40 [&>button]:hover:text-white"
                data-testid="onboarding-welcome-modal"
            >
                {/* Accessibility: required by Radix Dialog, visually hidden */}
                <DialogTitle className="sr-only">Welcome to Veltro — Getting Started</DialogTitle>
                <DialogDescription className="sr-only">Choose how you'd like to get started with Veltro.</DialogDescription>

                {/* ── Header ── */}
                <div className="relative overflow-hidden px-8 pt-10 pb-9">
                    {/* Ambient glow */}
                    <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />

                    {/* Logo */}
                    <div className="relative flex justify-center mb-8">
                        <img
                            src={logoChrome}
                            alt="Veltro"
                            className="h-7 opacity-90"
                        />
                    </div>

                    {/* Greeting */}
                    <div className="relative text-center space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.08] text-[11px] font-medium text-white/50 tracking-widest uppercase mb-3">
                            <Zap className="h-3 w-3 text-primary" />
                            Getting Started
                        </div>
                        <h2 className="text-[26px] font-semibold text-white tracking-tight leading-snug">
                            Welcome{userName !== "there" ? `, ${userName}` : ""}.
                        </h2>
                        <p className="text-sm text-white/45 leading-relaxed max-w-xs mx-auto">
                            What's your top priority right now? We'll tailor your first few minutes.
                        </p>
                    </div>
                </div>

                {/* ── Divider ── */}
                <div className="h-px bg-white/[0.06] mx-0" />

                {/* ── Options ── */}
                <div className="px-5 py-5 space-y-1.5">
                    {paths.map(({ id, label, description, icon: Icon, accent, iconBg, testId }) => (
                        <button
                            key={id}
                            type="button"
                            className="group w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-150 text-left"
                            onClick={() => handlePathSelect(id)}
                            data-testid={testId}
                        >
                            <div className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${iconBg}`}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`text-[13.5px] font-medium text-white/80 group-hover:text-white transition-colors ${accent}`}>
                                    {label}
                                </div>
                                <div className="text-[12px] text-white/35 mt-0.5 leading-snug">
                                    {description}
                                </div>
                            </div>
                            <ChevronRight className={`h-4 w-4 text-white/20 transition-all group-hover:translate-x-0.5 ${accent}`} />
                        </button>
                    ))}
                </div>

                {/* ── Footer ── */}
                <div className="px-8 pb-6 pt-1 text-center">
                    <p className="text-[11px] text-white/25">
                        You can restart this guide anytime from Settings
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
