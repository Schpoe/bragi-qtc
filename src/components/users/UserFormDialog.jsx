import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function UserFormDialog({ open, onOpenChange, user, teams, onSave, currentUserId }) {
  const [role, setRole] = useState("viewer");
  const [managedTeamIds, setManagedTeamIds] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    if (user) {
      setRole(user.role || "viewer");
      setManagedTeamIds(user.managed_team_ids || []);
      setInviteEmail("");
    } else {
      setRole("viewer");
      setManagedTeamIds([]);
      setInviteEmail("");
    }
  }, [user, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      role,
      managed_team_ids: role === "team_manager" ? managedTeamIds : []
    };
    onSave(data);
  };

  const toggleTeam = (teamId) => {
    setManagedTeamIds(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const isEditingCurrentUser = user?.id === currentUserId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "Edit User Role" : "Invite User"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {user ? (
            <div className="space-y-2">
              <Label>User</Label>
              <div className="p-2 bg-muted rounded text-sm">
                <div className="font-medium">{user.full_name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={role} 
              onValueChange={setRole}
              disabled={isEditingCurrentUser}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="team_manager">Team Manager</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            {isEditingCurrentUser && (
              <p className="text-xs text-muted-foreground">You cannot change your own role</p>
            )}
          </div>

          {role === "team_manager" && teams.length > 0 && (
            <div className="space-y-2">
              <Label>Managed Teams</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {teams.map(team => (
                  <div key={team.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`team-${team.id}`}
                      checked={managedTeamIds.includes(team.id)}
                      onCheckedChange={() => toggleTeam(team.id)}
                    />
                    <label
                      htmlFor={`team-${team.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {team.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {user ? "Update" : "Invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}