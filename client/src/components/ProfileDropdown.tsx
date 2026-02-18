import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function ProfileDropdown() {
    const { user, logoutMutation } = useAuth();
    const [, navigate] = useLocation();

    // Prospect limit calculation (moved from Pipeline for display consistency if needed, 
    // currently only using for display in menu)
    // We won't fetch prospects here to keep it light, just use user data if available?
    // Actually, Pipeline was passing `prospects.length`, here we might not have it.
    // For the dropdown summary, we'll stick to user attributes or omit the count if not available easily.
    // The user hook usually returns the user object which might have some counts if updated on login/refresh.
    // For now, will omit dynamic prospect count in dropdown to avoid unnecessary data fetching in header component, 
    // or checks if it's critical. The original had: 
    // "{prospects.length} / {user?.prospectLimit || 10} prospects used"
    // We'll trust user object or just show the limit/Plan.

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 md:h-10 md:w-10 rounded-full border border-border/50 bg-background hover:bg-accent focus:ring-0"
                    data-testid="button-user-menu"
                >
                    <Avatar className="h-8 w-8 md:h-9 md:w-9">
                        <AvatarImage
                            src={user?.profileImageUrl || undefined}
                            alt={user?.firstName || "User"}
                            className="object-cover"
                        />
                        <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                            {user?.firstName?.[0] || user?.email?.[0] || "U"}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
                <div className="px-2 py-2">
                    <p className="font-semibold text-sm">
                        {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-muted-foreground text-xs truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <div className="px-2 py-2">
                    <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide font-bold">
                        Subscription
                    </p>
                    <p className="font-medium text-sm capitalize">
                        {user?.subscriptionTier || "Free"} Plan
                    </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => navigate("/profile")}
                    className="cursor-pointer"
                    data-testid="menu-item-profile"
                >
                    Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => navigate("/settings")}
                    className="cursor-pointer"
                    data-testid="menu-item-settings"
                >
                    Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => navigate("/credit-tools")}
                    className="cursor-pointer"
                >
                    Credit Tools
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    data-testid="menu-item-logout"
                >
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
