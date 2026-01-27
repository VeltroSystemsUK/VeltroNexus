import React, { useState, useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, FileUp } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ChatWindowProps {
    channelId: number | null;
    channelName?: string;
    currentUserId: string;
    messages: any[];
    usersMap: Record<string, any>; // Map userId to user object for quick lookup
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
    channelId,
    channelName,
    currentUserId,
    messages,
    usersMap,
}) => {
    const [inputValue, setInputValue] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            // Simple timeout to ensure DOM is rendered
            setTimeout(() => {
                scrollRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
    }, [messages]);

    const sendMessageMutation = useMutation({
        mutationFn: async (content: string) => {
            if (!channelId) throw new Error("No channel selected");
            const res = await apiRequest(`/api/chat/channels/${channelId}/messages`, "POST", {
                content,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/chat/channels/${channelId}/messages`] });
            setInputValue("");
        },
    });

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || !channelId) return;
        sendMessageMutation.mutate(inputValue);
    };

    if (!channelId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 h-full text-gray-400">
                <p>Select a conversation to start chatting</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="flex items-center px-6 py-4 border-b border-gray-100 bg-white">
                <h3 className="text-lg font-semibold text-gray-800">{channelName || "Chat"}</h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-hidden relative bg-gray-50/50">
                <ScrollArea className="h-full px-6 py-4">
                    {messages.length === 0 ? (
                        <div className="text-center text-gray-400 mt-10">No messages yet. Say hello!</div>
                    ) : (
                        messages.map((msg) => {
                            const sender = usersMap[msg.senderId];
                            return (
                                <MessageBubble
                                    key={msg.id}
                                    id={msg.id}
                                    content={msg.content}
                                    senderId={msg.senderId}
                                    isOwn={msg.senderId === currentUserId}
                                    createdAt={msg.createdAt}
                                    senderName={sender ? `${sender.firstName} ${sender.lastName}` : "Unknown"}
                                    senderAvatar={sender?.profileImageUrl}
                                />
                            );
                        })
                    )}
                    <div ref={scrollRef} />
                </ScrollArea>
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-gray-100">
                <form onSubmit={handleSend} className="flex gap-2">
                    <Button variant="ghost" size="icon" type="button" className="text-gray-400 hover:text-gray-600">
                        <FileUp className="h-5 w-5" />
                    </Button>
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 bg-gray-50 border-gray-200 focus:bg-white transition-all"
                    />
                    <Button type="submit" disabled={!inputValue.trim() || sendMessageMutation.isPending}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
};
