import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DisciplineBadge from "../shared/DisciplineBadge";
import AllocationCell from "./AllocationCell";
import { cn } from "@/lib/utils";

export default function SprintAllocationTable({ sprint, members, workAreas, allocations, onAllocationChange }) {
  const relevantWorkAreas = workAreas.filter(wa => !sprint.relevant_work_area_ids || sprint.relevant_work_area_ids.length === 0 || sprint.relevant_work_area_ids.includes(wa.id));
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
        {members.length === 0 ? "No team members found." : "No work areas defined."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="min-w-[160px] sticky left-0 bg-muted/50 z-10">Member</TableHead>
            {workAreas.map(wa => (
              <TableHead key={wa.id} className="text-center min-w-[80px]">
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: wa.color || "#3b82f6" }} />
                  <span className="text-xs">{wa.name}</span>
                </div>
              </TableHead>
            ))}
            <TableHead className="text-center min-w-[70px] font-semibold">Σ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map(member => {
            const total = getMemberTotal(member.id);
            const isOver = total > (member.availability_percent || 100);
            return (
              <TableRow key={member.id}>
                <TableCell className="sticky left-0 bg-card z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{member.name}</span>
                    <DisciplineBadge discipline={member.discipline} />
                  </div>
                </TableCell>
                {workAreas.map(wa => (
                  <TableCell key={wa.id} className="text-center p-1">
                    <div className="flex justify-center">
                      <AllocationCell
                        value={getAllocation(member.id, wa.id)}
                        onChange={(val) => onAllocationChange(member.id, sprint.id, wa.id, val)}
                      />
                    </div>
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  <span className={cn(
                    "text-sm font-semibold tabular-nums",
                    isOver ? "text-destructive" : total > 0 ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {total}%
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}