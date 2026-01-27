import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertCircle, Ban, Briefcase, CheckCircle, MoreHorizontal, Search, ShieldAlert, TrendingUp, Users, Megaphone } from "lucide-react";
import { Link } from "wouter";
import { User } from "@shared/schema"; // Removed GodModeStats from here as it's being declared locally
import { toast } from "sonner";
import { format } from "date-fns";

interface GodModeStats {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    lenders: number;
    newUsersLastWeek: number;
}

export default function GodModeDashboard() {
    const [searchQuery, setSearchQuery] = useState("");

    const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
        queryKey: ["/api/god/users"],
    });

    const { data: stats, isLoading: isLoadingStats } = useQuery<GodModeStats>({
        queryKey: ["/api/god/stats"],
    });

    const suspendMutation = useMutation({
        mutationFn: (userId: string) => apiRequest(`/api/god/users/${userId}/suspend`, "POST"),
        onSuccess: () => {
            toast.success("User successfully unsuspended");
            queryClient.invalidateQueries({ queryKey: ["/api/god/users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/god/stats"] });
        },
        onError: (error: Error) => {
            toast.error(`Failed to suspend user: ${error.message}`);
        },
    });

    const deleteUserMutation = useMutation({
        mutationFn: (userId: string) => apiRequest(`/api/god/users/${userId}`, "DELETE"),
        onSuccess: () => {
            toast.success("User permanently deleted");
            queryClient.invalidateQueries({ queryKey: ["/api/god/users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/god/stats"] });
        },
    });

    const upgradeUserMutation = useMutation({
        mutationFn: ({ id, tier }: { id: string; tier: string }) =>
            apiRequest(`/api/god/users/${id}/upgrade`, "POST", { tier }),
        onSuccess: () => {
            toast.success("User subscription updated");
            queryClient.invalidateQueries({ queryKey: ["/api/god/users"] });
        },
    });

    const unsuspendMutation = useMutation({
        mutationFn: (userId: string) => apiRequest(`/api/god/users/${userId}/unsuspend`, "POST"),
        onSuccess: () => {
            toast.success("User unsuspended successfully");
            queryClient.invalidateQueries({ queryKey: ["/api/god/users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/god/stats"] });
        },
        onError: (error: Error) => {
            toast.error(`Failed to unsuspend user: ${error.message}`);
        },
    });

    const filteredUsers = users.filter((user) => {
        const searchLower = searchQuery.toLowerCase();
        return (
            (user.email ?? "").toLowerCase().includes(searchLower) ||
            (user.firstName ?? "").toLowerCase().includes(searchLower) ||
            (user.lastName ?? "").toLowerCase().includes(searchLower) ||
            user.id.toLowerCase().includes(searchLower)
        );
    });

    if (isLoadingUsers || isLoadingStats) {
        return <div className="p-8">Loading God Mode...</div>;
    }

    return (
        <div className="space-y-6 pt-6 pb-12">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-2">
                    <ShieldAlert className="h-8 w-8" />
                    God Mode
                </h1>
                <div className="flex gap-2">
                    <Link href="/god-mode/crm">
                        <Button variant="outline" className="gap-2">
                            <Briefcase className="h-4 w-4" />
                            Sales CRM
                        </Button>
                    </Link>
                    <Link href="/god-mode/marketing">
                        <Button variant="outline" className="gap-2">
                            <Megaphone className="h-4 w-4" />
                            Marketing
                        </Button>
                    </Link>
                    <Badge variant="destructive" className="text-sm px-4 py-1">
                        SUPER ADMIN ACCESS
                    </Badge>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.activeUsers || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Suspended</CardTitle>
                        <Ban className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.suspendedUsers || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Lenders</CardTitle>
                        <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.lenders || 0}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>User Management</CardTitle>
                        <div className="relative w-72">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                    <CardDescription>
                        Monitor usage and control access. Use with caution.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Tier</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Last Login</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {user.firstName} {user.lastName}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                {user.id}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{user.role}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{user.subscriptionTier}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.suspended ? (
                                            <Badge variant="destructive" className="gap-1">
                                                <Ban className="h-3 w-3" /> Suspended
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="gap-1 text-green-600 bg-green-100 dark:bg-green-900/30">
                                                <CheckCircle className="h-3 w-3" /> Active
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {user.createdAt ? format(new Date(user.createdAt), "dd MMM yyyy") : "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {user.lastLoginAt ? format(new Date(user.lastLoginAt), "dd MMM HH:mm") : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {user.id !== "Auond2MCDRlSuiOXZQDo" && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>

                                                    <DropdownMenuSub>
                                                        <DropdownMenuSubTrigger>
                                                            <TrendingUp className="mr-2 h-4 w-4" /> Upgrade Tier
                                                        </DropdownMenuSubTrigger>
                                                        <DropdownMenuSubContent>
                                                            {["free", "basic", "premium", "lender"].map((tier) => (
                                                                <DropdownMenuItem
                                                                    key={tier}
                                                                    onClick={() => upgradeUserMutation.mutate({ id: user.id, tier })}
                                                                >
                                                                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                                                                    {user.subscriptionTier === tier && <CheckCircle className="ml-2 h-4 w-4 text-green-500" />}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuSub>

                                                    <DropdownMenuSeparator />

                                                    {user.suspended ? (
                                                        <DropdownMenuItem onClick={() => unsuspendMutation.mutate(user.id)}>
                                                            <CheckCircle className="mr-2 h-4 w-4" /> Unsuspend
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem onClick={() => suspendMutation.mutate(user.id)}>
                                                            <Ban className="mr-2 h-4 w-4" /> Suspend
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuSeparator />

                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                                                <span className="flex items-center text-red-600 w-full cursor-pointer">
                                                                    <Ban className="mr-2 h-4 w-4" /> Delete User
                                                                </span>
                                                            </DropdownMenuItem>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Are you absolutely sure?</DialogTitle>
                                                                <DialogDescription>
                                                                    This action cannot be undone. This will permanently delete
                                                                    <strong> {user.firstName} {user.lastName} </strong>
                                                                    and remove their data from our servers.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <DialogFooter>
                                                                <Button variant="destructive" onClick={() => deleteUserMutation.mutate(user.id)}>
                                                                    Confirm Delete
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
