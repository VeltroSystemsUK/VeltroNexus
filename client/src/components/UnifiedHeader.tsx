import { useLayout } from "@/context/LayoutContext";
import ThemeToggle from "@/components/ThemeToggle";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function UnifiedHeader() {
    const { pageTitle, pageDescription, headerActions } = useLayout();
    const [displayTitle, setDisplayTitle] = useState(pageTitle);
    const [displayDesc, setDisplayDesc] = useState(pageDescription);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        setAnimating(true);
        const timer = setTimeout(() => {
            setAnimating(false);
        }, 500);

        setDisplayTitle(pageTitle);
        setDisplayDesc(pageDescription);

        return () => clearTimeout(timer);
    }, [pageTitle, pageDescription]);

    return (
        <header className="sticky top-0 z-40 w-full border-b border-[#1e293b] bg-[#0f172a] shadow-sm transition-all h-auto pb-[20px]">
            <div className="container flex items-center justify-between px-4 md:px-6 h-full">
                <div className="flex flex-col justify-center overflow-hidden min-h-[3rem] pt-[36px]">
                    {/* Animated Title Container */}
                    <div className="relative">
                        <h1
                            key={displayTitle}
                            className={cn(
                                "text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight uppercase whitespace-nowrap text-white",
                                "animate-in slide-in-from-left-2 fade-in duration-500 ease-out fill-mode-both"
                            )}
                        >
                            {displayTitle || "VELTRO"}
                        </h1>
                        {displayDesc && (
                            <p
                                key={displayDesc + "desc"}
                                className={cn(
                                    "text-xs md:text-sm text-gray-400 font-medium animate-in slide-in-from-left-3 fade-in duration-700 ease-out delay-100 fill-mode-both mt-0.5"
                                )}
                            >
                                {displayDesc}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center">
                    {headerActions && <div className="flex items-center gap-2 mr-6">{headerActions}</div>}
                    <div className="flex items-center gap-2 md:gap-4 pl-6 border-l border-slate-800">
                        <ThemeToggle />
                        <div className="h-8 w-px bg-[#334155] hidden md:block" />
                        <ProfileDropdown />
                    </div>
                </div>
            </div>
        </header>
    );
}
