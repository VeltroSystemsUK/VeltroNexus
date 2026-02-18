import React from "react";
import { cn } from "@/lib/utils";

interface TaskCardProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    assignee?: string;
    status?: "done" | "working" | "stuck" | "default";
    isGhost?: boolean;
}

export function TaskCard({
    title,
    assignee,
    status = "default",
    isGhost = false,
    className,
    ...props
}: TaskCardProps) {
    if (isGhost) {
        return (
            <div
                className={cn(
                    "h-24 w-full rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/50",
                    className
                )}
                {...props}
            />
        );
    }

    const statusColors = {
        done: "bg-status-done",
        working: "bg-status-working",
        stuck: "bg-status-stuck",
        default: "bg-slate-200",
    };

    return (
        <div
            className={cn(
                // Modern Minimalist Layout
                "group relative flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4",
                // Visual Depth & Interactions
                "cursor-grab shadow-sm transition-all duration-200 ease-in-out hover:shadow-lg active:cursor-grabbing",
                "active:scale-[0.98]",
                className
            )}
            {...props}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-tight text-slate-500">
                    Veltro-{Math.floor(Math.random() * 1000)}
                </span>
                <div className={cn("h-2 w-2 rounded-full", statusColors[status])} />
            </div>

            <h3 className="line-clamp-2 text-sm font-medium leading-tight text-slate-900 group-hover:text-primary">
                {title}
            </h3>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
                {assignee ? (
                    <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 ring-2 ring-white ring-offset-1">
                            <span className="text-[10px] font-bold text-slate-600">
                                {assignee.charAt(0)}
                            </span>
                        </div>
                        <span className="text-xs text-slate-600">{assignee}</span>
                    </div>
                ) : (
                    <span className="text-xs italic text-slate-400">Unassigned</span>
                )}

                {/* Micro-interaction trigger */}
                <button className="opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="19" r="1" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
