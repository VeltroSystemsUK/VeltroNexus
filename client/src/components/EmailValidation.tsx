import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ValidationResult {
    isValid: boolean;
    confidence: number;
    reason: string;
}

export function EmailValidation() {
    const [email, setEmail] = useState("");
    const [isValidating, setIsValidating] = useState(false);
    const [result, setResult] = useState<ValidationResult | null>(null);

    const handleValidate = async () => {
        if (!email) {
            toast.error("Please enter an email address");
            return;
        }

        try {
            setIsValidating(true);
            setResult(null);
            const res = await apiRequest("/api/email/validate", "POST", { email });
            const data = await res.json();
            setResult(data);
            if (data.isValid) {
                toast.success("Email is valid!");
            } else {
                toast.error(`Email validation failed: ${data.reason}`);
            }
        } catch (error: any) {
            console.error("Validation failed", error);
            toast.error(error.message || "Failed to validate email");
        } finally {
            setIsValidating(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                    Email Intelligence
                </CardTitle>
                <CardDescription>
                    Verify email deliverability and detect disposable providers.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        placeholder="Enter email to verify..."
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleValidate()}
                    />
                    <Button onClick={handleValidate} disabled={isValidating}>
                        {isValidating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            "Validate"
                        )}
                    </Button>
                </div>

                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`p-4 rounded-lg border ${result.isValid ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                {result.isValid ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                                ) : (
                                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                )}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm">
                                            {result.isValid ? "Valid Recipient" : "Validation Failed"}
                                        </span>
                                        <Badge variant={result.isValid ? "default" : "destructive"} className="text-[10px] px-1.5 h-4">
                                            {Math.round(result.confidence * 100)}% Confidence
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {result.reason}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
