import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isAdmin } from "@/lib/permissions";
import { toast } from "sonner";

export default function ImpersonateUserDialog({ open, onOpenChange }) {
  const { user, impersonateUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: open && isAdmin(user)
  });

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleImpersonate = async (targetUser) => {
    const success = await impersonateUser(targetUser.email);
    if (success) {
      toast.success(`Now impersonating ${targetUser.full_name || targetUser.email}`);
      onOpenChange(false);
    } else {
      toast.error("Failed to impersonate user");
    }
  };

  if (!isAdmin(user)) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Impersonate User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search users</Label>
            <Input
              id="search"
              placeholder="Enter email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <ScrollArea className="h-64 border rounded-md">
            <div className="p-4 space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
              ) : (
                filteredUsers.map(u => (
                  <Button
                    key={u.id}
                    variant="ghost"
                    className="w-full justify-start text-left h-auto py-2"
                    onClick={() => handleImpersonate(u)}
                  >
                    <div>
                      <div className="font-medium text-sm">{u.full_name || u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}