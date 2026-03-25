import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import DisciplineBadge from "../shared/DisciplineBadge";
import EmptyState from "../shared/EmptyState";
import MemberFormDialog from "./MemberFormDialog";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { canManageTeamMembers } from "@/lib/permissions";

export default function TeamDetail({ team, members, onBack }) {
  const { user } = useAuth();
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const queryClient = useQueryClient();
  
  const canManage = canManageTeamMembers(user, team.id);

  const createMember = useMutation({
    mutationFn: (data) => base44.entities.TeamMember.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teamMembers"] }),
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TeamMember.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teamMembers"] }),
  });

  const deleteMember = useMutation({
    mutationFn: (id) => base44.entities.TeamMember.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teamMembers"] }),
  });

  const handleSaveMember = (data) => {
    if (editingMember) {
      updateMember.mutate({ id: editingMember.id, data });
    } else {
      createMember.mutate(data);
    }
    setEditingMember(null);
  };

  return (
    <div>
      <Button variant="ghost" className="mb-4 -ml-2" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{team.name}</h2>
          {team.description && <p className="text-sm text-muted-foreground mt-0.5">{team.description}</p>}
        </div>
        {canManage && (
          <Button onClick={() => { setEditingMember(null); setMemberDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Member
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="Add team members to start planning."
        />
      ) : (
        <div className="grid gap-3">
          {members.map(member => (
            <Card key={member.id} className="border-border/60">
              <CardContent className="flex items-center justify-between py-4 px-5">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.availability_percent || 100}% available</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DisciplineBadge discipline={member.discipline} />
                  {canManage && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingMember(member); setMemberDialogOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMember.mutate(member.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MemberFormDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        member={editingMember}
        teamId={team.id}
        onSave={handleSaveMember}
      />
    </div>
  );
}