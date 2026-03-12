import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Types
export interface OnboardingProgress {
    completed: string[];
    currentStep: string | null;
    startedAt: string | null;
    completedAt: string | null;
}

export interface OnboardingState {
    enabled: boolean;
    progress: OnboardingProgress;
    isLoading: boolean;
}

export type WalkthroughPath = "lead" | "pipeline" | "explore" | "settings";

// Checklist steps with their IDs
export const ONBOARDING_CHECKLIST = [
    { id: "first_underwrite", label: "Run your first AI Underwrite", icon: "🔬" },
    { id: "first_lead", label: "Import your first real lead", icon: "📥" },
    { id: "custom_pipeline", label: "Create a custom pipeline stage", icon: "📊" },
    { id: "first_task", label: "Assign a task to yourself", icon: "✅" },
    { id: "invite_team", label: "Invite a team member", icon: "👥" },
] as const;

export type ChecklistStepId = typeof ONBOARDING_CHECKLIST[number]["id"];

interface OnboardingContextValue extends OnboardingState {
    // Modal controls
    showWelcome: boolean;
    showCelebration: boolean;
    celebrationMessage: string;
    setShowWelcome: (show: boolean) => void;
    setShowCelebration: (show: boolean) => void;

    // Walkthrough state
    currentWalkthrough: WalkthroughPath | null;
    walkthroughStep: number;

    // Actions
    startWalkthrough: (path: WalkthroughPath) => void;
    nextWalkthroughStep: () => void;
    skipWalkthrough: () => void;
    completeStep: (stepId: string) => void;
    toggleOnboarding: (enabled: boolean) => void;
    resetOnboarding: () => void;
    triggerCelebration: (message: string) => void;

    // Computed values
    completedStepsCount: number;
    totalStepsCount: number;
    progressPercentage: number;
    isFirstTimeUser: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error("useOnboarding must be used within an OnboardingProvider");
    }
    return context;
}

// Safe hook that returns null if not in provider
export function useOnboardingSafe() {
    return useContext(OnboardingContext);
}

interface OnboardingProviderProps {
    children: ReactNode;
    userName?: string;
}

export function OnboardingProvider({ children, userName }: OnboardingProviderProps) {
    // Local UI state
    const [showWelcome, setShowWelcome] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationMessage, setCelebrationMessage] = useState("");
    const [currentWalkthrough, setCurrentWalkthrough] = useState<WalkthroughPath | null>(null);
    const [walkthroughStep, setWalkthroughStep] = useState(0);

    // Safety latch to prevent modal springing back up during query refetches
    const [hasDismissedWelcome, setHasDismissedWelcome] = useState(false);

    // Fetch onboarding state from API
    const { data: onboardingData, isLoading } = useQuery<{
        enabled: boolean;
        progress: OnboardingProgress;
    }>({
        queryKey: ["/api/user/onboarding"],
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const enabled = onboardingData?.enabled ?? false;
    const progress = onboardingData?.progress ?? {
        completed: [],
        currentStep: null,
        startedAt: null,
        completedAt: null,
    };

    // Check if first time user (no progress and onboarding enabled)
    const isFirstTimeUser = enabled && progress.completed.length === 0 && !progress.startedAt;

    // Show welcome modal for first time users
    useEffect(() => {
        // Only show if:
        // 1. Not loading
        // 2. Is first time user (server says so)
        // 3. Enabled
        // 4. We haven't dismissed it locally in this session (prevents flashing)
        if (!isLoading && isFirstTimeUser && enabled && !hasDismissedWelcome) {
            // Small delay for smoother UX
            const timer = setTimeout(() => {
                setShowWelcome(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, isFirstTimeUser, enabled, hasDismissedWelcome]);


    // Update onboarding mutation
    const updateMutation = useMutation({
        mutationFn: async (data: { enabled?: boolean; progress?: Partial<OnboardingProgress> }) => {
            await apiRequest("/api/user/onboarding", "PATCH", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/user/onboarding"] });
            queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        },
    });

    // Complete step mutation
    const completeStepMutation = useMutation({
        mutationFn: async (stepId: string) => {
            await apiRequest("/api/user/onboarding/complete-step", "POST", { stepId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/user/onboarding"] });
        },
    });

    // Reset onboarding mutation
    const resetMutation = useMutation({
        mutationFn: async () => {
            await apiRequest("/api/user/onboarding/reset", "POST");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/user/onboarding"] });
        },
    });

    // Actions
    // Actions
    const startWalkthrough = useCallback((path: WalkthroughPath) => {
        setHasDismissedWelcome(true);
        setShowWelcome(false);
        setCurrentWalkthrough(path);
        setWalkthroughStep(0);

        // Mark onboarding as started
        if (!progress.startedAt) {
            updateMutation.mutate({
                progress: {
                    startedAt: new Date().toISOString(),
                    currentStep: `${path}_0`,
                },
            });
        }
    }, [progress.startedAt, updateMutation]);

    const nextWalkthroughStep = useCallback(() => {
        setWalkthroughStep((prev) => prev + 1);
    }, []);

    const skipWalkthrough = useCallback(() => {
        setHasDismissedWelcome(true);
        setShowWelcome(false);
        setCurrentWalkthrough(null);
        setWalkthroughStep(0);
    }, []);

    const completeStep = useCallback((stepId: string) => {
        if (!progress.completed.includes(stepId)) {
            completeStepMutation.mutate(stepId);
        }
    }, [progress.completed, completeStepMutation]);

    const toggleOnboarding = useCallback((newEnabled: boolean) => {
        updateMutation.mutate({ enabled: newEnabled });
    }, [updateMutation]);

    const resetOnboarding = useCallback(() => {
        setHasDismissedWelcome(false);
        resetMutation.mutate();
        setShowWelcome(true);
        setCurrentWalkthrough(null);
        setWalkthroughStep(0);
    }, [resetMutation]);

    const triggerCelebration = useCallback((message: string) => {
        setCelebrationMessage(message);
        setShowCelebration(true);
    }, []);

    // Computed values
    const completedStepsCount = progress.completed.length;
    const totalStepsCount = ONBOARDING_CHECKLIST.length;
    const progressPercentage = Math.round((completedStepsCount / totalStepsCount) * 100);

    const value: OnboardingContextValue = {
        enabled,
        progress,
        isLoading,
        showWelcome,
        showCelebration,
        celebrationMessage,
        setShowWelcome,
        setShowCelebration,
        currentWalkthrough,
        walkthroughStep,
        startWalkthrough,
        nextWalkthroughStep,
        skipWalkthrough,
        completeStep,
        toggleOnboarding,
        resetOnboarding,
        triggerCelebration,
        completedStepsCount,
        totalStepsCount,
        progressPercentage,
        isFirstTimeUser,
    };

    return (
        <OnboardingContext.Provider value={value}>
            {children}
        </OnboardingContext.Provider>
    );
}
