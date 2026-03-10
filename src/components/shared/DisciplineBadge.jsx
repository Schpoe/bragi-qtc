import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const disciplineStyles = {
  iOS: "bg-blue-100 text-blue-700 border-blue-200",
  Android: "bg-green-100 text-green-700 border-green-200",
  Cloud: "bg-purple-100 text-purple-700 border-purple-200",
  QA: "bg-amber-100 text-amber-700 border-amber-200",
  Embedded: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function DisciplineBadge({ discipline }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium border", disciplineStyles[discipline] || "")}>
      {discipline}
    </Badge>
  );
}