import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "../components/shared/PageHeader";
import { toast } from "sonner";

export default function UserProfile() {
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    position: ""
  });
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  // If user is admin and viewing from UserManagement, they can pass userId via URL params
  const urlParams = new URLSearchParams(window.location.search);
  const editUserId = urlParams.get('userId');
  const viewingOwnProfile = !editUserId;

  const userId = editUserId || currentUser?.id;

  const { data: user, isLoading } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => base44.entities.User.filter({ id: userId }).then(users => users[0]),
    enabled: !!userId
  });

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        position: user.position || ""
      });
    }
  }, [user]);

  const updateUser = useMutation({
    mutationFn: (data) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsEditing(false);
      toast.success("Profile updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update profile: " + error.message);
    }
  });

  const handleSave = () => {
    updateUser.mutate(formData);
  };

  // Check permissions
  const canEdit = viewingOwnProfile || (currentUser?.role === 'admin');

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <div>
      <PageHeader 
        title="User Profile" 
        subtitle={viewingOwnProfile ? "Update your personal information" : `Edit ${user.full_name || user.email}`}
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Display Info */}
          <div className="space-y-4 pb-6 border-b">
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <p className="text-sm font-medium capitalize">{user.role?.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                disabled={!canEdit || !isEditing}
                placeholder="Enter first name"
              />
            </div>

            <div>
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                disabled={!canEdit || !isEditing}
                placeholder="Enter last name"
              />
            </div>

            <div>
              <Label htmlFor="position">Job Title</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                disabled={!canEdit || !isEditing}
                placeholder="Enter job title"
              />
            </div>
          </div>

          {/* Action Buttons */}
          {canEdit && (
            <div className="flex gap-3 pt-4 border-t">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button 
                    onClick={handleSave}
                    disabled={updateUser.isPending}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        first_name: user.first_name || "",
                        last_name: user.last_name || "",
                        position: user.position || ""
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}