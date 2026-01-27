import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";

interface ChannelListProps {
    channels: any[];
    selectedChannelId: number | null;
    onSelect: (id: number) => void;
    currentUserId: string;
}

export const ChannelList: React.FC<ChannelListProps> = ({
    channels,
    selectedChannelId,
    onSelect,
    currentUserId,
}) => {

    const getChannelDisplayName = (channel: any) => {
        if (channel.name) return channel.name;
        // For direct chats, we might want to show the OTHER user's name
        // But listing channels endpoint currently just returns channel objects without member expansion
        // We would need to handle this via props or enhanced API response.
        // Fallback:
        return channel.type === 'direct' ? "Direct Message" : "Group Chat";
    }

    const formatTime = (date: string) => {
        const d = new Date(date);
        if (isToday(d)) return format(d, "h:mm a");
        if (isYesterday(d)) return "Yesterday";
        return format(d, "dd/MM/yy");
    }

    return (
        <div className="flex flex-col gap-1 p-2">
            {channels.map((channel) => (
                <button
                    key={channel.id}
                    onClick={() => onSelect(channel.id)}
                    className={cn(
                        "flex items-center gap-3 w-full p-3 rounded-xl text-left transition-all",
                        selectedChannelId === channel.id
                            ? "bg-blue-50 text-blue-700"
                            : "hover:bg-gray-100 text-gray-700"
                    )}
                >
                    <Avatar className="h-10 w-10">
                        <AvatarFallback className={cn(selectedChannelId === channel.id ? "bg-blue-200 text-blue-700" : "")}>
                            {getChannelDisplayName(channel).substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                            <span className="font-medium truncate">{getChannelDisplayName(channel)}</span>
                            <span className="text-[10px] text-gray-400 shrink-0">
                                {channel.lastMessageAt ? formatTime(channel.lastMessageAt) : ""}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                            {/* Last message preview could go here if API returned it */}
                            {channel.type === 'group' ? 'Group conversation' : 'Private conversation'}
                        </p>
                    </div>
                </button>
            ))}
        </div>
    );
};
