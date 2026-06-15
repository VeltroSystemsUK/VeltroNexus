import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
import { Lock, ShieldCheck } from "lucide-react";
import logoChrome from "@assets/logo-chrome.png";

const loginSchema = z.object({
    username: z.string().min(1, "Email is required"),
    password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
    const [, setLocation] = useLocation();
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            setLocation("/pipeline");
        }
    }, [user, setLocation]);

    const loginForm = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    });

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
            toast({ title: "Welcome back." });
            setLocation("/pipeline");
        },
        onError: (error: Error) => {
            toast({
                title: "Access denied",
                description: error.message || "Invalid credentials. Please try again.",
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

            {/* Left Column — Login */}
            <div className="relative z-10 flex items-center justify-center p-6 sm:p-8">
                <div className="w-full max-w-md">
                    <div className="flex justify-center mb-7">
                        <img src={logoChrome} alt="Veltro" className="h-11 w-auto" />
                    </div>

                    <div className="glass p-6 sm:p-8">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Lock className="h-4 w-4 text-primary" />
                            <h2 className="text-lg font-semibold tracking-tight">Internal access</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">
                            Authorised personnel only. Contact your administrator if you need access.
                        </p>

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
                                                    placeholder="you@veltro.co.uk"
                                                    autoComplete="username"
                                                    autoFocus
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
                                    className="w-full mt-2 accent-glow"
                                    disabled={loginMutation.isPending}
                                >
                                    {loginMutation.isPending ? "Signing in..." : "Sign in"}
                                </Button>
                            </form>
                        </Form>
                    </div>

                    <p className="text-center text-xs text-muted-foreground mt-7">
                        Veltro &mdash; internal delivery system
                    </p>
                </div>
            </div>

            {/* Right Column — Brand showcase */}
            <div className="hidden lg:flex relative z-10 flex-col justify-center p-12 overflow-hidden border-l border-white/5">
                <div className="absolute inset-0 mesh-grid opacity-70 pointer-events-none" />

                <div className="relative z-10 max-w-lg mx-auto">
                    <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full glass-subtle text-[11px] font-medium tracking-wide text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        Restricted &mdash; authorised users only
                    </div>

                    <h1 className="text-6xl font-semibold tracking-tight leading-[0.95] chrome-text">
                        Veltro
                    </h1>
                    <p className="mt-5 text-2xl font-light text-foreground/90 leading-snug">
                        Built for speed.<br />Bred for business.
                    </p>
                    <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground max-w-md">
                        The internal commercial-lending delivery platform &mdash; the full lifecycle from lead discovery to funded deal, in one quiet, fast surface.
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
