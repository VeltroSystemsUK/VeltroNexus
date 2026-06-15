
import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertUserSchema } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Brain, Sparkles, AlertTriangle, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logoChrome from "@assets/logo-chrome.png";

// Schema for Login/Register (we'll reuse insertUserSchema for register)
// insertUserSchema uses 'email' as the field name, but for login we typically say 'username' or 'email'
// Our backend (server/auth.ts) uses 'username' and 'password' in LocalStrategy.

const loginSchema = z.object({
    username: z.string().min(1, "Username/Email is required"),
    password: z.string().min(1, "Password is required"),
});

const registerSchema = insertUserSchema.extend({
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export default function AuthPage() {
    const [, setLocation] = useLocation();
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Get plan and interval from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const selectedPlan = urlParams.get("plan") as "broker" | "team" | null;
    const selectedInterval = (urlParams.get("interval") as "monthly" | "annual") || "monthly";

    const handleStripeCheckout = async () => {
        if (!selectedPlan) {
            setLocation("/pipeline");
            return;
        }

        try {
            // Create checkout session
            const res = await apiRequest("/api/stripe/create-checkout-session", "POST", {
                plan: selectedPlan,
                interval: selectedInterval,
            });
            const { url } = await res.json();
            if (url) {
                window.location.href = url;
            } else {
                throw new Error("Failed to create checkout session");
            }
        } catch (error: any) {
            console.error("Stripe checkout error:", error);
            toast({
                title: "Checkout failed",
                description: "Could not initiate payment. Please try again later.",
                variant: "destructive",
            });
            // Fallback to dashboard
            setLocation("/pipeline");
        }
    };

    // Redirect if already logged in and no plan selected
    useEffect(() => {
        if (user && !selectedPlan) {
            setLocation("/pipeline");
        }
    }, [user, setLocation, selectedPlan]);

    const loginForm = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

    const registerForm = useForm<z.infer<typeof registerSchema>>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            email: "",
            password: "",
            confirmPassword: "",
            firstName: "",
            lastName: "",
        },
    });

    // Terms State
    const [termsState, setTermsState] = useState({
        terms: false,
        binding: false,
        authority: false,
        dpa: false
    });
    const [shakeCheckbox, setShakeCheckbox] = useState<string | null>(null);

    const toggleTermsCheckbox = (key: keyof typeof termsState) => {
        setTermsState(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const loginMutation = useMutation({
        mutationFn: async (data: z.infer<typeof loginSchema>) => {
            const res = await apiRequest("/api/login", "POST", data);
            return res.json();
        },
        onSuccess: (user) => {
            queryClient.setQueryData(["/api/auth/session"], {
                user,
                role: user.role || "broker",
                isAuthenticated: true,
            });
            toast({ title: "Welcome back!" });

            if (selectedPlan) {
                handleStripeCheckout();
            } else {
                setLocation("/pipeline");
            }
        },
        onError: (error: Error) => {
            toast({
                title: "Login failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const registerMutation = useMutation({
        mutationFn: async (data: z.infer<typeof registerSchema>) => {
            const { confirmPassword, ...registerData } = data;
            // Pass selected plan to backend
            const res = await apiRequest("/api/register", "POST", {
                ...registerData,
                trialTier: selectedPlan || undefined,
                wantsUnderwritingAccess: false,
            });
            return res.json();
        },
        onSuccess: (user) => {
            queryClient.setQueryData(["/api/auth/session"], {
                user,
                role: user.role || "broker",
                isAuthenticated: true,
            });
            const planName = selectedPlan === "team" ? "Team" : selectedPlan === "broker" ? "Broker" : null;
            toast({
                title: "Account created",
                description: planName
                    ? `Welcome to Veltro! Proceeding to checkout for ${planName} plan.`
                    : "Welcome to Veltro!"
            });

            if (selectedPlan) {
                handleStripeCheckout();
            } else {
                setLocation("/pipeline");
            }
        },
        onError: (error: Error) => {
            toast({
                title: "Registration failed",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    return (
        <div className="dark min-h-screen grid lg:grid-cols-2 bg-[#0A0B0D] text-foreground relative overflow-hidden grain">
            {/* Ambient aurora behind everything */}
            <div className="aurora-field">
                <div className="aurora-blob b1" />
                <div className="aurora-blob b2" />
                <div className="aurora-blob b3" />
            </div>

            {/* Left Column - Form */}
            <div className="relative z-10 flex items-center justify-center p-6 sm:p-8">
                <div className="w-full max-w-md">
                    <div className="flex justify-center mb-7">
                        <img src={logoChrome} alt="Veltro" className="h-11 w-auto" />
                    </div>

                    <div className="glass p-6 sm:p-8">
                    <Tabs defaultValue="login" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-8">
                            <TabsTrigger value="login">Login</TabsTrigger>
                            <TabsTrigger value="register">Register</TabsTrigger>
                        </TabsList>

                        <TabsContent value="login">
                            <Card className="border-0 shadow-none">
                                <CardHeader className="px-0 pt-0">
                                    <CardTitle>Welcome back</CardTitle>
                                    <CardDescription>
                                        Enter your credentials to access your account
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-0">
                                    <Form {...loginForm}>
                                        <form
                                            onSubmit={loginForm.handleSubmit((data) =>
                                                loginMutation.mutate(data)
                                            )}
                                            className="space-y-4"
                                        >
                                            <FormField
                                                control={loginForm.control}
                                                name="username"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Email</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="Enter your email"
                                                                autoComplete="username"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={loginForm.control}
                                                name="password"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Password</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="password"
                                                                placeholder="Enter your password"
                                                                autoComplete="current-password"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <Button
                                                type="submit"
                                                className="w-full"
                                                disabled={loginMutation.isPending}
                                            >
                                                {loginMutation.isPending ? "Logging in..." : "Login"}
                                            </Button>
                                        </form>
                                    </Form>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="register">
                            <Card className="border-0 shadow-none">
                                <CardHeader className="px-0 pt-0">
                                    <CardTitle>Create an account</CardTitle>
                                    <CardDescription>
                                        Get started with Veltro today
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-0">
                                    <Form {...registerForm}>
                                        <form
                                            onSubmit={registerForm.handleSubmit((data) => {
                                                // Validate Terms
                                                const unchecked = Object.entries(termsState).find(([_, checked]) => !checked);
                                                if (unchecked) {
                                                    setShakeCheckbox(unchecked[0]);
                                                    setTimeout(() => setShakeCheckbox(null), 400);
                                                    return;
                                                }
                                                registerMutation.mutate(data);
                                            })}
                                            className="space-y-4"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField
                                                    control={registerForm.control}
                                                    name="firstName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>First Name</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="John"
                                                                    autoComplete="given-name"
                                                                    {...field}
                                                                    value={field.value || ''}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={registerForm.control}
                                                    name="lastName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Last Name</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="Doe"
                                                                    autoComplete="family-name"
                                                                    {...field}
                                                                    value={field.value || ''}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={registerForm.control}
                                                name="email"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Email</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="email"
                                                                placeholder="john@example.com"
                                                                autoComplete="username"
                                                                {...field}
                                                                value={field.value || ''}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={registerForm.control}
                                                name="password"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Password</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="password"
                                                                placeholder="Create a password"
                                                                autoComplete="new-password"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={registerForm.control}
                                                name="confirmPassword"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Confirm Password</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="password"
                                                                placeholder="Confirm your password"
                                                                autoComplete="new-password"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Terms & Conditions Section */}
                                            <div className="space-y-4 pt-2">
                                                <div className="text-center pb-2 border-b border-border">
                                                    <h3 className="text-sm font-bold mb-1">Terms & Conditions</h3>
                                                    <p className="text-xs text-muted-foreground">Please review and accept to continue</p>
                                                </div>

                                                <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-3 rounded-r-lg">
                                                    <div className="flex items-start gap-2">
                                                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                                        <p className="text-xs text-amber-800 dark:text-amber-200">
                                                            <strong>IMPORTANT:</strong> Legally binding agreement.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="max-h-32 overflow-y-auto bg-muted/30 rounded-lg p-3 border border-border text-xs space-y-2">
                                                    <h4 className="font-semibold text-foreground">Key Terms Summary:</h4>
                                                    <ul className="space-y-1.5 text-muted-foreground">
                                                        <li className="flex items-start gap-2">
                                                            <Check className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                                                            <span>Subscription <strong className="text-foreground">auto-renews</strong></span>
                                                        </li>
                                                        <li className="flex items-start gap-2">
                                                            <Check className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                                                            <span>You <strong className="text-foreground">own your data</strong> (UK GDPR)</span>
                                                        </li>
                                                        <li className="flex items-start gap-2">
                                                            <Check className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                                                            <span><strong className="text-foreground">Cancel anytime</strong></span>
                                                        </li>
                                                    </ul>
                                                    <a
                                                        href="/terms"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                                                    >
                                                        View full Terms <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </div>

                                                <div className="space-y-2">
                                                    {[
                                                        { id: 'terms', label: <span>I agree to the <a href="/terms" target="_blank" className="text-primary hover:underline">Terms & Conditions</a></span> },
                                                        { id: 'binding', label: <span>I acknowledge this is a <strong>legally binding agreement</strong></span> },
                                                        { id: 'authority', label: <span>I have <strong>authority to bind</strong> my entity to these Terms</span> },
                                                        { id: 'dpa', label: <span>I agree to the <a href="https://veltro.co.uk/dpa" target="_blank" className="text-primary hover:underline">DPA</a></span> }
                                                    ].map((item) => (
                                                        <div
                                                            key={item.id}
                                                            onClick={() => toggleTermsCheckbox(item.id as any)}
                                                            className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all
                                                                ${termsState[item.id as keyof typeof termsState] ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                                                                ${shakeCheckbox === item.id ? 'animate-[shake_0.3s] border-destructive' : ''}`}
                                                        >
                                                            <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all
                                                                ${termsState[item.id as keyof typeof termsState] ? 'bg-primary border-primary' : 'border-muted-foreground/50 bg-white'}`}>
                                                                {termsState[item.id as keyof typeof termsState] && <Check className="w-3 h-3 text-white" />}
                                                            </div>
                                                            <div className="text-xs leading-snug">{item.label}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <style>{`
                                                @keyframes shake {
                                                    0%, 100% { transform: translateX(0); }
                                                    25% { transform: translateX(-4px); }
                                                    75% { transform: translateX(4px); }
                                                }
                                            `}</style>

                                            <Button
                                                type="submit"
                                                className="w-full"
                                                disabled={registerMutation.isPending}
                                            >
                                                {registerMutation.isPending
                                                    ? "Creating account..."
                                                    : "Create Account"}
                                            </Button>
                                        </form>
                                    </Form>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                    </div>
                    <div className="text-center text-sm text-muted-foreground mt-7">
                        <Link href="/privacy" className="hover:text-primary transition-colors underline underline-offset-4">
                            Privacy Policy
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right Column - Brand showcase */}
            <div className="hidden lg:flex relative z-10 flex-col justify-center p-12 overflow-hidden border-l border-white/5">
                <div className="absolute inset-0 mesh-grid opacity-70 pointer-events-none" />

                <div className="relative z-10 max-w-lg mx-auto">
                    <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full glass-subtle text-[11px] font-medium tracking-wide text-muted-foreground">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                        </span>
                        Live underwriting desk
                    </div>

                    <h1 className="text-6xl font-semibold tracking-tight leading-[0.95] chrome-text">
                        Veltro
                    </h1>
                    <p className="mt-5 text-2xl font-light text-foreground/90 leading-snug">
                        The lending desk,<br />reimagined.
                    </p>
                    <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground max-w-md">
                        From Companies House signal to funded deal — prospecting, credit, pipeline and submission, in one quiet, fast surface.
                    </p>

                    <div className="mt-10 space-y-3">
                        {[
                            { k: "Speed", v: "Instant Companies House intelligence" },
                            { k: "Pedigree", v: "Underwriting-grade credit analysis" },
                            { k: "Payout", v: "Pipeline to submission, end to end" },
                        ].map((f) => (
                            <div key={f.k} className="flex items-center gap-3 glass-subtle rounded-xl px-4 py-3">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 shadow-[0_0_10px_2px_hsl(var(--primary)/0.5)]" />
                                <span className="text-sm font-medium text-foreground w-24 shrink-0">{f.k}</span>
                                <span className="text-[13px] text-muted-foreground">{f.v}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

