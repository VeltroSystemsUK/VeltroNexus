import { Lock, Sparkles, Brain, FileCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

interface UnderwritingPaywallProps {
    variant?: "full" | "compact";
    onClose?: () => void;
}

export function UnderwritingPaywall({ variant = "full", onClose }: UnderwritingPaywallProps) {
    const [, setLocation] = useLocation();

    const features = [
        {
            icon: Brain,
            title: "AI Credit Analysis",
            description: "Automated financial analysis with AI-powered insights",
        },
        {
            icon: FileCheck,
            title: "Smart Due Diligence",
            description: "Comprehensive company research and risk assessment",
        },
        {
            icon: TrendingUp,
            title: "Lender Matching",
            description: "Intelligent recommendations based on deal criteria",
        },
        {
            icon: Sparkles,
            title: "Automated Reports",
            description: "Professional credit reports generated in seconds",
        },
    ];

    if (variant === "compact") {
        return (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Lock className="h-5 w-5 text-primary" />
                        <Badge variant="secondary" className="bg-primary/20">Premium Feature</Badge>
                    </div>
                    <CardTitle className="text-xl">AI Credit Underwriting</CardTitle>
                    <CardDescription>
                        Unlock powerful AI tools to streamline your credit analysis workflow
                    </CardDescription>
                </CardHeader>
                <CardFooter className="pt-0">
                    <div className="flex gap-2 w-full">
                        <Button
                            onClick={() => setLocation("/pricing")}
                            className="flex-1"
                        >
                            Upgrade Now
                        </Button>
                        {onClose && (
                            <Button variant="outline" onClick={onClose}>
                                Maybe Later
                            </Button>
                        )}
                    </div>
                </CardFooter>
            </Card>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                    <Lock className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-3xl font-bold mb-2">AI Credit Underwriting</h1>
                <p className="text-muted-foreground text-lg">
                    Transform your underwriting process with intelligent automation
                </p>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Included Features</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                        {features.map((feature, index) => (
                            <div key={index} className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <feature.icon className="h-5 w-5 text-primary" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-primary text-primary-foreground">
                <CardHeader>
                    <CardTitle>Add-On Pricing</CardTitle>
                    <CardDescription className="text-primary-foreground/80">
                        Available for Broker and Team subscriptions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-4xl font-bold">£49</span>
                        <span className="text-primary-foreground/80">/month</span>
                    </div>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                            Unlimited AI analysis runs
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                            Professional credit reports
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                            Priority support
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                            Cancel anytime
                        </li>
                    </ul>
                </CardContent>
                <CardFooter>
                    <Button
                        size="lg"
                        variant="secondary"
                        className="w-full"
                        onClick={() => setLocation("/pricing")}
                    >
                        Upgrade to Premium
                    </Button>
                </CardFooter>
            </Card>

            <p className="text-center text-sm text-muted-foreground mt-6">
                Lender subscriptions include underwriting access at no extra cost.
            </p>
        </div>
    );
}
