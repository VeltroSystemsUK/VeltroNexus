import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Plus } from "lucide-react";

interface NewChatModalProps {
    onChannelCreated: (channelId: number) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ onChannelCreated }) => {
    const [open, setOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const queryClient = useQueryClient();

    // Fetch Potential Users
    const { data: users = [] } = useQuery<any[]>({
        queryKey: ["/api/chat/users"],
        staleTime: 60000,
    });

    const createChannelMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("/api/chat/channels", "POST", {
                type: "direct",
                targetUserId: selectedUserId,
            });
            return res.json();
        },
        onSuccess: (channel) => {
            queryClient.invalidateQueries({ queryKey: ["/api/chat/channels"] });
            setOpen(false);
            onChannelCreated(channel.id);
        },
    });

    const handleCreate = () => {
        if (!selectedUserId) return;
        createChannelMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full justify-start gap-2 mb-4" variant="default">
                    <Plus className="h-4 w-4" />
                    New Chat
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Message</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Select Team Member</Label>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a colleague..." />
                            </SelectTrigger>
                            <SelectContent>
                                {users?.map((u: any) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.firstName} {u.lastName} ({u.role})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        onClick={handleCreate}
                        disabled={!selectedUserId || createChannelMutation.isPending}
                        className="w-full"
                    >
                        Start Chat
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
