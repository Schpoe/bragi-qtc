import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FolderKanban, Pencil, Trash2, Globe, Users, Upload, Filter, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import WorkAreaFormDialog from "../components/workareas/WorkAreaFormDialog";
import JiraImportDialog from "../components/workareas/JiraImportDialog";

export default function WorkAreas() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [jiraDialogOpen, setJiraDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterTeamId, setFilterTeamId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleTab, setRoleTab] = useState("all");
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
    setDialogOpen(false);
    setEditing(null);
  };

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));

  // Filter by team
  let filteredByTeam = filterTeamId === "all"
    ? workAreas
    : workAreas.filter(wa => wa.leading_team_id === filterTeamId || (wa.supporting_team_ids || []).includes(filterTeamId));

  // Filter by role (All, Leading, Supporting, Other)
  let filteredByRole = filteredByTeam;
  if (filterTeamId !== "all") {
    if (roleTab === "leading") {
      filteredByRole = filteredByTeam.filter(wa => wa.leading_team_id === filterTeamId);
    } else if (roleTab === "supporting") {
      filteredByRole = filteredByTeam.filter(wa => (wa.supporting_team_ids || []).includes(filterTeamId));
    } else if (roleTab === "other") {
      filteredByRole = filteredByTeam.filter(wa => 
        wa.leading_team_id !== filterTeamId && !(wa.supporting_team_ids || []).includes(filterTeamId)
      );
    }
  }

  // Filter by search query
  const filteredWorkAreas = filteredByRole.filter(wa =>
    wa.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wa.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Work Items" subtitle="Products, Features, Projects & Support">
         <Button variant="outline" onClick={() => setJiraDialogOpen(true)}>
           <Upload className="w-4 h-4 mr-2" /> Import from Jira
         </Button>
         <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
           <Plus className="w-4 h-4 mr-2" /> New Work Item
         </Button>
      </PageHeader>

      <div className="mb-6 space-y-4">
        {/* Search and Team Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
               placeholder="Search work items..."
               className="pl-9"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Select value={filterTeamId} onValueChange={(val) => { setFilterTeamId(val); setRoleTab("all"); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Role Tabs (only visible when team is selected) */}
        {filterTeamId !== "all" && (
          <Tabs value={roleTab} onValueChange={setRoleTab} className="w-full">
            <TabsList className="grid w-fit grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="leading">Leading</TabsTrigger>
              <TabsTrigger value="supporting">Supporting</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Counters */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-semibold text-foreground">{filteredWorkAreas.length}</span> work item{filteredWorkAreas.length !== 1 ? 's' : ''}
          </div>
          <div>
            <span className="font-semibold text-foreground">{new Set(filteredWorkAreas.map(wa => wa.type)).size}</span> type{new Set(filteredWorkAreas.map(wa => wa.type)).size !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filteredWorkAreas.length === 0 ? (
        <EmptyState icon={FolderKanban} title={filterTeamId === "all" ? "No work items yet" : "No work items for this team"} description={filterTeamId === "all" ? "Define products, features or projects for capacity planning." : "Try selecting a different team or create a new work item."}>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create First Work Item
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkAreas.map(wa => (
            <Card key={wa.id} className="group border-border/60 hover:shadow-md transition-all">
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: wa.color || "#3b82f6" }} />
                    <div>
                      <p className="font-medium text-sm">{wa.name}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{wa.type}</Badge>
                        <Badge className="text-xs bg-primary/20 text-primary border-0">
                          <Users className="w-3 h-3 mr-1" /> {teamMap[wa.leading_team_id] || "—"}
                        </Badge>
                        {wa.supporting_team_ids && wa.supporting_team_ids.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            + {wa.supporting_team_ids.map(id => teamMap[id]).filter(Boolean).join(", ")}
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
      />

      <JiraImportDialog
        open={jiraDialogOpen}
        onOpenChange={setJiraDialogOpen}
        teams={teams}
      />
    </div>
  );
}