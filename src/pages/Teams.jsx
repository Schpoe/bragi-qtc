import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import TeamCard from "../components/teams/TeamCard";
import TeamFormDialog from "../components/teams/TeamFormDialog";
import TeamDetail from "../components/teams/TeamDetail";

export default function Teams() {
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const queryClient = useQueryClient();

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: () => base44.entities.TeamMember.list(),
  });

  const createTeam = useMutation({
    mutationFn: (data) => base44.entities.Team.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teams"] }),
  });

  const updateTeam = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Team.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teams"] }),
  });

  const deleteTeam = useMutation({
    mutationFn: (id) => base44.entities.Team.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teams"] }),
  });

  const handleSaveTeam = (data) => {
    if (editingTeam) {
      updateTeam.mutate({ id: editingTeam.id, data });
    } else {
      createTeam.mutate(data);
    }
    setEditingTeam(null);
  };

  if (selectedTeam) {
    const team = teams.find(t => t.id === selectedTeam);
    if (!team) { setSelectedTeam(null); return null; }
    const teamMembers = members.filter(m => m.team_id === team.id);
    return (
      <TeamDetail team={team} members={teamMembers} onBack={() => setSelectedTeam(null)} />
    );
  }

  return (
    <div>
      <PageHeader title="Teams" subtitle="Verwalte deine Teams und Mitglieder">
        <Button onClick={() => { setEditingTeam(null); setTeamDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Neues Team
        </Button>
      </PageHeader>

      {teamsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : teams.length === 0 ? (
        <EmptyState icon={Users} title="Noch keine Teams" description="Erstelle dein erstes Team, um mit der Planung zu beginnen.">
          <Button onClick={() => setTeamDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Erstes Team erstellen
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              members={members.filter(m => m.team_id === team.id)}
              onEdit={(t) => { setEditingTeam(t); setTeamDialogOpen(true); }}
              onDelete={(t) => deleteTeam.mutate(t.id)}
              onClick={() => setSelectedTeam(team.id)}
            />
          ))}
        </div>
      )}

      <TeamFormDialog
        open={teamDialogOpen}
        onOpenChange={setTeamDialogOpen}
        team={editingTeam}
        onSave={handleSaveTeam}
      />
    </div>
  );
}