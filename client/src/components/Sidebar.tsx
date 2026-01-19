import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Home,
    Search,
    User,
    Settings,
    Send,
    Building2,
    FileSpreadsheet,
    Inbox,
    Users,
    Shield,
    ChevronLeft,
    ChevronRight,
    Plus,
    LogOut,
    Sparkles,
    LayoutDashboard,
    Clock
} from "lucide-react";
import logoChrome from "@assets/logo-chrome.png";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

interface NavItem {
    path: string;
    label: string;
    icon: any;
}

const brokerNavItems: NavItem[] = [
    { path: "/pipeline", label: "Dashboard", icon: LayoutDashboard },
    { path: "/search", label: "Company Search", icon: Search },
    { path: "/leads", label: "Leads Database", icon: FileSpreadsheet },
    { path: "/submissions", label: "Submissions", icon: Send },
    { path: "/lenders", label: "Lender Database", icon: Building2 },
    { path: "/inbox", label: "Inbox", icon: Inbox },
];

const underwriterNavItems: NavItem[] = [
    { path: "/underwriting", label: "Inbox", icon: Inbox },
    { path: "/pipeline", label: "Pipeline", icon: Home },
    { path: "/search", label: "Search", icon: Search },
];

const salesAdminNavItems: NavItem[] = [
    { path: "/", label: "Pipeline", icon: Home },
    { path: "/search", label: "Search", icon: Search },
    { path: "/teams", label: "Teams", icon: Users },
    { path: "/leads", label: "Leads", icon: FileSpreadsheet },
];

