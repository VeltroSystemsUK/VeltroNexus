import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { ChannelList } from "@/components/chat/ChannelList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { NewChatModal } from "@/components/chat/NewChatModal";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export const Inbox: React.FC = () => {
    const { user } = useAuth();
    const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);

    // Poll Channels List
    const { data: channels = [], isLoading: channelsLoading } = useQuery<any[]>({
        queryKey: ["/api/chat/channels"],
        refetchInterval: 5000, // Poll every 5s for new chats/updates
    });

    // Poll Messages for Selected Channel
    const { data: messages = [] } = useQuery<any[]>({
        queryKey: [`/api/chat/channels/${selectedChannelId}/messages`],
        enabled: !!selectedChannelId,
        refetchInterval: 3000, // Poll active chat every 3s
    });

    // Fetch Users for Name/Avatar lookup (cached)
    const { data: users = [] } = useQuery<any[]>({
        queryKey: ["/api/chat/users"],
        staleTime: 5 * 60 * 1000,
    });

    const usersMap = useMemo(() => {
        const map: Record<string, any> = {};
        if (Array.isArray(users)) {
            users.forEach((u: any) => (map[u.id] = u));
        }
        return map;
    }, [users]);

    // Enhance channel names with Other User's name if it's a DM
    const enrichedChannels = useMemo(() => {
        return channels.map((c: any) => {
            if (c.type === 'direct') {
                // We need members to know who the other person is ideally
                // But list endpoint is slim.
                // WORKAROUND: For now, if we don't have members in list, generic.
                // Ideally backend enriches this.
                // Let's rely on client logic if we had members.
                // Since we don't have members in list response yet, we might need to fix backend route or accept generic name.
                return { ...c, name: c.name || "Direct Message" };
            }
            return c;
        });
    }, [channels]);

    // Find selected channel object
    const selectedChannel = enrichedChannels.find((c: any) => c.id === selectedChannelId);

    if (!user) return <div className="p-10"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="h-[calc(100vh-4rem)] p-4 md:p-6 bg-gray-50/50">
            <Card className="h-full overflow-hidden border-0 shadow-lg ring-1 ring-gray-200">
                <ResizablePanelGroup direction="horizontal">
                    {/* Sidebar */}
                    <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="bg-gray-50/50 border-r border-gray-100 flex flex-col">
                        <div className="p-4">
                            <h2 className="text-xl font-bold tracking-tight mb-6">Inbox</h2>
                            <NewChatModal onChannelCreated={setSelectedChannelId} />
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {channelsLoading ? (
                                <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5 text-gray-400" /></div>
                            ) : (
                                <ChannelList
                                    channels={enrichedChannels}
                                    selectedChannelId={selectedChannelId}
                                    onSelect={setSelectedChannelId}
                                    currentUserId={user.id}
                                />
                            )}
                        </div>
                    </ResizablePanel>

                    <ResizableHandle />

                    {/* Main Chat Area */}
                    <ResizablePanel defaultSize={75}>
                        <ChatWindow
                            channelId={selectedChannelId}
                            channelName={selectedChannel?.name}
                            currentUserId={user.id}
                            messages={messages}
                            usersMap={usersMap}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </Card>
        </div>
    );
};

export default Inbox;
