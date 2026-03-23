import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Shield, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import UserFormDialog from "../components/users/UserFormDialog";
import ConfirmDeleteDialog from "../components/shared/ConfirmDeleteDialog";
import PasswordResetInfo from "../components/auth/PasswordResetInfo";
import { isAdmin } from "@/lib/permissions";

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  // Apply pending team assignments on mount
  React.useEffect(() => {
    const applyPendingTeams = async () => {
      try {
        const response = await base44.functions.invoke('applyPendingTeams', {});
        if (response.data?.applied) {
          queryClient.invalidateQueries({ queryKey: ["users"] });
          toast.success("Team assignments have been applied to your account");
        }
      } catch (error) {
        console.error("Failed to apply pending teams:", error);
      }
    };
    applyPendingTeams();
  }, []);

  const createUser = useMutation({
    mutationFn: async (data) => {
      // Use backend function to invite user and store pending team assignments
      const response = await base44.functions.invoke('inviteUserWithTeams', {
        email: data.email,
        role: data.role,
        managed_team_ids: data.managed_team_ids || []
      });
      
      // Check if the response contains an error
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
      setUserDialogOpen(false);
      toast.success("Invitation sent! Teams will be assigned when the user accepts.");
    },
    onError: (error) => {
      toast.error("Failed to send invitation: " + (error.response?.data?.error || error.message));
    }
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
      setUserDialogOpen(false);
      // If updating the current user, refresh auth context to sync managed_team_ids
      if (currentUser?.id === editingUser?.id) {
        window.location.reload();
      }
      toast.success("User updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update user: " + error.message);
    }
  });

  const deleteUser = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted successfully");
    },
  });

  const handleSaveUser = (data) => {
    if (editingUser) {
      updateUser.mutate({ id: editingUser.id, data });
    } else {
      createUser.mutate(data);
    }
  };

  const getRoleBadge = (role) => {
    if (role === "admin") return <Badge className="bg-red-500 text-white"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
    if (role === "team_manager") return <Badge className="bg-blue-500 text-white"><UserCog className="w-3 h-3 mr-1" />Team Manager</Badge>;
    return <Badge variant="secondary">Viewer</Badge>;
  };

  if (!isAdmin(currentUser)) {
    return (
      <div className="flex items-center justify-center h-96">
        <EmptyState
          icon={Shield}
          title="Access Denied"
          description="You need administrator privileges to access user management."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="User Management" subtitle="Manage users, roles, and permissions">
        <Button onClick={() => { setEditingUser(null); setUserDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </PageHeader>

      <div className="mb-6">
        <PasswordResetInfo />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users yet"
          description="Add users to get started."
        >
          <Button onClick={() => { setEditingUser(null); setUserDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add First User
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {users.map(user => (
            <Card key={user.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}` 
                          : user.full_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.position && (
                        <p className="text-xs text-muted-foreground">{user.position}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRoleBadge(user.role)}
                    <Link to={`/UserProfile?userId=${user.id}`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Edit profile"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </Link>
                    {user.id !== currentUser.id && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingUser(user);
                            setUserDialogOpen(true);
                          }}
                          title="Edit role and permissions"
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteUserId(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              {user.role === "team_manager" && user.managed_team_ids?.length > 0 && (
                <CardContent className="pt-0">
                  <div className="text-xs text-muted-foreground mb-1">Manages teams:</div>
                  <div className="flex flex-wrap gap-1">
                    {user.managed_team_ids.map(teamId => {
                      const team = teams.find(t => t.id === teamId);
                      return team ? (
                        <Badge key={teamId} variant="outline" className="text-xs">
                          {team.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <UserFormDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        user={editingUser}
        teams={teams}
        onSave={handleSaveUser}
        currentUserId={currentUser?.id}
        isLoading={createUser.isPending || updateUser.isPending}
      />

      <ConfirmDeleteDialog
        open={deleteUserId !== null}
        title="Delete User?"
        description="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={() => {
          deleteUser.mutate(deleteUserId);
          setDeleteUserId(null);
        }}
        onCancel={() => setDeleteUserId(null)}
        isLoading={deleteUser.isPending}
      />
    </div>
  );
}