import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

export default function WorkAreaDistribution({ teams, members, workAreas, allocations, sprints, selectedTeamId }) {
  if (selectedTeamId === "all") return null;

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const teamMembers = members.filter(m => m.team_id === selectedTeamId);
  const memberIds = new Set(teamMembers.map(m => m.id));

  // Categorize work areas
  const leadingWAs = workAreas.filter(wa => wa.leading_team_id === selectedTeamId);
  const supportingWAs = workAreas.filter(wa => wa.supporting_team_ids?.includes(selectedTeamId));
  const otherWAs = workAreas.filter(wa => 
    !wa.leading_team_ids?.includes(selectedTeamId) && 
    !wa.supporting_team_ids?.includes(selectedTeamId) &&
    wa.is_cross_team
  );

  // Calculate allocation percentages for each category
  const getWorkAreaAllocationPercent = (waId) => {
    return allocations
      .filter(a => a.work_area_id === waId && memberIds.has(a.team_member_id))
      .reduce((sum, a) => sum + (a.percent || 0), 0);
  };

  const leadingAllocation = leadingWAs.reduce((sum, wa) => sum + getWorkAreaAllocationPercent(wa.id), 0);
  const supportingAllocation = supportingWAs.reduce((sum, wa) => sum + getWorkAreaAllocationPercent(wa.id), 0);
  const otherAllocation = otherWAs.reduce((sum, wa) => sum + getWorkAreaAllocationPercent(wa.id), 0);

  const totalAllocation = leadingAllocation + supportingAllocation + otherAllocation;

  const pieData = [
    { name: "Leading", value: leadingAllocation, color: "#3b82f6" },
    { name: "Supporting", value: supportingAllocation, color: "#10b981" },
    { name: "Other", value: otherAllocation, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  // Work area breakdown
  const workAreaData = [
    ...leadingWAs.map(wa => ({
      name: wa.name,
      allocation: getWorkAreaAllocationPercent(wa.id),
      category: "Leading",
    })),
    ...supportingWAs.map(wa => ({
      name: wa.name,
      allocation: getWorkAreaAllocationPercent(wa.id),
      category: "Supporting",
    })),
    ...otherWAs.map(wa => ({
      name: wa.name,
      allocation: getWorkAreaAllocationPercent(wa.id),
      category: "Other",
    })),
  ].filter(d => d.allocation > 0).sort((a, b) => b.allocation - a.allocation);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{leadingWAs.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Leading Work Areas</div>
              <div className="text-sm font-semibold mt-2">{Math.round(leadingAllocation)}%</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{supportingWAs.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Supporting Work Areas</div>
              <div className="text-sm font-semibold mt-2">{Math.round(supportingAllocation)}%</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{otherWAs.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Other Work Areas</div>
              <div className="text-sm font-semibold mt-2">{Math.round(otherAllocation)}%</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Role Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${Math.round(value)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${Math.round(value)}%`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Work Area Details */}
        {workAreaData.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Work Areas by Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workAreaData.map((wa, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium truncate flex-1">{wa.name}</div>
                      <span className={cn(
                        "text-xs font-semibold px-2 py-1 rounded",
                        wa.category === "Leading" ? "bg-blue-100 text-blue-700" :
                        wa.category === "Supporting" ? "bg-green-100 text-green-700" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {wa.category}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          wa.category === "Leading" ? "bg-blue-600" :
                          wa.category === "Supporting" ? "bg-green-600" :
                          "bg-amber-600"
                        )}
                        style={{ width: `${Math.min(wa.allocation, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{Math.round(wa.allocation)}%</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}