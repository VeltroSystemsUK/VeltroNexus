import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
        <div className="min-h-screen grid lg:grid-cols-2">

            {/* Left Column — Login Form */}
            <div className="flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-md space-y-8">

                    <div className="flex justify-center mb-8">
                        <img src={logoChrome} alt="Veltro" className="h-12 w-auto" />
                    </div>

                    <Card className="border shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Lock className="h-4 w-4 text-muted-foreground" />
                                <CardTitle className="text-lg">Internal Access</CardTitle>
                            </div>
                            <CardDescription>
                                Authorised personnel only. Contact your administrator if you need access.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
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
                                        className="w-full mt-2"
                                        disabled={loginMutation.isPending}
                                    >
                                        {loginMutation.isPending ? "Signing in..." : "Sign In"}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>

                    <p className="text-center text-xs text-muted-foreground">
                        Veltro &mdash; Internal Delivery System
                    </p>
                </div>
            </div>

            {/* Right Column — Branding Panel */}
            <div className="hidden lg:flex flex-col justify-center p-12 bg-[#0f172a] text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-indigo-900/50" />

                {/* Background decorative elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-20 left-[10%] w-72 h-72 bg-[#D97706]/15 rounded-full blur-3xl" />
                    <div className="absolute top-40 right-[15%] w-96 h-96 bg-indigo-500/8 rounded-full blur-3xl" />
                    <div className="absolute bottom-20 left-[20%] w-64 h-64 bg-[#D97706]/10 rounded-full blur-3xl" />
                    <div className="absolute inset-0 opacity-[0.03]" style={{
                        backgroundImage: `linear-gradient(#D97706 1px, transparent 1px), linear-gradient(90deg, #D97706 1px, transparent 1px)`,
                        backgroundSize: '60px 60px',
                    }} />
                    <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-[#D97706] rounded-full opacity-40" />
                    <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-white rounded-full opacity-30" />
                    <div className="absolute top-2/3 left-1/3 w-1 h-1 bg-[#D97706] rounded-full opacity-40" />
                    <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-indigo-400 rounded-full opacity-20" />
                </div>

                <div className="relative z-10 max-w-lg mx-auto text-center space-y-6">
                    <img
                        src={logoChrome}
                        alt="Veltro"
                        className="h-32 w-auto object-contain mx-auto mb-8 drop-shadow-[0_0_20px_rgba(217,119,6,0.3)]"
                    />
                    <h1 className="text-5xl font-bold tracking-tight italic">
                        VELTRO
                    </h1>
                    <h2 className="text-xl font-semibold tracking-wide text-[#D97706]">
                        Built for Speed. Bred for Business.
                    </h2>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
                        Internal commercial lending delivery platform. Powering the full lifecycle from lead discovery to funded deal.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-slate-500 text-xs pt-4">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Restricted access &mdash; authorised users only</span>
                    </div>
                </div>
            </div>

        </div>
    );
}
