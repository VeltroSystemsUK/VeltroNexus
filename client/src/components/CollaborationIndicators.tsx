import React from "react";
import { cn } from "@/lib/utils";

// ==========================================
// User Cursor Component
// ==========================================

interface UserCursorProps {
    x: number;
    y: number;
    name: string;
    color: string;
    className?: string;
}

export function UserCursor({ x, y, name, color, className }: UserCursorProps) {
    return (
        <div
            className={cn("pointer-events-none absolute z-50 transition-all duration-100 ease-linear", className)}
            style={{ left: x, top: y }}
        >
            {/* Cursor Arrow */}
            <svg
                width="24"
                height="36"
                viewBox="0 0 24 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-sm"
            >
                <path
                    d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                    fill={color}
                    stroke="white"
                />
            </svg>

            {/* Name Tag */}
            <div
                className="absolute left-4 top-5 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
                style={{ backgroundColor: color }}
            >
                {name}
            </div>
        </div>
    );
}

// ==========================================
// Presence Avatar Component
// ==========================================

interface PresenceAvatarProps {
    src?: string;
    fallback: string;
    isActive?: boolean;
    className?: string;
}

export function PresenceAvatar({ src, fallback, isActive = false, className }: PresenceAvatarProps) {
    return (
        <div className={cn("relative inline-block", className)}>
            <div
                className={cn(
                    "h-8 w-8 overflow-hidden rounded-full border border-white bg-slate-100",
                    isActive && "ring-2 ring-emerald-500 ring-offset-2"
                )}
            >
                {src ? (
                    <img src={src} alt={fallback} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center font-bold text-slate-500 text-xs">
                        {fallback}
                    </div>
                )}
            </div>

            {/* Status Dot (Optional enhancement based on "Presence" vibe) */}
            {isActive && (
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-status-online" />
            )}
        </div>
    );
}
