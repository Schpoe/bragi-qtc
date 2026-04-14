import React, { useState, useMemo } from "react";
import { resolveTypeColor, getWorkAreaColor } from "@/lib/utils";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FolderKanban, Pencil, Trash2, Users, Upload, Search, X, Link as LinkIcon, History, PieChart as PieChartIcon, CalendarRange, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import WorkAreaFormDialog from "../components/workareas/WorkAreaFormDialog";
import JiraImportDialog from "../components/workareas/JiraImportDialog";
import JiraSyncButton from "../components/workareas/JiraSyncButton";
import EpicLinkDialog from "../components/workareas/EpicLinkDialog";
import JiraSyncHistoryTab from "../components/workareas/JiraSyncHistoryTab";
import { useAuth } from "@/lib/AuthContext";
import { canManageWorkAreas, canCreateWorkArea, isViewer, isAdmin, getManageableTeams, canManageAllocations } from "@/lib/permissions";
import { useQuarters } from "@/lib/useQuarters";
import { useSelectedQuarter } from "@/lib/useSelectedQuarter";
import { toast } from "sonner";

// ── Pie chart tooltip ─────────────────────────────────────────────────────────

function TypeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className="rounded-lg border border-border bg-background shadow-md px-3 py-2 text-xs">
      <div className="flex items-center gap-2 font-medium">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
        {name}
      </div>
      <div className="mt-1 text-muted-foreground">{value} work item{value !== 1 ? "s" : ""} ({p.pct}%)</div>
    </div>
  );
}

// ── Distribution panel ────────────────────────────────────────────────────────

