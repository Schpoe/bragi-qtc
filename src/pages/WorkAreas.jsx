import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FolderKanban, Pencil, Trash2, Globe, Users, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import WorkAreaFormDialog from "../components/workareas/WorkAreaFormDialog";

export default function WorkAreas() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: workAreas = [], isLoading } = useQuery({
    queryKey: ["workAreas"],
    queryFn: () => base44.entities.WorkArea.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const createWA = useMutation({
    mutationFn: (data) => base44.entities.WorkArea.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workAreas"] }),
  });

  const updateWA = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorkArea.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workAreas"] }),
  });

  const deleteWA = useMutation({
    mutationFn: (id) => base44.entities.WorkArea.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workAreas"] }),
  });

  const handleSave = (data) => {
    if (editing) {
      updateWA.mutate({ id: editing.id, data });
    } else {
      createWA.mutate(data);
    }
    setEditing(null);
  };

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));

  return (
    <div>
      <PageHeader title="Work Areas" subtitle="Products, Features, Projects & Support">
        <Link to={createPageUrl("JiraImport")}>
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" /> Import from Jira
          </Button>
        </Link>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Work Area
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : workAreas.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No work areas yet" description="Define products, features or projects for capacity planning.">
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create First Work Area
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workAreas.map(wa => (
            <Card key={wa.id} className="group border-border/60 hover:shadow-md transition-all">
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: wa.color || "#3b82f6" }} />
                    <div>
                      <p className="font-medium text-sm">{wa.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{wa.type}</Badge>
                        {wa.is_cross_team ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Cross-team
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="w-3 h-3" /> {teamMap[wa.team_id] || "—"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(wa); setDialogOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteWA.mutate(wa.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <WorkAreaFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workArea={editing}
        teams={teams}
        onSave={handleSave}
        existingTypes={[...new Set(workAreas.map(wa => wa.type))]}
      />
    </div>
  );
}