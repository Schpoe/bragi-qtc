import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { canManageAllocations } from "@/lib/permissions";
import { useAuth } from "@/lib/AuthContext";
import EmptyState from "@/components/shared/EmptyState";
import { Users, Settings2 } from "lucide-react";
import DisciplineBadge from "../shared/DisciplineBadge";
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
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader className="bg-secondary/50 sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-40 sticky left-0 z-20 bg-secondary/50">Team Member</TableHead>
              {relevantWorkAreas.map(wa => (
                <TableHead key={wa.id} className="text-xs text-center w-24">
                  {wa.name.length > 12 ? wa.name.substring(0, 12) + '...' : wa.name}
                </TableHead>
              ))}
              <TableHead className="text-xs text-center w-20">Total %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberAllocations.map(({ member, allocations: memberAllocs, totalPercent, isOverAllocated }) => (
              <TableRow key={member.id} className={isOverAllocated ? "bg-destructive/5" : ""}>
                <TableCell className="font-medium sticky left-0 z-10 bg-background border-r">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{member.name}</span>
                    <DisciplineBadge discipline={member.discipline} />
                  </div>
                </TableCell>
                {relevantWorkAreas.map(wa => {
                  const alloc = memberAllocs.find(a => a.work_area_id === wa.id);
                  const value = alloc?.percent ?? 0;

                  return (
                    <TableCell key={`${member.id}-${wa.id}`} className="p-1 text-center">
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
                        className="h-8 text-xs text-center py-0"
                      />
                    </TableCell>
                  );
                })}
                <TableCell className={`text-xs text-center font-semibold ${isOverAllocated ? "text-destructive" : ""}`}>
                  {totalPercent}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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