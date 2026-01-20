
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
            queryClient.setQueryData(["/api/auth/user"], user);
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
            queryClient.setQueryData(["/api/auth/user"], user);
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
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* Left Column - Form */}
            <div className="flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-md space-y-8">
                    <div className="flex justify-center mb-8">
                        <img src={logoChrome} alt="Veltro Logo" className="h-12 w-auto" />
                    </div>

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
                                                            <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                                                            <span>Subscription <strong className="text-foreground">auto-renews</strong></span>
                                                        </li>
                                                        <li className="flex items-start gap-2">
                                                            <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                                                            <span>You <strong className="text-foreground">own your data</strong> (UK GDPR)</span>
                                                        </li>
                                                        <li className="flex items-start gap-2">
                                                            <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
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
                    <div className="text-center text-sm text-muted-foreground mt-8">
                        <Link href="/privacy" className="hover:text-primary transition-colors underline underline-offset-4">
                            Privacy Policy
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right Column - Image/Gradient */}
            <div className="hidden lg:flex flex-col justify-center p-12 bg-[#0f172a] text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-indigo-900/50" />

                {/* Animated Background Elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {/* Floating orbs */}
                    <div className="absolute top-20 left-[10%] w-72 h-72 bg-[#D97706]/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
                    <div className="absolute top-40 right-[15%] w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite_1s]" />
                    <div className="absolute bottom-20 left-[20%] w-64 h-64 bg-[#D97706]/15 rounded-full blur-3xl animate-[pulse_5s_ease-in-out_infinite_2s]" />

                    {/* Moving grid lines */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{
                        backgroundImage: `linear-gradient(#D97706 1px, transparent 1px), linear-gradient(90deg, #D97706 1px, transparent 1px)`,
                        backgroundSize: '60px 60px',
                    }} />

                    {/* Floating particles */}
                    <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-[#D97706] rounded-full opacity-60 animate-[pulse_8s_ease-in-out_infinite]" />
                    <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-white rounded-full opacity-40 animate-[pulse_6s_ease-in-out_infinite_1s]" />
                    <div className="absolute top-2/3 left-1/3 w-1 h-1 bg-[#D97706] rounded-full opacity-50 animate-[pulse_10s_ease-in-out_infinite_2s]" />
                    <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-indigo-400 rounded-full opacity-30 animate-[pulse_7s_ease-in-out_infinite_3s]" />
                </div>

                <div className="relative z-10 max-w-lg mx-auto text-center space-y-6">
                    {/* Animated Logo */}
                    <img
                        src={logoChrome}
                        alt="Veltro"
                        className="h-32 w-auto object-contain mx-auto mb-8 animate-[pulse_3s_ease-in-out_infinite]"
                        style={{
                            filter: "drop-shadow(0 0 20px rgba(217, 119, 6, 0.3))"
                        }}
                    />

                    <h1 className="text-5xl font-bold tracking-tight">
                        STREAMLINE
                    </h1>
                    <h2 className="text-3xl font-bold tracking-tight text-[#D97706]">
                        Your Lending Pipeline
                    </h2>
                    <p className="text-lg text-slate-300">
                        Veltro will REVOLUTIONISE your workflow. From finding new prospects, assessing credit viability, managing your pipeline through to submitting applications and everything else in between!
                    </p>
                </div>
            </div>
        </div>
    );
}

