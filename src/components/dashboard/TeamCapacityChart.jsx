import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

export default function TeamCapacityChart({ teams, sprints, members, allocations, selectedTeamId, selectedQuarter }) {
  const data = useMemo(() => {
    const chartData = [];

    // Filter sprints by quarter and sort by order ascending
    const quarterSprints = sprints
      .filter(s => s.quarter === selectedQuarter && !s.is_cross_team)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Filter teams
    const filteredTeams = selectedTeamId && selectedTeamId !== "all"
      ? teams.filter(t => t.id === selectedTeamId)
      : teams;

    filteredTeams.forEach(team => {
      const teamMembers = members.filter(m => m.team_id === team.id);
      
      quarterSprints.forEach(sprint => {
        if (sprint.team_id !== team.id) return;

        // Calculate total capacity
        const totalCapacity = teamMembers.reduce((sum, m) => sum + (m.sprint_days || 10), 0);

        // Calculate total allocation
        const sprintAllocations = allocations.filter(
          a => a.sprint_id === sprint.id && teamMembers.some(m => m.id === a.team_member_id)
        );
        const totalAllocation = sprintAllocations.reduce((sum, a) => sum + (a.days || 0), 0);

        // Count members
        const membersOverAllocated = teamMembers.filter(m => {
          const memberAlloc = sprintAllocations
            .filter(a => a.team_member_id === m.id)
            .reduce((sum, a) => sum + (a.days || 0), 0);
          return memberAlloc > (m.sprint_days || 10);
        }).length;

        chartData.push({
          name: `${team.name} - ${sprint.name}`,
          teamId: team.id,
          sprintId: sprint.id,
          capacity: totalCapacity,
          allocation: totalAllocation,
          overAllocatedMembers: membersOverAllocated,
          totalMembers: teamMembers.length,
          utilization: totalCapacity > 0 ? Math.round((totalAllocation / totalCapacity) * 100) : 0,
        });
      });
    });

    return chartData;
  }, [teams, sprints, members, allocations, selectedTeamId, selectedQuarter]);

  const getBarColor = (utilization) => {
    if (utilization > 100) return "#ef4444"; // red for over-allocated
    if (utilization >= 80) return "#f59e0b"; // amber for high utilization
    if (utilization >= 60) return "#3b82f6"; // blue for good utilization
    return "#10b981"; // green for under-utilized
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-lg">Team Capacity vs Allocation</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Shows capacity vs actual allocation per team and sprint. Red indicates over-allocation.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No data available for the selected filters.
          </div>
        ) : (
          <div className="space-y-8">
            <ResponsiveContainer width="100%" height={Math.max(300, data.length * 60)}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={190} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => `${value}%`}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Legend />
                <Bar dataKey="capacity" fill="hsl(var(--muted-foreground))" opacity={0.4} name="Team Capacity %" />
                <Bar dataKey="allocation" name="Total Allocation %">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.allocation)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Detailed breakdown */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.map((item) => (
                <div key={`${item.teamId}-${item.sprintId}`} className="border border-border rounded-lg p-4">
                  <h3 className="font-semibold text-sm mb-2">{item.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Utilization:</span>
                      <span className={`font-semibold ${item.allocation > 100 ? "text-destructive" : ""}`}>
                        {item.utilization}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capacity:</span>
                      <span>{item.capacity}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Allocation:</span>
                      <span>{item.allocation}%</span>
                    </div>
                    {item.overAllocatedMembers > 0 && (
                      <div className="flex justify-between text-destructive">
                        <span className="text-muted-foreground">⚠️ Over-allocated:</span>
                        <span className="font-semibold">{item.overAllocatedMembers}/{item.totalMembers} members</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}