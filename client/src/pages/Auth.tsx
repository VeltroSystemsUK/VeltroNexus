
import { useEffect } from "react";
import { useLocation } from "wouter";
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

    const loginMutation = useMutation({
        mutationFn: async (data: z.infer<typeof loginSchema>) => {
            const res = await apiRequest("POST", "/api/login", data);
            return res.json();
        },
        onSuccess: (user) => {
            queryClient.setQueryData(["/api/auth/user"], user);
            setLocation("/pipeline");
            toast({ title: "Welcome back!" });
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
            const res = await apiRequest("POST", "/api/register", registerData);
            return res.json();
        },
        onSuccess: (user) => {
            queryClient.setQueryData(["/api/auth/user"], user);
            setLocation("/pipeline");
            toast({ title: "Account created", description: "Welcome to Veltro!" });
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
                                                            <Input placeholder="Enter your email" {...field} />
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
                                            onSubmit={registerForm.handleSubmit((data) =>
                                                registerMutation.mutate(data)
                                            )}
                                            className="space-y-4"
                                        >
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={registerForm.control}
                                                    name="firstName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>First Name</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="John" {...field} value={field.value || ''} />
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
                                                                <Input placeholder="Doe" {...field} value={field.value || ''} />
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
            </div>

            {/* Right Column - Image/Gradient */}
            <div className="hidden lg:flex flex-col justify-center p-12 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900/50" />
                <div className="relative z-10 max-w-lg mx-auto text-center space-y-6">
                    <h1 className="text-4xl font-bold tracking-tight">
                        Streamline Your Commercial Lending Pipeline
                    </h1>
                    <p className="text-lg text-slate-300">
                        Join thousands of brokers using Veltro to manage prospects, find
                        lenders, and close deals faster.
                    </p>
                </div>
            </div>
        </div>
    );
}
