import React from "react";
import { Badge } from "@/components/ui/badge";

export default function PageHeader({ title, subtitle, children, quarter, team, teamColor }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{title}</h1>
          {quarter && <Badge variant="secondary">{quarter}</Badge>}
          {team && (
            <Badge 
              style={{ backgroundColor: teamColor ? `hsl(${teamColor})` : undefined }} 
              className={teamColor ? "text-white" : ""}
            >
              {team}
            </Badge>
          )}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}