const superAdminNavItems: NavItem[] = [
    { path: "/", label: "Pipeline", icon: Home },
    { path: "/admin", label: "Admin", icon: Shield },
    { path: "/teams", label: "Teams", icon: Users },
    { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
    const [location] = useLocation();
    const { user, logoutMutation } = useAuth();
    const { data: roleData } = useQuery<{ role: string }>({
        queryKey: ["/api/auth/role"],
    });

    // Query prospect count
    const { data: prospectData } = useQuery<{ count: number }>({
        queryKey: ["/api/prospects/count"],
        enabled: !!user,
    });

    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem("sidebar-collapsed");
        return saved ? JSON.parse(saved) : false;
    });

    useEffect(() => {
        localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
    }, [isCollapsed]);

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);

    const role = roleData?.role || "broker";

    // Calculate trial days remaining
    const trialDaysRemaining = user?.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    const prospectCount = prospectData?.count || 0;

    const getNavItems = () => {
        switch (role) {
            case "super_admin":
                return superAdminNavItems;
            case "sales_admin":
                return salesAdminNavItems;
            case "underwriter":
                return underwriterNavItems;
            default:
                return brokerNavItems;
        }
    };

    const navItems = getNavItems();

    const isActive = (path: string) => {
        if (path === "/" && location === "/pipeline") return true;
        if (path === "/pipeline" && location === "/") return true;
        return location === path;
    };

    return (
        <div
            className={cn(
                "flex flex-col h-screen border-r bg-[#0f172a] text-white transition-all duration-300 relative",
                isCollapsed ? "w-16" : "w-64"
            )}
        >
            {/* Toggle Button */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-6 h-6 w-6 rounded-full border bg-[#1e293b] text-white p-0 shadow-md hover:bg-[#334155] z-50"
                onClick={toggleSidebar}
            >
                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </Button>

            {/* Header / Greeting */}
            <div className={cn("p-4 flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
                {!isCollapsed ? (
                    <span className="font-bold text-xl tracking-tight text-white/90 truncate">
                        Hi {user?.firstName}
                    </span>
                ) : (
                    <Avatar className="h-8 w-8 border border-white/10">
                        <AvatarImage src={user?.profileImageUrl || undefined} />
                        <AvatarFallback className="bg-[#D97706] text-white text-xs">
                            {user?.firstName?.[0] || "U"}
                        </AvatarFallback>
                    </Avatar>
                )}
            </div>

            <Separator className="bg-white/10" />

            {/* Quick Actions */}
            <div className="p-3">
                <TooltipProvider delayDuration={0}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link href="/search">
                                <Button
                                    className={cn(
                                        "w-full bg-[#D97706] hover:bg-[#B45309] text-white transition-all",
                                        isCollapsed ? "px-0 justify-center h-10 w-10" : "justify-start gap-2"
                                    )}
                                >
                                    <Plus className="h-5 w-5" />
                                    {!isCollapsed && <span>New Prospect</span>}
                                </Button>
                            </Link>
                        </TooltipTrigger>
                        {isCollapsed && (
                            <TooltipContent side="right">
                                <p>New Prospect</p>
                            </TooltipContent>
                        )}
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Search Bar */}
            {!isCollapsed && (
                <div className="px-3 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search database..."
                            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:bg-white/10 focus:border-[#D97706]"
                        />
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto py-2 space-y-1 px-3">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);

                    return (
                        <TooltipProvider key={item.path} delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link href={item.path}>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "w-full justify-start text-gray-400 hover:text-white hover:bg-white/10 mb-1",
                                                active && "bg-white/10 text-white font-medium",
                                                isCollapsed ? "px-0 justify-center h-10 w-10" : "px-3"
                                            )}
                                        >
                                            <Icon className={cn("h-5 w-5", active && "text-[#D97706]")} />
                                            {!isCollapsed && <span className="ml-3">{item.label}</span>}
                                        </Button>
                                    </Link>
                                </TooltipTrigger>
                                {isCollapsed && (
                                    <TooltipContent side="right">
                                        <p>{item.label}</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    );
                })}
            </div>

            {/* Prospect Quota Status */}
            {!isCollapsed && (
                <div className="px-3 pb-3">
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-gray-400">Prospect Quota</p>
                            <p className="text-xs font-bold text-white">
                                {prospectCount} / {user?.prospectLimit || 0}
                            </p>
                        </div>
                        <Progress
                            value={prospectCount / (user?.prospectLimit || 1) * 100}
                            className="h-2"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            {(user?.prospectLimit || 0) - prospectCount} prospects remaining
                        </p>
                    </div>
                </div>
            )}

            {/* Trial Status */}
            {!isCollapsed && user?.subscriptionTier === "trial" && (
                <div className="px-3 pb-3">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-amber-400" />
                            <p className="text-xs font-semibold text-amber-400">Free Trial</p>
                        </div>
                        <p className="text-xs text-gray-300">
                            {trialDaysRemaining} days remaining
                        </p>
                        <Link href="/pricing">
                            <Button size="sm" className="w-full mt-2 bg-[#D97706] hover:bg-[#B45309] text-white text-xs h-7">
                                Upgrade Now
                            </Button>
                        </Link>
                    </div>
                </div>
            )}

            <Separator className="bg-white/10" />

            {/* Footer / Profile */}
            <div className="p-3">
                <div
                    className={cn(
                        "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/10",
                        isCollapsed ? "justify-center" : "justify-start"
                    )}
                >
                    <Avatar className="h-8 w-8 border border-white/10">
                        <AvatarImage src={user?.profileImageUrl || undefined} />
                        <AvatarFallback className="bg-[#D97706] text-white text-xs">
                            {user?.firstName?.[0] || "U"}
                        </AvatarFallback>
                    </Avatar>

                    {!isCollapsed && (
                        <div className="flex flex-1 items-center justify-between overflow-hidden">
                            <div className="truncate">
                                <p className="text-sm font-medium text-white truncate">
                                    {user?.firstName} {user?.lastName}
                                </p>
                                <p className="text-xs text-gray-500 capitalize">{user?.subscriptionTier || "Free"} Plan</p>
                            </div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-gray-400 hover:text-white"
                                            onClick={() => logoutMutation.mutate()}
                                        >
                                            <LogOut className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Sign out</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}
                </div>

                {isCollapsed && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-400 hover:text-white mt-2 mx-auto flex"
                                    onClick={() => logoutMutation.mutate()}
                                >
                                    <LogOut className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">Sign out</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    );
}
