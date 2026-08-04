import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { usePageTitle } from "@/context/LayoutContext";

interface PageHeaderProps {
    title: string;
    description?: string;
    subtitle?: string;
    children?: React.ReactNode;
    showBackButton?: boolean;
}

export function PageHeader({
    title,
    description,
    subtitle,
    children,
    showBackButton = true
}: PageHeaderProps) {
    const [, navigate] = useLocation();

    // Set the global title and description
    usePageTitle(title, description || subtitle);

    // If there are no children (actions) and no back button needed, don't render this bar
    if (!children && !showBackButton) return null;

    return (
        <div className="w-full bg-background border-b px-6 py-4 flex items-center justify-between gap-4">
            {/* Optional Back Button / Sub-nav area */}
            <div className="flex items-center gap-4">
                {showBackButton && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate("/")}
                        className="text-muted-foreground hover:text-foreground"
                        data-testid="button-back"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}

                {subtitle && (
                    <p className="text-sm text-muted-foreground">{subtitle}</p>
                )}
            </div>


            {/* Actions */}
            <div className="flex items-center gap-2">
                {children}
            </div>
        </div >
    );
}
