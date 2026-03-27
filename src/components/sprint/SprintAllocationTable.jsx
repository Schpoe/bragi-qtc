import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DisciplineBadge from "../shared/DisciplineBadge";
import AllocationCell from "./AllocationCell";
import { cn, getTeamColor } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { canManageAllocations } from "@/lib/permissions";

export default function SprintAllocationTable({ sprint, members, workAreas, allocations, teams = [], onAllocationChange }) {
  const { user } = useAuth();
  const canEdit = canManageAllocations(user, sprint.team_id);
  
  const sprintAllocatedWaIds = new Set(allocations.filter(a => a.sprint_id === sprint.id).map(a => a.work_area_id));
  const relevantWorkAreas = (sprint?.relevant_work_area_ids?.length ?? 0) > 0
    ? workAreas.filter(wa => sprint.relevant_work_area_ids.includes(wa.id))
    : workAreas.filter(wa => sprintAllocatedWaIds.has(wa.id));

  const teamId = sprint.team_id;
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

  const getAllocation = (memberId, workAreaId) => {
    const alloc = allocations.find(
      a => a.team_member_id === memberId && a.sprint_id === sprint.id && a.work_area_id === workAreaId
    );
    return alloc ? alloc.percent : 0;
  };

  const getMemberTotal = (memberId) => {
    return relevantWorkAreas.reduce((sum, wa) => sum + getAllocation(memberId, wa.id), 0);
  };

  if (members.length === 0 || relevantWorkAreas.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        {members.length === 0 ? "No team members found." : "No work items defined."}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Desktop: Table view */}
      <div className="hidden md:block overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            {hasGroups && (
              <TableRow className="bg-primary/5 border-b-0">
                <TableHead className="min-w-[160px] sticky left-0 bg-white z-10 font-semibold text-primary border-r" rowSpan={2}>Member</TableHead>
                <TableHead className="text-center min-w-[80px] sticky left-[160px] bg-white z-10 font-semibold text-primary border-r" rowSpan={2}>Total</TableHead>
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
            <TableRow className="bg-primary/5 border-b-2 border-primary/20">
              {!hasGroups && <TableHead className="min-w-[160px] sticky left-0 bg-white z-10 font-semibold text-primary border-r">Member</TableHead>}
              {!hasGroups && <TableHead className="text-center min-w-[80px] sticky left-[160px] bg-white z-10 font-semibold text-primary border-r">Total</TableHead>}
              {groupedWAs.map(wa => (
                <TableHead key={wa.id} className={cn("text-center min-w-[90px]", getGroupBorder(wa))}>
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getTeamColor(teams.find(t => t.id === wa.leading_team_id)) }} />
                    <span className="text-xs font-semibold">{wa.name}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map(member => {
              const total = getMemberTotal(member.id);
              const isOver = total > (member.availability_percent || 100);
              const capacity = member.availability_percent || 100;
              const utilization = Math.round((total / capacity) * 100);
              
              return (
                <TableRow key={member.id} className={cn(
                  isOver ? "bg-red-50/50 hover:bg-red-50" : utilization > 80 ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-muted/30"
                )}>
                  <TableCell className={cn("sticky left-0 z-10 border-r", isOver ? "bg-red-50" : utilization > 80 ? "bg-amber-50" : "bg-white")}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{member.name}</span>
                      <DisciplineBadge discipline={member.discipline} />
                    </div>
                  </TableCell>
                  <TableCell className={cn("text-center sticky left-[160px] z-10 border-r", isOver ? "bg-red-50" : utilization > 80 ? "bg-amber-50" : "bg-white")}>
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        isOver ? "text-red-600" : utilization > 80 ? "text-amber-600" : "text-green-600"
                      )}>
                        {total}%
                      </span>
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            isOver ? "bg-red-500" : utilization > 80 ? "bg-amber-500" : "bg-green-500"
                          )}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  {groupedWAs.map(wa => {
                    const val = getAllocation(member.id, wa.id);
                    return (
                      <TableCell key={wa.id} className={cn("text-center p-2", getGroupBorder(wa))}>
                        {canEdit ? (
                          <AllocationCell
                            value={val}
                            onChange={(newVal) => onAllocationChange(member.id, sprint.id, wa.id, newVal)}
                          />
                        ) : (
                          <span className={cn("text-sm font-medium tabular-nums", val > 0 ? "text-foreground" : "text-muted-foreground")}>
                            {val}%
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Card view */}
      <div className="md:hidden space-y-3">
        {members.map(member => {
          const total = getMemberTotal(member.id);
          const capacity = member.availability_percent || 100;
          const isOver = total > capacity;
          const utilization = Math.round((total / capacity) * 100);
          
          return (
            <div key={member.id} className={cn(
              "border rounded-lg p-4",
              isOver ? "border-red-300 bg-red-50/50" : utilization > 80 ? "border-amber-300 bg-amber-50/50" : "border-muted"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-semibold">{member.name}</span>
                  <DisciplineBadge discipline={member.discipline} />
                </div>
                <span className={cn(
                  "text-lg font-bold tabular-nums",
                  isOver ? "text-red-600" : utilization > 80 ? "text-amber-600" : "text-green-600"
                )}>
                  {total}%
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-3">
                <div 
                  className={cn(
                    "h-full transition-all",
                    isOver ? "bg-red-500" : utilization > 80 ? "bg-amber-500" : "bg-green-500"
                  )}
                  style={{ width: `${Math.min(utilization, 100)}%` }}
                />
              </div>
              <div className="space-y-2">
                {[
                  { label: "Leading", items: leadingWAs, color: "text-primary" },
                  { label: "Supporting", items: supportingWAs, color: "text-amber-700" },
                  { label: "Other", items: otherWAs, color: "text-muted-foreground" },
                ].filter(g => g.items.length > 0).map(group => (
                  <div key={group.label}>
                    {hasGroups && <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-1", group.color)}>{group.label}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map(wa => (
                        <div key={wa.id} className="text-xs">
                          <div className="font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getTeamColor(teams.find(t => t.id === wa.leading_team_id)) }} />
                            {wa.name}
                          </div>
                          {canEdit ? (
                            <AllocationCell
                              value={getAllocation(member.id, wa.id)}
                              onChange={(val) => onAllocationChange(member.id, sprint.id, wa.id, val)}
                            />
                          ) : (
                            <span className="font-semibold">{getAllocation(member.id, wa.id)}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}