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
import { Users, Shield, UserCog, Briefcase, Loader2, ArrowLeft, Search, Save, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";

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
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/role"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: roleData?.role === "super_admin",
  });

  const { data: slaSettings, isLoading: slaLoading } = useQuery<{ green: number; amber: number; red: number }>({
    queryKey: ["/api/admin/settings/sla"],
    enabled: roleData?.role === "super_admin" || roleData?.role === "sales_admin",
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("/api/auth/role", "POST", { targetUserId: userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Role Updated",
        description: "User role has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
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
    <div className="min-h-screen bg-background pb-24">
      <PageHeader
        title="Admin Dashboard"
        description="Manage users, platform settings, and SLAs"
        showBackButton={true}
      />

      <div className="container mx-auto p-6 space-y-6">
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
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        data-testid={`user-row-${user.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {user.firstName?.[0] || user.email?.[0] || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                              {user.lastLoginAt && (
                                <span>Last Login: {format(new Date(user.lastLoginAt), "MMM d, HH:mm")}</span>
                              )}
                              {user.lastLogoutAt && (
                                <span>Last Logout: {format(new Date(user.lastLogoutAt), "MMM d, HH:mm")}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                            <span className="flex items-center gap-1">
                              {getRoleIcon(user.role)}
                              {user.role?.replace("_", " ")}
                            </span>
                          </Badge>
                          <Badge variant="secondary" className="capitalize">
                            {user.subscriptionTier || "free"}
                          </Badge>
                          <Select
                            value={user.role}
                            onValueChange={(newRole) => {
                              if (user.id === currentUser?.id) {
                                toast({
                                  title: "Warning",
                                  description: "You cannot change your own role from this interface.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              updateUserRoleMutation.mutate({ userId: user.id, role: newRole });
                            }}
                            disabled={updateUserRoleMutation.isPending || user.id === currentUser?.id}
                          >
                            <SelectTrigger className="w-[140px]" data-testid={`select-role-${user.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="broker">Broker</SelectItem>
                              <SelectItem value="underwriter">Underwriter</SelectItem>
                              <SelectItem value="sales_admin">Sales Admin</SelectItem>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
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
        </Tabs>
      </div>
    </div>
  );
}
