import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import DisciplineBadge from "../shared/DisciplineBadge";
import EmptyState from "../shared/EmptyState";
import { Users } from "lucide-react";

export default function QuarterlyAllocationReport({
  members,
  workAreas,
  quarterlyAllocations,
  selectedQuarter,
  selectedTeamId,
}) {
  const relevantMembers = selectedTeamId === "all"
    ? members
    : members.filter(m => m.team_id === selectedTeamId);

  const relevantWorkAreas = workAreas; // already filtered by parent (Dashboard)

  const quarterAllocations = quarterlyAllocations.filter(a => a.quarter === selectedQuarter);

  const memberAllocations = useMemo(() => {
    return relevantMembers.map(member => {
      const memberAllocs = quarterAllocations.filter(a => a.team_member_id === member.id);
      const totalDays = memberAllocs.reduce((sum, a) => sum + (a.days || 0), 0);
      const totalPercent = Math.round(totalDays * 100 / 60); // derive % using default 60d capacity

      return {
        member,
        allocations: memberAllocs,
        totalDays,
        totalPercent,
        isOverAllocated: totalDays > 60
      };
    });
  }, [relevantMembers, quarterAllocations]);

  if (relevantMembers.length === 0 || relevantWorkAreas.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No data available"
        description="Add team members and work items to view quarterly allocations."
      />
    );
  }

  const hasAllocations = memberAllocations.some(m => m.totalDays > 0);

  if (!hasAllocations) {
    return (
      <EmptyState
        icon={Users}
        title="No quarterly allocations"
        description="No allocations have been made for this quarter."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
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
                const value = alloc?.days ?? 0;

                return (
                  <TableCell key={`${member.id}-${wa.id}`} className="p-2 text-center">
                    <span className={cn("text-sm font-medium tabular-nums", value > 0 ? "text-foreground" : "text-muted-foreground")}>
                      {value}d
                    </span>
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
  );
}