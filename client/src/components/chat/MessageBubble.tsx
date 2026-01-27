import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface MessageProps {
    id: number;
    content: string;
    senderId: string;
    createdAt: string | Date;
    isOwn: boolean;
    senderName?: string;
    senderAvatar?: string;
}

export const MessageBubble: React.FC<MessageProps> = ({
    content,
    createdAt,
    isOwn,
    senderName,
    senderAvatar,
}) => {
    return (
        <div className={cn("flex w-full mb-4", isOwn ? "justify-end" : "justify-start")}>
            <div className={cn("flex max-w-[70%] gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
                <Avatar className="h-8 w-8 mt-1">
                    <AvatarImage src={senderAvatar} />
                    <AvatarFallback>{senderName?.substring(0, 2).toUpperCase() || "??"}</AvatarFallback>
                </Avatar>

                <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                    <div className="flex items-center gap-2 mb-1">
                        {!isOwn && <span className="text-xs font-medium text-gray-500">{senderName}</span>}
                        <span className="text-[10px] text-gray-400">
                            {format(new Date(createdAt), "h:mm a")}
                        </span>
                    </div>

                    <div
                        className={cn(
                            "px-4 py-2 rounded-2xl text-sm shadow-sm",
                            isOwn
                                ? "bg-blue-600 text-white rounded-tr-none"
                                : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"
                        )}
                    >
                        {content}
                    </div>
                </div>
            </div>
        </div>
    );
};
