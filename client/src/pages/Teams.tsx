import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import {
  Plus,
  Users,
  UserPlus,
  Trash2,
  Loader2,
  Building2,
  Shield,
  UserCog,
  Briefcase,
  ArrowLeft,
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle, usePageActions } from "@/context/LayoutContext";

interface Team {
  id: number;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: number;
  teamId: number;
  userId: string;
  memberRole: string;
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

interface TeamWithMembers extends Team {
  members: TeamMember[];
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function Teams() {
  usePageTitle("Team Management", "Create and manage teams to organise your users");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const headerActions = useMemo(() => (
    <Button
      data-testid="button-create-team"
      className="bg-primary hover:bg-primary/90 text-white"
      onClick={() => setCreateDialogOpen(true)}
    >
      <Plus className="h-4 w-4 mr-2" />
      Create Team
    </Button>
  ), []);

  usePageActions(headerActions);

  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedMemberRole, setSelectedMemberRole] = useState("member");

  const { data: roleData } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/role"],
  });

  const { data: teams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: roleData?.role === "super_admin" || roleData?.role === "sales_admin",
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: roleData?.role === "super_admin" || roleData?.role === "sales_admin",
  });

  const { data: selectedTeam, isLoading: teamLoading } = useQuery<TeamWithMembers>({
    queryKey: ["/api/teams", selectedTeamId],
    enabled: !!selectedTeamId,
  });

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/teams", "POST", {
        name: newTeamName,
        description: newTeamDescription || null,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Team Created", description: "Your new team has been created successfully." });
      setCreateDialogOpen(false);
      setNewTeamName("");
      setNewTeamDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create team",
        variant: "destructive",
      });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/teams/${selectedTeamId}/members`, "POST", {
        userId: selectedUserId,
        memberRole: selectedMemberRole,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId] });
      toast({ title: "Member Added", description: "Team member has been added successfully." });
      setAddMemberDialogOpen(false);
      setSelectedUserId("");
      setSelectedMemberRole("member");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: number; userId: string }) => {
      await apiRequest(`/api/teams/${teamId}/members/${userId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId] });
      toast({ title: "Member Removed", description: "Team member has been removed." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  const isAdmin = roleData?.role === "super_admin" || roleData?.role === "sales_admin";

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You need admin permissions to access team management.
            </p>
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
        return <Users className="h-4 w-4 text-emerald-500" />;
      default:
        return <Briefcase className="h-4 w-4" />;
    }
  };

  return (
    <main className="w-full px-4 md:px-6 py-6 md:py-10 space-y-6">
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>
              Add a new team to organise your users and prospects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                placeholder="e.g., North Region Team"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                data-testid="input-team-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-description">Description (optional)</Label>
              <Textarea
                id="team-description"
                placeholder="Brief description of this team..."
                value={newTeamDescription}
                onChange={(e) => setNewTeamDescription(e.target.value)}
                data-testid="input-team-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createTeamMutation.mutate()}
              disabled={!newTeamName.trim() || createTeamMutation.isPending}
              data-testid="button-submit-create-team"
            >
              {createTeamMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Teams
              </CardTitle>
              <CardDescription>Select a team to manage members</CardDescription>
            </CardHeader>
            <CardContent>
              {teamsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : teams && teams.length > 0 ? (
                <div className="space-y-2">
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`w-full p-3 rounded-lg text-left transition-colors hover-elevate ${selectedTeamId === team.id
                        ? "bg-primary/10 border-primary border"
                        : "border bg-card hover:bg-muted/50"
                        }`}
                      data-testid={`team-item-${team.id}`}
                    >
                      <div className="font-medium">{team.name}</div>
                      {team.description && (
                        <div className="text-sm text-muted-foreground truncate">
                          {team.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No teams yet. Create your first team to get started.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedTeamId ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle>{selectedTeam?.name || "Loading..."}</CardTitle>
                  <CardDescription>{selectedTeam?.description || "No description"}</CardDescription>
                </div>
                <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-member">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Team Member</DialogTitle>
                      <DialogDescription>Select a user to add to this team.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>User</Label>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger data-testid="select-user">
                            <SelectValue placeholder="Select a user..." />
                          </SelectTrigger>
                          <SelectContent>
                            {usersLoading ? (
                              <SelectItem value="loading" disabled>
                                Loading users...
                              </SelectItem>
                            ) : users && users.length > 0 ? (
                              users
                                .filter(
                                  (u) => !selectedTeam?.members.some((m) => m.userId === u.id)
                                )
                                .map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.firstName || user.email?.split("@")[0]}{" "}
                                    {user.lastName || ""} - {user.email}
                                  </SelectItem>
                                ))
                            ) : (
                              <SelectItem value="no-users" disabled>
                                No users available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Role in Team</Label>
                        <Select value={selectedMemberRole} onValueChange={setSelectedMemberRole}>
                          <SelectTrigger data-testid="select-member-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => addMemberMutation.mutate()}
                        disabled={!selectedUserId || addMemberMutation.isPending}
                        data-testid="button-submit-add-member"
                      >
                        {addMemberMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Add Member
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {teamLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : selectedTeam?.members && selectedTeam.members.length > 0 ? (
                  <div className="space-y-3">
                    {selectedTeam.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-4 p-3 rounded-lg border"
                        data-testid={`team-member-${member.userId}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>
                              {member.user?.firstName?.[0]}
                              {member.user?.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {member.user?.firstName} {member.user?.lastName}
                              {getRoleIcon(member.user?.role)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {member.user?.email}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={member.memberRole === "admin" ? "default" : "secondary"}>
                            {member.memberRole}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              removeMemberMutation.mutate({
                                teamId: selectedTeamId!,
                                userId: member.userId,
                              })
                            }
                            disabled={removeMemberMutation.isPending}
                            data-testid={`button-remove-member-${member.userId}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No members in this team yet. Add members to get started.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Team</h3>
                <p className="text-muted-foreground">
                  Choose a team from the list to view and manage its members.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
