import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentQuarter, sortQuarters } from "@/lib/quarter-utils";
import PageHeader from "../components/shared/PageHeader";
import FilterBar from "../components/shared/FilterBar";
import EmptyState from "../components/shared/EmptyState";
import { BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const teamColorMap = {
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  purple: "bg-purple-500",
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-500",
  lime: "bg-lime-500",
  green: "bg-emerald-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  sky: "bg-sky-500",
  slate: "bg-slate-500",
  gray: "bg-gray-500",
  zinc: "bg-zinc-500",
  stone: "bg-stone-500",
};

function UtilBar({ value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[60px]">
        <div
          className={cn("h-full rounded-full transition-all", pct > 100 ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn("text-xs font-semibold tabular-nums w-9 text-right", pct > 100 ? "text-destructive" : pct > 80 ? "text-amber-600" : "text-foreground")}>
        {pct}%
      </span>
    </div>
  );
}

function TeamOverviewCard({ team, sprints, members, workAreas, allocations }) {
  const teamSprints = sprints.filter(s => s.is_cross_team || s.team_id === team.id).sort((a, b) => (a.order || 0) - (b.order || 0));
  const teamMembers = members.filter(m => m.team_id === team.id);
  const teamWorkAreas = workAreas.filter(wa => wa.is_cross_team || wa.team_id === team.id);
  const memberIds = new Set(teamMembers.map(m => m.id));

  const getSprintWorkAreaTotal = (sprintId, workAreaId) => {
    return allocations
      .filter(a => a.sprint_id === sprintId && a.work_area_id === workAreaId && memberIds.has(a.team_member_id))
      .reduce((sum, a) => sum + (a.percent || 0), 0);
  };

  const getSprintTotal = (sprintId) => {
    return allocations
      .filter(a => a.sprint_id === sprintId && memberIds.has(a.team_member_id))
      .reduce((sum, a) => sum + (a.percent || 0), 0);
  };

  const maxCapacity = teamMembers.reduce((sum, m) => sum + (m.availability_percent || 100), 0);

  if (teamSprints.length === 0) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <TeamCardTitle team={team} memberCount={teamMembers.length} />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">No sprints in this quarter.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <TeamCardTitle team={team} memberCount={teamMembers.length} />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-xs min-w-[90px]">Area</TableHead>
                {teamSprints.map(s => (
                  <TableHead key={s.id} className="text-center text-xs min-w-[70px]">{s.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamWorkAreas.map(wa => (
                <TableRow key={wa.id}>
                  <TableCell className="py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: wa.color || "#3b82f6" }} />
                      <span className="text-xs font-medium truncate max-w-[100px]">{wa.name}</span>
                    </div>
                  </TableCell>
                  {teamSprints.map(s => {
                    const val = getSprintWorkAreaTotal(s.id, wa.id);
                    return (
                      <TableCell key={s.id} className="text-center py-2">
                        <span className={cn("text-xs tabular-nums", val > 0 ? "font-medium" : "text-muted-foreground")}>
                          {val > 0 ? `${val}%` : "—"}
                        </span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {teamWorkAreas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={teamSprints.length + 1} className="text-center text-xs text-muted-foreground py-4">
                    No work areas assigned.
                  </TableCell>
                </TableRow>
              )}
              {/* Total row */}
              <TableRow className="border-t-2 bg-muted/30">
                <TableCell className="py-2 text-xs font-semibold">Utilization</TableCell>
                {teamSprints.map(s => {
                  const total = getSprintTotal(s.id);
                  return (
                    <TableCell key={s.id} className="py-2 min-w-[90px]">
                      <UtilBar value={total} max={maxCapacity} />
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamCardTitle({ team, memberCount }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className={`w-3 h-3 rounded-full ${teamColorMap[team.color] || "bg-primary"}`} />
        <CardTitle className="text-sm font-semibold">{team.name}</CardTitle>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="w-3.5 h-3.5" />
        <span>{memberCount}</span>
      </div>
    </div>
  );
}

export default function TeamSprintOverview() {
  const [selectedQuarter, setSelectedQuarter] = useState(() => getCurrentQuarter());
  const [selectedTeam, setSelectedTeam] = useState("all");

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ["sprints"],
    queryFn: () => base44.entities.Sprint.list(),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["teamMembers"],
    queryFn: () => base44.entities.TeamMember.list(),
  });

  const { data: workAreas = [] } = useQuery({
    queryKey: ["workAreas"],
    queryFn: () => base44.entities.WorkArea.list(),
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["allocations"],
    queryFn: () => base44.entities.Allocation.list(),
  });

  const quarterSprints = sprints.filter(s => s.quarter === selectedQuarter);

  const quarters = [...new Set(sprints.map(s => s.quarter))];
  if (!quarters.includes(selectedQuarter)) quarters.push(selectedQuarter);
  sortQuarters(quarters);

  const filteredTeams = selectedTeam === "all" ? teams : teams.filter(t => t.id === selectedTeam);

  return (
    <div>
      <PageHeader title="Team Overview" subtitle="Sprint utilization of all teams at a glance" />

      <FilterBar
        quarter={selectedQuarter}
        onQuarterChange={setSelectedQuarter}
        team={selectedTeam}
        onTeamChange={setSelectedTeam}
        teams={teams}
        quarters={quarters}
        showTeamFilter={true}
      />

      {teamsLoading ? (
        <div className="grid grid-cols-1 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : teams.length === 0 ? (
        <EmptyState icon={BarChart3} title="No teams yet" description="First create teams and sprints under 'Teams' and 'Sprint Planning'." />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredTeams.map(team => (
            <TeamOverviewCard
              key={team.id}
              team={team}
              sprints={quarterSprints}
              members={members}
              workAreas={workAreas}
              allocations={allocations}
            />
          ))}
        </div>
      )}
    </div>
  );
}