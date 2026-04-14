import React, { useMemo, useState, useEffect, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canManageAllocations } from "@/lib/permissions";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { bragiQTC } from "@/api/bragiQTCClient";
import EmptyState from "@/components/shared/EmptyState";
import { Users, Settings2 } from "lucide-react";
import DisciplineBadge from "../shared/DisciplineBadge.jsx";
import AllocationCell from "./AllocationCell";
import QuarterlyAllocationDialog from "./QuarterlyAllocationDialog";
import { cn, getWorkAreaColor } from "@/lib/utils";

const DEFAULT_CAPACITY = 60;

export default function QuarterlyAllocationTable({
  members,
  workAreas,
  allocations,
  quarter,
  onAllocationChange,
  selectedTeamId,
  onSelectionChange,
  initialSelectedWorkAreaIds = new Set()
}) {
  const [selectedWorkAreaIds, setSelectedWorkAreaIds] = useState(() => new Set(initialSelectedWorkAreaIds));
  const [dialogOpen, setDialogOpen] = useState(false);
  const allocationTimeoutRef = useRef({});
  const capacityTimeoutRef = useRef({});
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const relevantTeamId = selectedTeamId === "all" ? members[0]?.team_id : selectedTeamId;
  const canEdit = relevantTeamId && canManageAllocations(user, relevantTeamId);

  // Load initial plan snapshot for diff view
  const { data: snapshots = [] } = useQuery({
    queryKey: ["quarterlyPlanSnapshots", quarter, relevantTeamId],
    queryFn: () => bragiQTC.entities.QuarterlyPlanSnapshot.filter({ quarter, team_id: relevantTeamId }),
    enabled: !!(quarter && relevantTeamId),
  });
  const initialPlanAllocations = useMemo(() => {
    const snap = snapshots.find(s => s.is_initial_plan);
    return snap ? (Array.isArray(snap.allocations) ? snap.allocations : []) : null;
  }, [snapshots]);

  // Build lookup: { memberId: { workAreaId: days } }
  const initialPlanMap = useMemo(() => {
    if (!initialPlanAllocations) return null;
    const map = {};
    initialPlanAllocations.forEach(a => {
      if (!map[a.team_member_id]) map[a.team_member_id] = {};
      map[a.team_member_id][a.work_area_id] = a.days || 0;
    });
    return map;
  }, [initialPlanAllocations]);

  // Sync local state when parent updates initialSelectedWorkAreaIds
  useEffect(() => {
    setSelectedWorkAreaIds(new Set(initialSelectedWorkAreaIds));
  }, [initialSelectedWorkAreaIds]);

  // Fetch per-member quarterly capacities
  const { data: memberCapacities = [] } = useQuery({
    queryKey: ["teamMemberCapacities", quarter],
    queryFn: () => bragiQTC.entities.TeamMemberCapacity.filter({ quarter }),
    enabled: !!quarter,
  });

  const capacityMap = useMemo(() => {
    const map = {};
    memberCapacities.forEach(c => { map[c.team_member_id] = c; });
    return map;
  }, [memberCapacities]);

  const updateCapacity = useMutation({
    mutationFn: async ({ memberId, working_days }) => {
      const existing = capacityMap[memberId];
      if (existing) {
        return bragiQTC.entities.TeamMemberCapacity.update(existing.id, { working_days });
      } else {
        return bragiQTC.entities.TeamMemberCapacity.create({ team_member_id: memberId, quarter, working_days });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teamMemberCapacities", quarter] }),
  });

  const handleCapacityChange = (memberId, value) => {
    const key = `cap-${memberId}`;
    if (capacityTimeoutRef.current[key]) clearTimeout(capacityTimeoutRef.current[key]);
    capacityTimeoutRef.current[key] = setTimeout(() => {
      const days = Math.max(1, Number(value) || DEFAULT_CAPACITY);
      updateCapacity.mutate({ memberId, working_days: days });
      delete capacityTimeoutRef.current[key];
    }, 500);
  };

  const relevantMembers = selectedTeamId === "all"
    ? members
    : members.filter(m => m.team_id === selectedTeamId);

  const allRelevantWorkAreas = selectedTeamId === "all"
    ? workAreas
    : workAreas.filter(wa => wa.is_cross_team || wa.leading_team_id === selectedTeamId || wa.supporting_team_ids.includes(selectedTeamId));

  const relevantWorkAreas = workAreas.filter(wa => selectedWorkAreaIds.has(wa.id));

  const teamId = relevantTeamId;
  const leadingWAs = relevantWorkAreas.filter(wa => wa.leading_team_id === teamId);
  const supportingWAs = relevantWorkAreas.filter(wa => wa.supporting_team_ids?.includes(teamId) && wa.leading_team_id !== teamId);
  const otherWAs = relevantWorkAreas.filter(wa => wa.leading_team_id !== teamId && !wa.supporting_team_ids?.includes(teamId));
  const groupedWAs = [...leadingWAs, ...supportingWAs, ...otherWAs];
  const hasGroups = [leadingWAs, supportingWAs, otherWAs].filter(g => g.length > 0).length > 1;

  const getGroupBorder = (wa) => {
    if (wa === leadingWAs[0]) return "border-l-2 border-primary/30";
    if (wa === supportingWAs[0]) return "border-l-2 border-amber-300";
    if (wa === otherWAs[0]) return "border-l-2 border-slate-300";
    return "";
  };

  const quarterAllocations = allocations.filter(a => a.quarter === quarter);

  const memberAllocations = useMemo(() => {
    return relevantMembers.map(member => {
      const memberAllocs = quarterAllocations.filter(a => a.team_member_id === member.id);
      const totalDays = memberAllocs.reduce((sum, a) => sum + (a.days || 0), 0);
      const capacity = capacityMap[member.id]?.working_days ?? DEFAULT_CAPACITY;
      const totalPercent = capacity > 0 ? Math.round(totalDays / capacity * 100) : 0;

      return {
        member,
        allocations: memberAllocs,
        totalDays,
        capacity,
        totalPercent,
        isOverAllocated: totalDays > capacity
      };
    });
  }, [relevantMembers, quarterAllocations, capacityMap]);

  const handleWorkAreaSelectionChange = (selected) => {
    const newIds = selected instanceof Set ? selected : new Set(selected);
    setSelectedWorkAreaIds(newIds);
    if (onSelectionChange) {
      onSelectionChange(Array.from(newIds));
    }
  };

  if (relevantMembers.length === 0 || allRelevantWorkAreas.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No data available"
        description="Add team members and work items to start planning allocations."
      />
    );
  }

  if (selectedWorkAreaIds.size === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Work Items</h4>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Settings2 className="w-4 h-4 mr-2" />
              Select Work Items
            </Button>
          )}
        </div>
        <EmptyState
          icon={Users}
          title="No work items selected"
          description="Click 'Select Work Items' to choose which areas to allocate."
        />
        <QuarterlyAllocationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          quarter={quarter}
          teamId={selectedTeamId}
          onConfirm={handleWorkAreaSelectionChange}
          initialSelectedIds={selectedWorkAreaIds}
        />
      </div>
    );
  }

  const rowSpan = hasGroups ? 2 : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold text-foreground">Work Items Allocation</h4>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Select Work Items
          </Button>
        )}
      </div>

      {/* Desktop: Table view */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-primary/5 border-b-2 border-primary/20">
            {hasGroups && (
              <TableRow className="border-b-0">
                <TableHead className="sticky left-0 z-20 bg-white font-semibold text-primary min-w-[180px] border-r" rowSpan={rowSpan}>Team Member</TableHead>
                <TableHead className="text-xs text-center font-semibold text-primary min-w-[70px] sticky left-[180px] z-20 bg-white border-r" rowSpan={rowSpan}>Capacity</TableHead>
                <TableHead className="text-xs text-center font-semibold text-primary min-w-[110px] sticky left-[250px] z-20 bg-white border-r" rowSpan={rowSpan}>Allocated</TableHead>
                {leadingWAs.length > 0 && (
                  <TableHead colSpan={leadingWAs.length} className="text-center text-xs font-semibold bg-primary/10 text-primary border-l-2 border-primary/30 py-1">
                    Leading
                  </TableHead>
                )}
                {supportingWAs.length > 0 && (
                  <TableHead colSpan={supportingWAs.length} className="text-center text-xs font-semibold bg-amber-50 text-amber-700 border-l-2 border-amber-300 py-1">
                    Supporting
                  </TableHead>
                )}
                {otherWAs.length > 0 && (
                  <TableHead colSpan={otherWAs.length} className="text-center text-xs font-semibold bg-muted/60 text-muted-foreground border-l-2 border-slate-300 py-1">
                    Other
                  </TableHead>
                )}
              </TableRow>
            )}
            <TableRow>
              {!hasGroups && <TableHead className="sticky left-0 z-20 bg-white font-semibold text-primary min-w-[180px] border-r">Team Member</TableHead>}
              {!hasGroups && <TableHead className="text-xs text-center font-semibold text-primary min-w-[70px] sticky left-[180px] z-20 bg-white border-r">Capacity</TableHead>}
              {!hasGroups && <TableHead className="text-xs text-center font-semibold text-primary min-w-[110px] sticky left-[250px] z-20 bg-white border-r">Allocated</TableHead>}
              {groupedWAs.map(wa => {
                const isNew = initialPlanAllocations && !initialPlanAllocations.some(a => a.work_area_id === wa.id);
                return (
                  <TableHead key={wa.id} className={cn("text-xs text-center font-semibold text-primary min-w-[130px] max-w-[180px]", getGroupBorder(wa))}>
                    <div className="flex flex-col items-center gap-0.5 px-1">
                      <div className="flex items-start justify-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: getWorkAreaColor(wa) }} />
                        <span className="line-clamp-2 text-left leading-tight" title={wa.name}>{wa.name}</span>
                      </div>
                      {isNew && <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 rounded px-1">NEW</span>}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberAllocations.map(({ member, allocations: memberAllocs, totalDays, capacity, totalPercent, isOverAllocated }) => (
              <TableRow key={member.id} className={cn(
                isOverAllocated ? "bg-red-50/50 hover:bg-red-50 border-l-4 border-red-500" : totalPercent > 80 ? "bg-amber-50/50 hover:bg-amber-50 border-l-4 border-amber-500" : "hover:bg-muted/30 border-l-4 border-transparent"
              )}>
                <TableCell className={cn("font-medium sticky left-0 z-10 border-r", isOverAllocated ? "bg-red-50" : totalPercent > 80 ? "bg-amber-50" : "bg-white")}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{member.name}</span>
                    <DisciplineBadge discipline={member.discipline} />
                  </div>
                </TableCell>
                <TableCell className={cn("text-center sticky left-[180px] z-10 border-r p-1", isOverAllocated ? "bg-red-50" : totalPercent > 80 ? "bg-amber-50" : "bg-white")}>
                  {canEdit ? (
                    <Input
                      type="number"
                      min={1}
                      defaultValue={capacity}
                      key={`${member.id}-${capacity}`}
                      onChange={(e) => handleCapacityChange(member.id, e.target.value)}
                      className="w-14 h-7 text-center text-xs p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{capacity}d</span>
                  )}
                </TableCell>
                <TableCell className={cn("text-center sticky left-[250px] z-10 border-r", isOverAllocated ? "bg-red-50" : totalPercent > 80 ? "bg-amber-50" : "bg-white")}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={cn(
                      "text-xs font-bold tabular-nums",
                      isOverAllocated ? "text-red-600" : totalPercent > 80 ? "text-amber-600" : "text-green-600"
                    )}>
                      {totalDays}d / {capacity}d
                    </span>
                    <span className="text-xs text-muted-foreground">({totalPercent}%)</span>
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          isOverAllocated ? "bg-red-500" : totalPercent > 80 ? "bg-amber-500" : "bg-green-500"
                        )}
                        style={{ width: `${Math.min(totalPercent, 100)}%` }}
                      />
                    </div>
                    {initialPlanMap && (() => {
                      const initialTotal = Object.values(initialPlanMap[member.id] || {}).reduce((s, d) => s + d, 0);
                      const delta = totalDays - initialTotal;
                      if (delta === 0) return null;
                      return (
                        <span className={cn("text-xs font-medium tabular-nums", delta > 0 ? "text-amber-600" : "text-blue-600")}>
                          {delta > 0 ? "↑" : "↓"}{delta > 0 ? "+" : ""}{delta}d vs plan
                        </span>
                      );
                    })()}
                  </div>
                </TableCell>
                {groupedWAs.map(wa => {
                  const alloc = memberAllocs.find(a => a.work_area_id === wa.id);
                  const value = alloc?.days ?? 0;

                  return (
                    <TableCell key={`${member.id}-${wa.id}`} className={cn("p-2 text-center", getGroupBorder(wa))}>
                      {canEdit ? (
                        <AllocationCell
                          value={value}
                          onChange={(newVal) => {
                            const key = `${member.id}-${wa.id}`;
                            if (allocationTimeoutRef.current[key]) {
                              clearTimeout(allocationTimeoutRef.current[key]);
                            }
                            allocationTimeoutRef.current[key] = setTimeout(() => {
                              onAllocationChange({
                                team_member_id: member.id,
                                quarter,
                                work_area_id: wa.id,
                                days: newVal,
                                allocationId: alloc?.id
                              });
                              delete allocationTimeoutRef.current[key];
                            }, 300);
                          }}
                        />
                      ) : (
                        <span className={cn("text-sm font-medium tabular-nums", value > 0 ? "text-foreground" : "text-muted-foreground")}>
                          {value}d
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Card view */}
      <div className="md:hidden space-y-3">
        {memberAllocations.map(({ member, allocations: memberAllocs, totalDays, capacity, totalPercent, isOverAllocated }) => (
          <div key={member.id} className={cn(
            "border-l-4 border rounded-lg p-4",
            isOverAllocated ? "border-l-red-500 border-red-300 bg-red-50/50" : totalPercent > 80 ? "border-l-amber-500 border-amber-300 bg-amber-50/50" : "border-l-green-500 border-muted"
          )}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-semibold truncate">{member.name}</span>
                <DisciplineBadge discipline={member.discipline} />
              </div>
              <span className={cn(
                "text-sm font-bold tabular-nums whitespace-nowrap ml-2",
                isOverAllocated ? "text-red-600" : totalPercent > 80 ? "text-amber-600" : "text-green-600"
              )}>
                {totalDays}d / {capacity}d
              </span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">({totalPercent}%)</span>
              {canEdit && (
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-xs text-muted-foreground">Capacity:</span>
                  <Input
                    type="number"
                    min={1}
                    defaultValue={capacity}
                    key={`mob-${member.id}-${capacity}`}
                    onChange={(e) => handleCapacityChange(member.id, e.target.value)}
                    className="w-14 h-6 text-center text-xs p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-muted-foreground">d</span>
                </div>
              )}
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4">
              <div
                className={cn(
                  "h-full transition-all",
                  isOverAllocated ? "bg-red-500" : totalPercent > 80 ? "bg-amber-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(totalPercent, 100)}%` }}
              />
            </div>
            <div className="space-y-3">
              {[
                { label: "Leading", items: leadingWAs, color: "text-primary" },
                { label: "Supporting", items: supportingWAs, color: "text-amber-700" },
                { label: "Other", items: otherWAs, color: "text-muted-foreground" },
              ].filter(g => g.items.length > 0).map(group => (
                <div key={group.label}>
                  {hasGroups && <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-1.5", group.color)}>{group.label}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    {group.items.map(wa => {
                      const alloc = memberAllocs.find(a => a.work_area_id === wa.id);
                      const value = alloc?.days ?? 0;
                      return (
                        <div key={wa.id}>
                          <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getWorkAreaColor(wa) }} />
                            {wa.name}
                          </div>
                          {canEdit ? (
                            <AllocationCell
                              value={value}
                              onChange={(newVal) => {
                                const key = `${member.id}-${wa.id}`;
                                if (allocationTimeoutRef.current[key]) {
                                  clearTimeout(allocationTimeoutRef.current[key]);
                                }
                                allocationTimeoutRef.current[key] = setTimeout(() => {
                                  onAllocationChange({
                                    team_member_id: member.id,
                                    quarter,
                                    work_area_id: wa.id,
                                    days: newVal,
                                    allocationId: alloc?.id
                                  });
                                  delete allocationTimeoutRef.current[key];
                                }, 300);
                              }}
                            />
                          ) : (
                            <span className="text-sm font-semibold tabular-nums">{value}d</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <QuarterlyAllocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        quarter={quarter}
        teamId={selectedTeamId}
        onConfirm={handleWorkAreaSelectionChange}
        initialSelectedIds={selectedWorkAreaIds}
      />
    </div>
  );
}
