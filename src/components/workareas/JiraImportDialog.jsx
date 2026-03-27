import React, { useState } from "react";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Wifi, WifiOff } from "lucide-react";

function LogPane({ entries }) {
  if (entries.length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/30 p-3 max-h-48 overflow-y-auto space-y-1">
      {entries.map((e, i) => (
        <div key={i} className={`flex items-start gap-2 text-xs font-mono ${
          e.type === 'error' ? 'text-destructive' :
          e.type === 'success' ? 'text-green-600' :
          e.type === 'warn' ? 'text-amber-600' :
          'text-muted-foreground'
        }`}>
          <span className="shrink-0 mt-0.5">
            {e.type === 'error' ? '✗' : e.type === 'success' ? '✓' : e.type === 'warn' ? '!' : '·'}
          </span>
          <span>{e.msg}</span>
        </div>
      ))}
    </div>
  );
}

export default function JiraImportDialog({ open, onOpenChange, teams: existingTeams = [] }) {
  const [jql, setJql] = useState('project = PROD');
  const [syncResult, setSyncResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [testing, setTesting] = useState(false);
  const queryClient = useQueryClient();

  const addLog = (msg, type = 'info') => setLogs(prev => [...prev, { msg, type }]);

  const { data: existingWorkAreas = [] } = useQuery({
    queryKey: ['workAreas'],
    queryFn: () => bragiQTC.entities.WorkArea.list(),
  });

  const { data: existingWorkAreaTypes = [] } = useQuery({
    queryKey: ['workAreaTypes'],
    queryFn: () => bragiQTC.entities.WorkAreaType.list(),
  });

  const createWorkAreaType = useMutation({
    mutationFn: (typeData) => bragiQTC.entities.WorkAreaType.create(typeData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workAreaTypes'] }),
  });

  const createWorkArea = useMutation({
    mutationFn: (workAreaData) => bragiQTC.entities.WorkArea.create(workAreaData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workAreas'] }),
  });

  const updateWorkArea = useMutation({
    mutationFn: ({ id, workAreaData }) => bragiQTC.entities.WorkArea.update(id, workAreaData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workAreas'] }),
  });

  const testConnection = async () => {
    setTesting(true);
    setLogs([]);
    setError(null);
    addLog('Testing Jira connection...');
    try {
      const response = await bragiQTC.functions.invoke('testJiraConnection', {});
      const d = response.data;
      if (d.ok) {
        addLog(`Connected to ${d.baseUrl}`, 'success');
        addLog(`Fetched ${d.fieldCount} Jira fields`, 'success');
      } else {
        addLog(d.error, 'error');
        setError(d.error);
      }
    } catch (err) {
      addLog(err.message, 'error');
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const fetchFromJira = async () => {
    setError(null);
    setSyncResult(null);
    setLogs([]);
    setFetching(true);

    addLog('Connecting to Jira...');
    try {
      addLog(`Executing JQL: ${jql.trim()}`);
      const response = await bragiQTC.functions.invoke('jiraSync', {
        jql: jql.trim()
      });

      if (response.data.error) {
        addLog(response.data.error, 'error');
        setError(response.data.error);
        return;
      }

      const d = response.data;

      // Show server-side logs
      if (d.logs?.length) {
        d.logs.forEach(l => addLog(l, l.startsWith('Warning') ? 'warn' : 'success'));
      }

      if (d.totalIssues === 0) {
        addLog('JQL returned 0 issues — check your query', 'warn');
      }

      const fm = d.fieldMapping;
      if (!fm.leadingTeam) addLog('Warning: "Leading Team" custom field not found — leading team will be empty', 'warn');
      if (!fm.contributingTeams) addLog('Warning: "Contributing Teams" custom field not found', 'warn');

      setSyncResult(d);
    } catch (err) {
      addLog(err.message, 'error');
      setError(err.message);
    } finally {
      setFetching(false);
    }
  };

  const calculateWorkAreaStats = (workAreas) => {
    if (!workAreas) return { toAdd: 0, toUpdate: 0, toSkip: 0 };
    let toAdd = 0, toUpdate = 0, toSkip = 0;
    for (const wa of workAreas) {
      const existing = existingWorkAreas.find(ewa => ewa.prod_id === wa.key);
      if (!existing) {
        toAdd++;
      } else {
        const hasChanged =
          existing.name !== wa.name ||
          existing.type !== wa.type ||
          existing.leading_team_id !== wa.leadingTeam ||
          JSON.stringify(existing.supporting_team_ids || []) !== JSON.stringify(wa.supportingTeams);
        if (hasChanged) toUpdate++;
        else toSkip++;
      }
    }
    return { toAdd, toUpdate, toSkip };
  };

  const importData = async () => {
    if (!syncResult) return;
    setImporting(true);
    setError(null);
    setLogs([]);

    try {
      const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f97316', '#ec4899', '#14b8a6'];
      const stats = { typesCreated: 0, workAreasCreated: 0, workAreasUpdated: 0, workAreasSkipped: 0, errors: [] };

      // Map teams
      const teamMap = {};
      for (const teamName of syncResult.teams) {
        const existing = existingTeams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
        if (existing) {
          teamMap[teamName] = existing.id;
        } else {
          addLog(`Team "${teamName}" not found in database — will use fallback`, 'warn');
        }
      }
      addLog(`Matched ${Object.keys(teamMap).length}/${syncResult.teams.length} teams`);

      // Import work item types
      addLog('Importing work item types...');
      const typeMap = {};
      for (const typeName of syncResult.workAreaTypes) {
        if (!typeName) continue;
        const existing = existingWorkAreaTypes.find(t => t.name.toLowerCase() === typeName.toLowerCase());
        if (existing) {
          typeMap[typeName] = existing.id;
        } else {
          try {
            await createWorkAreaType.mutateAsync({ name: typeName });
            stats.typesCreated++;
            typeMap[typeName] = typeName;
            addLog(`Created type: ${typeName}`, 'success');
          } catch (err) {
            stats.errors.push(`Type ${typeName}: ${err.message}`);
            addLog(`Failed to create type "${typeName}": ${err.message}`, 'error');
          }
        }
      }

      // Import work items
      addLog(`Importing ${syncResult.workAreas.length} work items...`);
      for (const workArea of syncResult.workAreas) {
        try {
          const leadingTeamId = teamMap[workArea.leadingTeam] || Object.values(teamMap)[0] || existingTeams[0]?.id;
          if (!leadingTeamId) {
            stats.errors.push(`${workArea.key}: No team available`);
            addLog(`Skipped ${workArea.key} — no team available`, 'warn');
            continue;
          }

          const supportingTeamIds = workArea.supportingTeams.map(t => teamMap[t]).filter(Boolean);
          const newData = {
            name: workArea.name,
            prod_id: workArea.key,
            type: workArea.type || '',
            leading_team_id: leadingTeamId,
            supporting_team_ids: supportingTeamIds,
          };

          const existingWA = existingWorkAreas.find(wa => wa.prod_id === workArea.key);
          if (existingWA) {
            const hasChanged =
              existingWA.name !== newData.name ||
              existingWA.type !== newData.type ||
              existingWA.leading_team_id !== newData.leading_team_id ||
              JSON.stringify(existingWA.supporting_team_ids || []) !== JSON.stringify(supportingTeamIds);
            if (hasChanged) {
              await updateWorkArea.mutateAsync({ id: existingWA.id, workAreaData: newData });
              stats.workAreasUpdated++;
            } else {
              stats.workAreasSkipped++;
            }
          } else {
            await createWorkArea.mutateAsync({ ...newData, color: colors[stats.workAreasCreated % colors.length] });
            stats.workAreasCreated++;
          }
        } catch (err) {
          stats.errors.push(`${workArea.key}: ${err.message}`);
          addLog(`Error on ${workArea.key}: ${err.message}`, 'error');
        }
      }

      addLog(`Done — created ${stats.workAreasCreated}, updated ${stats.workAreasUpdated}, skipped ${stats.workAreasSkipped}`, 'success');
      if (stats.errors.length) addLog(`${stats.errors.length} error(s) — see above`, 'warn');

      setSyncResult({ ...syncResult, importStats: stats });
    } catch (err) {
      setError(err.message || 'Import failed');
      addLog(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSyncResult(null);
    setError(null);
    setLogs([]);
    setJql('project = PROD');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Jira</DialogTitle>
          <DialogDescription>Fetch Work Items directly from Jira using JQL</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection test */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={testing || fetching || importing}
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 mr-1.5" />}
              Test Connection
            </Button>
            <span className="text-xs text-muted-foreground">Verify Jira credentials before fetching</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jql">JQL Query</Label>
            <Textarea
              id="jql"
              placeholder='e.g., project = PROJ AND issuetype = "Product discovery"'
              value={jql}
              onChange={(e) => setJql(e.target.value)}
              disabled={importing || fetching}
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Example: project = MYPROJ AND issuetype = "Product discovery" AND status != Done
            </p>
          </div>

          <Button
            onClick={fetchFromJira}
            disabled={!jql.trim() || importing || fetching}
            className="w-full"
          >
            {fetching ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Fetching from Jira...</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" />Fetch from Jira</>
            )}
          </Button>

          {/* Log pane — always visible while there's output */}
          <LogPane entries={logs} />

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {syncResult && !syncResult.importStats && (() => {
            const stats = calculateWorkAreaStats(syncResult.workAreas);
            return (
              <Alert>
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">
                      Found {syncResult.totalIssues} issue{syncResult.totalIssues !== 1 ? 's' : ''}, {syncResult.workAreaTypes.length} type{syncResult.workAreaTypes.length !== 1 ? 's' : ''}, {syncResult.teams.length} team{syncResult.teams.length !== 1 ? 's' : ''}
                    </p>
                    <div className="mt-2 pt-2 border-t border-border/50 text-xs space-y-1">
                      <p className="font-semibold">What will happen:</p>
                      <ul className="space-y-0.5 ml-2">
                        <li>Add: <span className="font-medium text-green-600">{stats.toAdd}</span></li>
                        <li>Update: <span className="font-medium text-blue-600">{stats.toUpdate}</span></li>
                        <li>Skip (unchanged): <span className="font-medium text-amber-600">{stats.toSkip}</span></li>
                      </ul>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            );
          })()}

          {syncResult && syncResult.importStats && (
            <Alert>
              <CheckCircle2 className="w-4 h-4" />
              <AlertDescription>
                <p className="font-medium mb-1">Import completed</p>
                <ul className="list-disc list-inside text-sm space-y-0.5">
                  <li>Types created: {syncResult.importStats.typesCreated}</li>
                  <li>Work Items created: {syncResult.importStats.workAreasCreated}</li>
                  <li>Work Items updated: {syncResult.importStats.workAreasUpdated}</li>
                  <li>Work Items skipped: {syncResult.importStats.workAreasSkipped}</li>
                  {syncResult.importStats.errors.length > 0 && (
                    <li className="text-destructive">Errors: {syncResult.importStats.errors.length}</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {syncResult && !syncResult.importStats && (
            <Button onClick={importData} disabled={importing} className="w-full">
              {importing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
              ) : (
                'Import to Database'
              )}
            </Button>
          )}

          {syncResult && syncResult.importStats && (
            <Button onClick={handleClose} className="w-full" variant="outline">Close</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
