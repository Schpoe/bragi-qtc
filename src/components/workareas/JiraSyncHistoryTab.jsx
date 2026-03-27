import React from "react";
import { useQuery } from "@tanstack/react-query";
import { bragiQTC } from "@/api/bragiQTCClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { CheckCircle2, AlertCircle, XCircle, Clock } from "lucide-react";
import EmptyState from "../shared/EmptyState";

export default function JiraSyncHistoryTab() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["jiraSyncHistory"],
    queryFn: () => bragiQTC.entities.JiraSyncHistory.list(),
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "partial_success":
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "success":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Success</Badge>;
      case "partial_success":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Partial Success</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Failed</Badge>;
      default:
        return null;
    }
  };

  const getSyncTypeLabel = (type) => {
    switch (type) {
      case "full_import":
        return "Full Import";
      case "full_sync":
        return "Full Sync";
      case "partial_sync":
        return "Partial Sync";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No sync history"
        description="Jira sync operations will be logged here."
      />
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-primary/5 border-b-2 border-primary/20">
            <TableHead className="font-semibold text-primary">Date & Time</TableHead>
            <TableHead className="font-semibold text-primary">Operation</TableHead>
            <TableHead className="text-center font-semibold text-primary">Status</TableHead>
            <TableHead className="text-center font-semibold text-primary">Items Synced</TableHead>
            <TableHead className="text-center font-semibold text-primary">Duration</TableHead>
            <TableHead className="font-semibold text-primary">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map(entry => (
            <TableRow key={entry.id} className="hover:bg-muted/30">
              <TableCell className="text-sm">
                <div className="font-medium">
                  {format(new Date(entry.created_date), "MMM d, yyyy")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(entry.created_date), "HH:mm:ss")}
                </div>
              </TableCell>
              <TableCell className="text-sm font-medium">
                {getSyncTypeLabel(entry.sync_type)}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-2">
                  {getStatusIcon(entry.status)}
                  {getStatusBadge(entry.status)}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="text-sm font-semibold">{entry.items_synced || 0}</div>
                {(entry.items_created > 0 || entry.items_updated > 0) && (
                  <div className="text-xs text-muted-foreground">
                    +{entry.items_created || 0} {entry.items_updated > 0 ? `~${entry.items_updated || 0}` : ""}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-center text-sm text-muted-foreground">
                {entry.duration_seconds ? `${entry.duration_seconds}s` : "—"}
              </TableCell>
              <TableCell className="text-sm">
                {entry.error_message ? (
                  <div className="max-w-xs">
                    <p className="text-destructive text-xs font-medium truncate" title={entry.error_message}>
                      {entry.error_message}
                    </p>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}