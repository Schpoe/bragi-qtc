import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { canManageAllocations } from "@/lib/permissions";
import { useAuth } from "@/lib/AuthContext";
import EmptyState from "@/components/shared/EmptyState";
import { Users, Settings2 } from "lucide-react";
import DisciplineBadge from "../shared/DisciplineBadge.jsx";
import QuarterlyAllocationDialog from "./QuarterlyAllocationDialog";

export default function QuarterlyAllocationTable({
  members,
  workAreas,
  allocations,
  quarter,
  onAllocationChange,
  selectedTeamId
}) {
  const [selectedWorkAreaIds, setSelectedWorkAreaIds] = useState(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();
  const relevantTeamId = selectedTeamId === "all" ? members[0]?.team_id : selectedTeamId;
  const canEdit = relevantTeamId && canManageAllocations(user, relevantTeamId);

  const relevantMembers = selectedTeamId === "all"
    ? members
    : members.filter(m => m.team_id === selectedTeamId);

  const allRelevantWorkAreas = selectedTeamId === "all"
    ? workAreas
    : workAreas.filter(wa => wa.is_cross_team || wa.leading_team_id === selectedTeamId || wa.supporting_team_ids.includes(selectedTeamId));

  const relevantWorkAreas = allRelevantWorkAreas.filter(wa => selectedWorkAreaIds.has(wa.id));

  const quarterAllocations = allocations.filter(a => a.quarter === quarter);

  const memberAllocations = useMemo(() => {
    return relevantMembers.map(member => {
      const memberAllocs = quarterAllocations.filter(a => a.team_member_id === member.id);
      const totalPercent = memberAllocs.reduce((sum, a) => sum + a.percent, 0);
      
      return {
        member,
        allocations: memberAllocs,
        totalPercent,
        isOverAllocated: totalPercent > 100
      };
    });
  }, [relevantMembers, quarterAllocations]);

  const handleWorkAreaSelectionChange = (selected) => {
    setSelectedWorkAreaIds(new Set(selected));
  };

  if (relevantMembers.length === 0 || allRelevantWorkAreas.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No data available"
        description="Add team members and work areas to start planning allocations."
      />
    );
  }

  if (selectedWorkAreaIds.size === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Work Areas</h4>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Select Work Areas
            </Button>
          )}
        </div>
        <EmptyState
          icon={Users}
          title="No work areas selected"
          description="Click 'Select Work Areas' to choose which areas to allocate."
        />
        <QuarterlyAllocationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          quarter={quarter}
          teamId={selectedTeamId}
          onConfirm={handleWorkAreaSelectionChange}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold text-foreground">Work Areas Allocation</h4>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Select Work Areas
          </Button>
        )}
      </div>

      {/* Desktop: Table view */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-primary/5 border-b-2 border-primary/20">
            <TableRow>
              <TableHead className="sticky left-0 z-20 bg-primary/5 font-semibold text-primary min-w-[180px]">Team Member</TableHead>
              {relevantWorkAreas.map(wa => (
                <TableHead key={wa.id} className="text-xs text-center font-semibold text-primary min-w-[100px]">
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: wa.color || "#3b82f6" }} />
                    <span>{wa.name.length > 10 ? wa.name.substring(0, 10) + '...' : wa.name}</span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-xs text-center font-semibold text-primary min-w-[90px]">Allocated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberAllocations.map(({ member, allocations: memberAllocs, totalPercent, isOverAllocated }) => (
              <TableRow key={member.id} className={cn(
                isOverAllocated ? "bg-red-50/50 hover:bg-red-50 border-l-4 border-red-500" : totalPercent > 80 ? "bg-amber-50/50 hover:bg-amber-50 border-l-4 border-amber-500" : "hover:bg-muted/30 border-l-4 border-transparent"
              )}>
                <TableCell className="font-medium sticky left-0 z-10 border-r" style={{backgroundColor: isOverAllocated ? "rgba(239,68,68,0.05)" : totalPercent > 80 ? "rgba(217,119,6,0.05)" : "transparent"}}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{member.name}</span>
                    <DisciplineBadge discipline={member.discipline} />
                  </div>
                </TableCell>
                {relevantWorkAreas.map(wa => {
                  const alloc = memberAllocs.find(a => a.work_area_id === wa.id);
                  const value = alloc?.percent ?? 0;

                  return (
                    <TableCell key={`${member.id}-${wa.id}`} className="p-2 text-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={value}
                        onChange={(e) => {
                          const newPercent = parseFloat(e.target.value) || 0;
                          onAllocationChange({
                            team_member_id: member.id,
                            quarter,
                            work_area_id: wa.id,
                            percent: newPercent,
                            allocationId: alloc?.id
                          });
                        }}
                        disabled={!canEdit}
                        className="h-8 text-xs text-center py-0 font-semibold"
                      />
                    </TableCell>
                  );
                })}
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      isOverAllocated ? "text-red-600" : totalPercent > 80 ? "text-amber-600" : "text-green-600"
                    )}>
                      {totalPercent}%
                    </span>
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all",
                          isOverAllocated ? "bg-red-500" : totalPercent > 80 ? "bg-amber-500" : "bg-green-500"
                        )}
                        style={{ width: `${Math.min(totalPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: Card view */}
      <div className="md:hidden space-y-3">
        {memberAllocations.map(({ member, allocations: memberAllocs, totalPercent, isOverAllocated }) => (
          <div key={member.id} className={cn(
            "border-l-4 border rounded-lg p-4",
            isOverAllocated ? "border-l-red-500 border-red-300 bg-red-50/50" : totalPercent > 80 ? "border-l-amber-500 border-amber-300 bg-amber-50/50" : "border-l-green-500 border-muted"
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-semibold truncate">{member.name}</span>
                <DisciplineBadge discipline={member.discipline} />
              </div>
              <span className={cn(
                "text-lg font-bold tabular-nums whitespace-nowrap ml-2",
                isOverAllocated ? "text-red-600" : totalPercent > 80 ? "text-amber-600" : "text-green-600"
              )}>
                {totalPercent}%
              </span>
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
            <div className="grid grid-cols-2 gap-3">
              {relevantWorkAreas.map(wa => {
                const alloc = memberAllocs.find(a => a.work_area_id === wa.id);
                const value = alloc?.percent ?? 0;
                
                return (
                  <div key={wa.id}>
                    <div className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: wa.color || "#3b82f6" }} />
                      {wa.name}
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={value}
                      onChange={(e) => {
                        const newPercent = parseFloat(e.target.value) || 0;
                        onAllocationChange({
                          team_member_id: member.id,
                          quarter,
                          work_area_id: wa.id,
                          percent: newPercent,
                          allocationId: alloc?.id
                        });
                      }}
                      disabled={!canEdit}
                      className="h-8 text-xs text-center font-semibold py-0"
                    />
                  </div>
                );
              })}
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
      />
    </div>
  );
}