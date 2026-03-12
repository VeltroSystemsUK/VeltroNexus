import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import {
  Users, Shield, UserCog, Briefcase, Loader2, ArrowLeft, Search, Save, AlertCircle,
  MoreVertical, Edit, Key, Trash2, Crown, Gem, Zap, Coffee, Mail, UserPlus, CheckCircle, XCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/context/LayoutContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface WaitlistEntry {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  source: string;
  trialInterest: boolean;
  status: "pending" | "contacted" | "converted";
  unsubscribed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  subscriptionTier: string;
  createdAt: string;
  lastLoginAt?: string;
  lastLogoutAt?: string;
  suspended?: boolean;
}

const slaSchema = z.object({
  green: z.coerce.number().min(0.1, "Must be at least 0.1 hours"),
  amber: z.coerce.number().min(0.1, "Must be at least 0.1 hours"),
  red: z.coerce.number().min(0.1, "Must be at least 0.1 hours"),
}).refine(data => data.green < data.amber && data.amber < data.red, {
  message: "Durations must increase: Green < Amber < Red",
  path: ["red"],
});

type SLAFormValues = z.infer<typeof slaSchema>;

export default function Admin() {
  usePageTitle("ADMIN DASHBOARD", "Manage users, platform settings, and SLAs");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [waitlistSearch, setWaitlistSearch] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/role"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: roleData?.role === "super_admin" || roleData?.role === "sales_admin",
  });

  const { data: slaSettings, isLoading: slaLoading } = useQuery<{ green: number; amber: number; red: number }>({
    queryKey: ["/api/admin/settings/sla"],
    enabled: roleData?.role === "super_admin" || roleData?.role === "sales_admin",
  });

  const { data: waitlistEntries, isLoading: waitlistLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ["/api/marketing/waitlist"],
    enabled: roleData?.role === "super_admin" || roleData?.role === "sales_admin",
  });

  const updateWaitlistStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest(`/api/marketing/waitlist/${id}/status`, "PATCH", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/waitlist"] });
      toast({ title: "Status Updated", description: "Waitlist entry status has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    },
  });

  // Generalized Update Mutation (Role, Subscription, etc.)
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<User> }) => {
      return apiRequest(`/api/admin/users/${userId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUser(null);
      toast({
        title: "User Updated",
        description: "User details have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  // Keep for backward compatibility if needed, using the new endpoint
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest(`/api/admin/users/${userId}`, "PATCH", { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Role Updated", description: "User role has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleSuspendUserMutation = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      return apiRequest(`/api/admin/users/${userId}`, "PATCH", { suspended: suspend });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: variables.suspend ? "User Suspended" : "User Unsuspended",
        description: `User has been ${variables.suspend ? "suspended" : "unsuspended"}.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/admin/users/${userId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User Deleted",
        description: "User has been permanently deleted.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const slaMutation = useMutation({
    mutationFn: async (values: SLAFormValues) => {
      return apiRequest("/api/admin/settings/sla", "POST", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/sla"] });
      toast({
        title: "SLA Settings Saved",
        description: "SLA settings updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const form = useForm<SLAFormValues>({
    resolver: zodResolver(slaSchema),
    defaultValues: {
      green: 4,
      amber: 24,
      red: 48,
    },
    values: slaSettings ? {
      green: slaSettings.green,
      amber: slaSettings.amber,
      red: slaSettings.red
    } : undefined
  });

  if (roleData?.role !== "super_admin" && roleData?.role !== "sales_admin") {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">Only Super Admins can access this page.</p>
            <Button onClick={() => navigate("/")} data-testid="button-go-home">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Shield className="h-4 w-4 text-red-500" />;
      case "sales_admin":
        return <UserCog className="h-4 w-4 text-orange-500" />;
      case "underwriter":
        return <Users className="h-4 w-4 text-purple-500" />;
      default:
        return <Briefcase className="h-4 w-4 text-blue-500" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      case "sales_admin":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "underwriter":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      default:
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    }
  };

  const filteredUsers =
    users?.filter(
      (user) =>
        user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  return (
    <main className="w-full px-4 md:px-6 py-6 md:py-10 space-y-6">
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-2">
            <Shield className="h-4 w-4" />
            SLA Settings
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="gap-2">
            <Mail className="h-4 w-4" />
            Waitlist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users?.length || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Super Admins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {users?.filter((u) => u.role === "super_admin").length || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Sales Admins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {users?.filter((u) => u.role === "sales_admin").length || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Underwriters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {users?.filter((u) => u.role === "underwriter").length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>View and manage all platform users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="user-search"
                  name="user-search"
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-users"
                />
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No users found</div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors"
                      data-testid={`user-row-${user.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {user.firstName?.[0] || user.email?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {user.firstName} {user.lastName}
                            {user.suspended && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1">SUSPENDED</Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                            {user.lastLoginAt && (
                              <span>Last Login: {format(new Date(user.lastLoginAt), "MMM d, HH:mm")}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {/* Role Badge */}
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold">Role</span>
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm border 
                            ${user.role === "super_admin" ? "bg-red-100 text-red-700 border-red-200" :
                                user.role === "broker" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                  user.role === "underwriter" ? "bg-purple-100 text-purple-700 border-purple-200" :
                                    user.role === "sales_admin" ? "bg-orange-100 text-orange-700 border-orange-200" : // Mapped to Introducer/Sales Admin
                                      "bg-green-100 text-green-700 border-green-200" // Default/Team
                              }`}
                            title={user.role}
                          >
                            {user.role === "super_admin" ? "A" :
                              user.role === "broker" ? "B" :
                                user.role === "underwriter" ? "U" :
                                  user.role === "sales_admin" ? "I" : // Introducer
                                    "T"}
                          </div>
                        </div>

                        {/* Subscription Icon */}
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] uppercase text-muted-foreground font-semibold">Plan</span>
                          <div className="h-8 w-8 flex items-center justify-center bg-muted rounded-md" title={user.subscriptionTier}>
                            {user.subscriptionTier === "lender" || user.subscriptionTier === "enterprise" ? <Crown className="h-4 w-4 text-amber-500" /> :
                              user.subscriptionTier === "pro" || user.subscriptionTier === "premium" ? <Gem className="h-4 w-4 text-indigo-500" /> :
                                user.subscriptionTier === "starter" || user.subscriptionTier === "basic" ? <Zap className="h-4 w-4 text-blue-500" /> :
                                  <Coffee className="h-4 w-4 text-slate-500" />}
                          </div>
                        </div>

                        {/* Actions Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setEditingUser(user)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleSuspendUserMutation.mutate({ userId: user.id, suspend: !user.suspended })}>
                              <Key className="mr-2 h-4 w-4" /> {user.suspended ? "Unsuspend" : "Suspend"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
                                  deleteUserMutation.mutate(user.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SLA Thresholds (Hours)</CardTitle>
              <CardDescription>
                Define the time limits for each status color. These apply to the time elapsed since submission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slaLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => slaMutation.mutate(data))} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField
                        control={form.control}
                        name="green"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-green-600 font-bold">Green Phase</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  id="sla-green"
                                  type="number"
                                  step="0.5"
                                  {...field}
                                  onChange={e => field.onChange(parseFloat(e.target.value))}
                                />
                                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">hrs</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="amber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-amber-600 font-bold">Amber Phase</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  id="sla-amber"
                                  type="number"
                                  step="0.5"
                                  {...field}
                                  onChange={e => field.onChange(parseFloat(e.target.value))}
                                />
                                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">hrs</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="red"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-red-600 font-bold">Red Phase</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  id="sla-red"
                                  type="number"
                                  step="0.5"
                                  {...field}
                                  onChange={e => field.onChange(parseFloat(e.target.value))}
                                />
                                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">hrs</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground border">
                      <p className="font-semibold mb-2">How it works:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><span className="text-green-600 font-medium">Green</span>: 0 to {form.watch("green")} hours</li>
                        <li><span className="text-amber-600 font-medium">Amber</span>: {form.watch("green")} to {form.watch("amber")} hours (Warning)</li>
                        <li><span className="text-red-600 font-medium">Red</span>: {form.watch("amber")} hours+ (Breached)</li>
                        <li>At {form.watch("red")} hours, a critical warning icon appears.</li>
                      </ul>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit" disabled={slaMutation.isPending}>
                        {slaMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Settings
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waitlist" className="space-y-6">
          {(() => {
            const total = waitlistEntries?.length || 0;
            const pending = waitlistEntries?.filter(e => e.status === "pending").length || 0;
            const trialInterested = waitlistEntries?.filter(e => e.trialInterest).length || 0;
            const unsubscribed = waitlistEntries?.filter(e => e.unsubscribed).length || 0;
            const filteredWaitlist = waitlistEntries?.filter(e =>
              e.email?.toLowerCase().includes(waitlistSearch.toLowerCase()) ||
              e.firstName?.toLowerCase().includes(waitlistSearch.toLowerCase()) ||
              e.companyName?.toLowerCase().includes(waitlistSearch.toLowerCase())
            ) || [];

            return (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Signups</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{total}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-600">{pending}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Trial Interested</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">{trialInterested}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Unsubscribed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{unsubscribed}</div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Waitlist Entries
                    </CardTitle>
                    <CardDescription>Manage waitlist signups and marketing contacts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="waitlist-search"
                        name="waitlist-search"
                        placeholder="Search by email, name, or company..."
                        value={waitlistSearch}
                        onChange={(e) => setWaitlistSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {waitlistLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : filteredWaitlist.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No waitlist entries found</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-3 font-medium">Contact</th>
                              <th className="pb-3 font-medium">Company</th>
                              <th className="pb-3 font-medium">Source</th>
                              <th className="pb-3 font-medium">Trial</th>
                              <th className="pb-3 font-medium">Status</th>
                              <th className="pb-3 font-medium">Subscribed</th>
                              <th className="pb-3 font-medium">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredWaitlist.map((entry) => (
                              <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/50">
                                <td className="py-3">
                                  <div>
                                    <p className="font-medium">{entry.firstName || "—"} {entry.lastName || ""}</p>
                                    <p className="text-xs text-muted-foreground">{entry.email}</p>
                                  </div>
                                </td>
                                <td className="py-3 text-muted-foreground">{entry.companyName || "—"}</td>
                                <td className="py-3">
                                  <Badge variant="outline" className="text-xs">{entry.source}</Badge>
                                </td>
                                <td className="py-3">
                                  {entry.trialInterest ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="py-3">
                                  <Select
                                    value={entry.status}
                                    onValueChange={(val) => updateWaitlistStatusMutation.mutate({ id: entry.id, status: val })}
                                  >
                                    <SelectTrigger className="h-7 w-[120px] text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="contacted">Contacted</SelectItem>
                                      <SelectItem value="converted">Converted</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="py-3">
                                  {entry.unsubscribed ? (
                                    <Badge variant="destructive" className="text-xs">Unsubscribed</Badge>
                                  ) : (
                                    <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
                                  )}
                                </td>
                                <td className="py-3 text-xs text-muted-foreground">
                                  {entry.createdAt ? format(new Date(entry.createdAt), "MMM d, yyyy") : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user role and subscription tier.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name
              </Label>
              <Input
                id="edit-name"
                value={editingUser ? `${editingUser.firstName} ${editingUser.lastName}` : ""}
                disabled
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-role" className="text-right">
                Role
              </Label>
              <Select
                value={editingUser?.role}
                onValueChange={(val) => setEditingUser(prev => prev ? { ...prev, role: val } : null)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="broker">Broker</SelectItem>
                  <SelectItem value="underwriter">Underwriter</SelectItem>
                  <SelectItem value="sales_admin">Sales Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-subscription" className="text-right">
                Plan
              </Label>
              <Select
                value={editingUser?.subscriptionTier}
                onValueChange={(val) => setEditingUser(prev => prev ? { ...prev, subscriptionTier: val } : null)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="lender">Lender</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={updateUserMutation.isPending}
              onClick={() => {
                if (editingUser) {
                  updateUserMutation.mutate({
                    userId: editingUser.id,
                    data: {
                      role: editingUser.role,
                      subscriptionTier: editingUser.subscriptionTier
                    }
                  });
                }
              }}
            >
              {updateUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
