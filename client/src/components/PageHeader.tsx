import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface PageHeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode;
    showBackButton?: boolean;
}

export function PageHeader({
    title,
    description,
    children,
    showBackButton = true
}: PageHeaderProps) {
    const [, navigate] = useLocation();

    return (
        <div className="sticky top-0 z-50 w-full border-b border-[#1e293b] bg-[#0f172a] shadow-sm">
            <div className="container mx-auto px-4 md:px-6 py-3 md:py-5 flex items-center justify-between gap-4 text-white">
                <div className="flex items-center gap-4">
                    {showBackButton && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate("/")}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                            data-testid="button-back"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
                        {description && (
                            <p className="text-gray-400 text-sm hidden md:block">{description}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {children}
                </div>
            </div>
        </div>
    );
}
