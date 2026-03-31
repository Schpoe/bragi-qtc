import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function FilterBar({ quarter, onQuarterChange, team, onTeamChange, teams, quarters, showTeamFilter = true }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <Select value={quarter} onValueChange={onQuarterChange}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {quarters.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
        </SelectContent>
      </Select>
      {showTeamFilter && (
        <Select value={team} onValueChange={onTeamChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Select team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {teams.filter(t => t.is_active !== false).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}