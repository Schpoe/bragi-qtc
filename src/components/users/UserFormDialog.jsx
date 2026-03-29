import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function UserFormDialog({ open, onOpenChange, user, teams, onSave, currentUserId, isLoading }) {
  const isCreatingNew = !user;
  const [role, setRole] = useState("viewer");
  const [managedTeamIds, setManagedTeamIds] = useState([]);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (user) {
      setRole(user.role || "viewer");
      setManagedTeamIds(user.managed_team_ids || []);
      setEmail(user.email || "");
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setPosition(user.position || "");
      setNewPassword("");
    } else {
      setRole("viewer");
      setManagedTeamIds([]);
      setEmail("");
      setFirstName("");
      setLastName("");
      setPosition("");
      setInitialPassword("");
    }
  }, [user, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation: team managers must have at least one team
    if (role === "team_manager" && managedTeamIds.length === 0) {
      return; // Don't submit if no teams selected
    }
    
    if (user) {
      // Editing existing user - role, position, managed teams, and optionally password
      const data = {
        position,
        role,
        managed_team_ids: role === "team_manager" ? managedTeamIds : []
      };
      if (newPassword) data.password = newPassword;
      onSave(data);
    } else {
      // Creating new user - email, password, name, position, role, and managed teams
      onSave({
        email,
        initial_password: initialPassword,
        first_name: firstName,
        last_name: lastName,
        position,
        role,
        managed_team_ids: role === "team_manager" ? managedTeamIds : []
      });
    }
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
          <DialogTitle>{user ? "Edit User" : "Create User"}</DialogTitle>
          {isCreatingNew && (
            <p className="text-sm text-muted-foreground mt-2">
              Set an initial password the user can change after first login.
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {user ? (
            <>
              <div className="space-y-2">
                <Label>Current User</Label>
                <div className="p-2 bg-muted rounded text-sm">
                  <div className="font-medium">{user.full_name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initial_password">Initial Password *</Label>
                <Input
                  id="initial_password"
                  type="password"
                  placeholder="••••••••"
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    placeholder="Smith"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Job Title</Label>
                <Input
                  id="position"
                  placeholder="e.g. Software Engineer"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                />
              </div>
            </>
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
              <Label>Managed Teams *</Label>
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
              {managedTeamIds.length === 0 && (
                <p className="text-xs text-destructive">Please select at least one team</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || (role === "team_manager" && managedTeamIds.length === 0)}
            >
              {isLoading ? "Saving..." : user ? "Update User" : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}