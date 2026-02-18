import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface EmailLinkProps {
    email: string;
    name?: string;
    className?: string;
    children?: React.ReactNode;
}

/**
 * EmailLink - Clickable email that opens Gmail compose
 * Used throughout Prospects, CRM, and Lead Finder
 */
export function EmailLink({ email, name, className, children }: EmailLinkProps) {
    const [, setLocation] = useLocation();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Navigate to Gmail compose with pre-filled recipient
        const params = new URLSearchParams({
            compose: 'true',
            to: email,
        });

        if (name) {
            params.set('name', name);
        }

        setLocation(`/gmail?${params.toString()}`);
    };

    if (!email) {
        return <span className="text-muted-foreground">No email</span>;
    }

    return (
        <a
            href={`mailto:${email}`}
            onClick={handleClick}
            className={cn(
                "text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors",
                "dark:text-blue-400 dark:hover:text-blue-300",
                className
            )}
            title={`Send email to ${email}`}
        >
            {children || email}
        </a>
    );
}