function TypeDistributionPanel({ workAreas, workAreaTypes, filterTypeId, onTypeFilter }) {
  const total = workAreas.length;
  if (total === 0) return null;

  // Group by type
  const typeMap = {};
  workAreas.forEach(wa => {
    const key = wa.type || "(no type)";
    if (!typeMap[key]) typeMap[key] = 0;
    typeMap[key]++;
  });

  const pieData = Object.entries(typeMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      value: count,
      color: name === "(no type)" ? "#6b7280" : resolveTypeColor(name, workAreaTypes),
      pct: Math.round((count / total) * 100),
    }));

  return (
    <Card className="border-border/60">
      <CardHeader className="py-3 px-5 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-muted-foreground" />
            Distribution by Type
          </CardTitle>
          <span className="text-xs text-muted-foreground">{total} work item{total !== 1 ? "s" : ""}</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row items-center">
          {/* Pie */}
          <div className="w-full sm:w-1/2 h-56 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  onClick={(d) => onTypeFilter(filterTypeId === d.name ? "all" : d.name)}
                  style={{ cursor: "pointer" }}
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      opacity={filterTypeId !== "all" && filterTypeId !== entry.name ? 0.35 : 1}
                      stroke={filterTypeId === entry.name ? "#000" : "none"}
                      strokeWidth={filterTypeId === entry.name ? 2 : 0}
                    />
                  ))}
                </Pie>
                <Tooltip content={<TypeTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend table */}
          <div className="flex-1 px-4 py-3 w-full">
            <div className="space-y-1.5">
              {pieData.map((d, i) => (
                <button
                  key={i}
                  onClick={() => onTypeFilter(filterTypeId === d.name ? "all" : d.name)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1 rounded text-xs text-left transition-colors ${
                    filterTypeId === d.name
                      ? "bg-muted font-semibold"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="tabular-nums text-muted-foreground ml-auto">{d.value}</span>
                  <span className="tabular-nums text-muted-foreground w-8 text-right">{d.pct}%</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkAreas() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [jiraDialogOpen, setJiraDialogOpen] = useState(false);
  const [epicDialogOpen, setEpicDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [linkingWorkArea, setLinkingWorkArea] = useState(null);
  const [filterTeamId, setFilterTeamId] = useState("all");
  const [filterTypeId, setFilterTypeId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleTab, setRoleTab] = useState("all");
  const [mainTab, setMainTab] = useState("items");
  const queryClient = useQueryClient();

  // Multi-select for "Add to Quarterly Plan" / bulk delete
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTeamId, setAssignTeamId] = useState("");
  const [assignQuarter, setAssignQuarter] = useSelectedQuarter();
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [idsToDelete, setIdsToDelete] = useState([]);

  const { data: workAreas = [], isLoading } = useQuery({
    queryKey: ["workAreas"],
    queryFn: () => bragiQTC.entities.WorkArea.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => bragiQTC.entities.Team.list(),
  });

  const { data: workAreaTypes = [] } = useQuery({
    queryKey: ["workAreaTypes"],
    queryFn: () => bragiQTC.entities.WorkAreaType.list(),
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => bragiQTC.entities.Sprint.list(),
  });

  const { data: workAreaSelections = [] } = useQuery({
    queryKey: ["workAreaSelections"],
    queryFn: () => bragiQTC.entities.QuarterlyWorkAreaSelection.list(),
  });

  const quarters = useQuarters(sprints, { includeRange: true });
  const manageableTeams = getManageableTeams(user, teams);

  const assignToQuarterlyPlan = useMutation({
    mutationFn: async ({ teamId, quarter, workAreaIds }) => {
      const existing = workAreaSelections.find(s => s.team_id === teamId && s.quarter === quarter);
      const merged = [...new Set([...(existing?.work_area_ids || []), ...workAreaIds])];
      if (existing) {
        return bragiQTC.entities.QuarterlyWorkAreaSelection.update(existing.id, { work_area_ids: merged });
      }
      return bragiQTC.entities.QuarterlyWorkAreaSelection.create({ team_id: teamId, quarter, work_area_ids: merged });
    },
    onSuccess: (_, { quarter, teamId }) => {
      queryClient.invalidateQueries({ queryKey: ["workAreaSelections"] });
      const team = teams.find(t => t.id === teamId);
      toast.success(`Added ${selectedIds.size} work item${selectedIds.size !== 1 ? "s" : ""} to ${team?.name} — ${quarter}`);
      setSelectedIds(new Set());
      setAssignDialogOpen(false);
    },
    onError: (err) => toast.error("Failed to assign: " + err.message),
  });

  const handleAssignConfirm = () => {
    if (!assignTeamId || !assignQuarter) return;
    assignToQuarterlyPlan.mutate({ teamId: assignTeamId, quarter: assignQuarter, workAreaIds: Array.from(selectedIds) });
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const createWA = useMutation({
    mutationFn: (data) => bragiQTC.entities.WorkArea.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workAreas"] }),
  });

  const updateWA = useMutation({
    mutationFn: ({ id, data }) => bragiQTC.entities.WorkArea.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workAreas"] }),
  });

  const deleteWA = useMutation({
    mutationFn: (id) => bragiQTC.entities.WorkArea.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workAreas"] });
      toast.success("Work item deleted");
    },
    onError: (err) => toast.error("Failed to delete work item: " + err.message),
  });

  const bulkDeleteWA = useMutation({
    mutationFn: (ids) => Promise.all(ids.map(id => bragiQTC.entities.WorkArea.delete(id))),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["workAreas"] });
      toast.success(`${ids.length} work item${ids.length !== 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
    },
    onError: (err) => toast.error("Failed to delete work items: " + err.message),
  });

  const handleBulkDeleteRequest = (ids) => {
    setIdsToDelete(ids);
    setBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = () => {
    bulkDeleteWA.mutate(idsToDelete);
    setBulkDeleteConfirmOpen(false);
  };

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

  const isLeading    = (wa) => wa.leading_team_id === filterTeamId;
  const isSupporting = (wa) => (wa.supporting_team_ids || []).includes(filterTeamId);
  const isOther      = (wa) => !isLeading(wa) && !isSupporting(wa);

  const tabCounts = filterTeamId === "all" ? null : {
    all: workAreas.length,
    leading: workAreas.filter(isLeading).length,
    supporting: workAreas.filter(isSupporting).length,
    other: workAreas.filter(isOther).length,
  };

  // Step 1: filter by role
  let filteredByRole = workAreas;
  if (filterTeamId !== "all") {
    if (roleTab === "leading") filteredByRole = workAreas.filter(isLeading);
    else if (roleTab === "supporting") filteredByRole = workAreas.filter(isSupporting);
    else if (roleTab === "other") filteredByRole = workAreas.filter(isOther);
  }

  // Step 2: filter by search — this is the pool shown in the pie chart
  const filteredBySearch = filteredByRole.filter(wa =>
    wa.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (wa.type || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (wa.jira_key || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (wa.prod_id || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Step 3: filter by type (applied after pie chart, so pie always shows full distribution)
  const filteredWorkAreas = filterTypeId === "all"
    ? filteredBySearch
    : filteredBySearch.filter(wa => (wa.type || "(no type)") === filterTypeId);

  // Unique types in current search-filtered set (for the type dropdown)
  const availableTypes = useMemo(() => {
    const names = [...new Set(filteredBySearch.map(wa => wa.type || "(no type)"))].sort();
    return names;
  }, [filteredBySearch]);

  const handleEpicLinked = () => {
    queryClient.invalidateQueries({ queryKey: ["workAreas"] });
  };

  if (isViewer(user)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
          <FolderKanban className="w-7 h-7 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Access Restricted</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">Viewers don't have access to Work Items.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Work Items" subtitle="Products, Features, Projects & Support">
        {canCreateWorkArea(user) && (
          <>
            <JiraSyncButton />
            <Button variant="outline" onClick={() => setJiraDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Import from Jira
            </Button>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> New Work Item
            </Button>
          </>
        )}
      </PageHeader>

      <Tabs value={mainTab} onValueChange={setMainTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="items" className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4" /> Work Items
          </TabsTrigger>
          {canCreateWorkArea(user) && (
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" /> Sync History
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="items" className="mt-6">
          <div className="mb-6 space-y-4">
            {/* Search, Team, and Type filters */}
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
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.filter(t => t.is_active !== false).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTypeId} onValueChange={setFilterTypeId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {availableTypes.map(name => (
                    <SelectItem key={name} value={name}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: name === "(no type)" ? "#6b7280" : resolveTypeColor(name, workAreaTypes) }}
                        />
                        {name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filterTypeId !== "all" && (
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setFilterTypeId("all")}>
                  <X className="w-3.5 h-3.5" /> Clear type
                </Button>
              )}
            </div>

            {/* Role Tabs (only visible when team is selected) */}
            {filterTeamId !== "all" && (
              <Tabs value={roleTab} onValueChange={setRoleTab} className="w-full">
                <TabsList className="grid w-fit grid-cols-4">
                  <TabsTrigger value="all">All {tabCounts && <span className="ml-1 text-xs opacity-70">({tabCounts.all})</span>}</TabsTrigger>
                  <TabsTrigger value="leading">Leading {tabCounts && <span className="ml-1 text-xs opacity-70">({tabCounts.leading})</span>}</TabsTrigger>
                  <TabsTrigger value="supporting">Supporting {tabCounts && <span className="ml-1 text-xs opacity-70">({tabCounts.supporting})</span>}</TabsTrigger>
                  <TabsTrigger value="other">Other {tabCounts && <span className="ml-1 text-xs opacity-70">({tabCounts.other})</span>}</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* Type distribution pie chart */}
            {filteredBySearch.length > 0 && availableTypes.length > 1 && (
              <TypeDistributionPanel
                workAreas={filteredBySearch}
                workAreaTypes={workAreaTypes}
                filterTypeId={filterTypeId}
                onTypeFilter={setFilterTypeId}
              />
            )}

            {/* Result count + select all */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{filteredWorkAreas.length}</span> work item{filteredWorkAreas.length !== 1 ? "s" : ""}
                {filterTypeId !== "all" && (
                  <span className="ml-1">
                    in{" "}
                    <span
                      className="font-medium rounded px-1.5 py-0.5 text-white"
                      style={{ backgroundColor: resolveTypeColor(filterTypeId, workAreaTypes) }}
                    >
                      {filterTypeId}
                    </span>
                  </span>
                )}
              </span>
              {isAdmin(user) && filteredWorkAreas.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-0.5 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    const allIds = filteredWorkAreas.map(wa => wa.id);
                    const allSelected = allIds.every(id => selectedIds.has(id));
                    if (allSelected) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(allIds));
                    }
                  }}
                >
                  <CheckSquare className="w-3.5 h-3.5 mr-1" />
                  {filteredWorkAreas.every(wa => selectedIds.has(wa.id)) ? "Deselect all" : "Select all"}
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : filteredWorkAreas.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title={filterTeamId === "all" && filterTypeId === "all" ? "No work items yet" : "No matching work items"}
              description={filterTeamId === "all" && filterTypeId === "all" ? "Define products, features or projects for capacity planning." : "Try adjusting the filters."}
            >
              {canCreateWorkArea(user) && filterTeamId === "all" && filterTypeId === "all" && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create First Work Item
                </Button>
              )}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWorkAreas.map(wa => {
                const canManage = canManageWorkAreas(user, wa);
                const typeColor = resolveTypeColor(wa.type, workAreaTypes);
                const dotColor = getWorkAreaColor(wa, workAreaTypes);
                const isSelected = selectedIds.has(wa.id);
                const canAssign = manageableTeams.length > 0 || isAdmin(user);

                return (
                  <Card key={wa.id} className={`group border-border/60 hover:shadow-md transition-all ${isSelected ? "ring-2 ring-primary border-primary/40" : ""}`}>
                    <CardContent className="py-4 px-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {canAssign && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(wa.id)}
                              className={`shrink-0 transition-opacity ${isSelected || selectedIds.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{wa.name}</p>
                              {wa.prod_id && (
                                <Badge variant="outline" className="text-xs">{wa.prod_id}</Badge>
                              )}
                              {wa.jira_key && wa.jira_key !== wa.prod_id && (
                                <Badge variant="outline" className="text-xs">{wa.jira_key}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {wa.type && (
                                <span
                                  className="inline-flex items-center text-xs rounded-full px-2 py-0.5 font-medium border"
                                  style={{
                                    backgroundColor: typeColor + "20",
                                    borderColor: typeColor + "60",
                                    color: typeColor,
                                  }}
                                >
                                  {wa.type}
                                </span>
                              )}
                              <Badge className="text-xs bg-primary/20 text-primary border-0">
                                <Users className="w-3 h-3 mr-1" /> {teamMap[wa.leading_team_id] || "—"}
                              </Badge>
                              {wa.supporting_team_ids && wa.supporting_team_ids.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  + {wa.supporting_team_ids.map(id => teamMap[id]).filter(Boolean).join(", ")}
                                </span>
                              )}
                            </div>
                            {wa.jira_status && (
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-muted-foreground">Status: {wa.jira_status}</span>
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[100px]">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${wa.jira_progress || 0}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{wa.jira_progress || 0}%</span>
                              </div>
                            )}
                            {wa.linked_epic_keys && wa.linked_epic_keys.length > 0 && (
                              <div className="flex items-center gap-1 mt-2 flex-wrap">
                                {wa.linked_epic_keys.map(key => (
                                  <Badge key={key} variant="secondary" className="text-xs">{key}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {canManage && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Link Jira Epics"
                                onClick={() => { setLinkingWorkArea(wa); setEpicDialogOpen(true); }}
                              >
                                <LinkIcon className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(wa); setDialogOpen(true); }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {isAdmin(user) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleBulkDeleteRequest([wa.id])}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {canCreateWorkArea(user) && (
          <TabsContent value="history" className="mt-6">
            <JiraSyncHistoryTab />
          </TabsContent>
        )}
      </Tabs>

      {/* ── Floating selection bar ───────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border shadow-xl rounded-full px-5 py-3">
          <span className="text-sm font-medium">{selectedIds.size} work item{selectedIds.size !== 1 ? "s" : ""} selected</span>
          {manageableTeams.length > 0 && (
            <Button size="sm" className="gap-2 rounded-full" onClick={() => { setAssignTeamId(manageableTeams.length === 1 ? manageableTeams[0].id : ""); setAssignDialogOpen(true); }}>
              <CalendarRange className="w-4 h-4" /> Add to Quarterly Plan
            </Button>
          )}
          {isAdmin(user) && (
            <Button size="sm" variant="destructive" className="gap-2 rounded-full" onClick={() => handleBulkDeleteRequest(Array.from(selectedIds))}>
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setSelectedIds(new Set())}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ── Assign to quarterly plan dialog ─────────────────────────────────── */}
      <Dialog open={assignDialogOpen} onOpenChange={(o) => { setAssignDialogOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="w-5 h-5" /> Add to Quarterly Plan
            </DialogTitle>
            <DialogDescription>
              Add {selectedIds.size} selected work item{selectedIds.size !== 1 ? "s" : ""} to a team's quarterly plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={assignTeamId} onValueChange={setAssignTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team…" />
                </SelectTrigger>
                <SelectContent>
                  {manageableTeams.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quarter</Label>
              <Select value={assignQuarter} onValueChange={setAssignQuarter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quarters.map(q => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignConfirm} disabled={!assignTeamId || !assignQuarter || assignToQuarterlyPlan.isPending}>
              {assignToQuarterlyPlan.isPending ? "Adding…" : "Add to Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <EpicLinkDialog
        open={epicDialogOpen}
        onOpenChange={setEpicDialogOpen}
        workArea={linkingWorkArea}
        onLinked={handleEpicLinked}
      />

      {/* ── Bulk delete confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {idsToDelete.length} work item{idsToDelete.length !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {idsToDelete.length === 1 ? "this work item" : `these ${idsToDelete.length} work items`}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmBulkDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
