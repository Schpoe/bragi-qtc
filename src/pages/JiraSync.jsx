import React, { useState } from "react";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

export default function JiraSync() {
  const [jql, setJql] = useState('project = PROD');
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [fetching, setFetching] = useState(false);

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
        
        if (hasChanged) {
          toUpdate++;
        } else {
          toSkip++;
        }
      }
    }
    
    return { toAdd, toUpdate, toSkip };
  };
  
  const queryClient = useQueryClient();

  const { data: existingTeams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => bragiQTC.entities.Team.list(),
  });

  const { data: existingWorkAreaTypes = [] } = useQuery({
    queryKey: ['workAreaTypes'],
    queryFn: () => bragiQTC.entities.WorkAreaType.list(),
  });

  const { data: existingWorkAreas = [] } = useQuery({
    queryKey: ['workAreas'],
    queryFn: () => bragiQTC.entities.WorkArea.list(),
  });

  const createTeam = useMutation({
    mutationFn: (teamData) => bragiQTC.entities.Team.create(teamData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
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

  const fetchFromJira = async () => {
    setError(null);
    setSyncResult(null);
    setFetching(true);
    
    try {
      const response = await bragiQTC.functions.invoke('jiraSync', {
        jql: jql.trim()
      });

      if (response.data.error) {
        setError(response.data.error);
        return;
      }

      setSyncResult(response.data);
    } catch (err) {
      setError(err.message || 'Failed to fetch from Jira');
    } finally {
      setFetching(false);
    }
  };

  const importData = async () => {
    if (!syncResult) return;

    setImporting(true);
    setError(null);

    try {
      const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f97316', '#ec4899', '#14b8a6'];
      let stats = {
       teamsCreated: 0,
       typesCreated: 0,
       workAreasCreated: 0,
       workAreasUpdated: 0,
       workAreasSkipped: 0,
       errors: []
      };

      // Map teams to existing teams only (don't create new ones)
      const teamMap = {};
      for (const teamName of syncResult.teams) {
        const existing = existingTeams.find(t => t.name.toLowerCase() === teamName.toLowerCase());
        if (existing) {
          teamMap[teamName] = existing.id;
        }
      }

      // Import work item types
      const typeMap = {};
      for (const typeName of syncResult.workAreaTypes) {
        if (!typeName) continue;
        
        const existing = existingWorkAreaTypes.find(t => t.name.toLowerCase() === typeName.toLowerCase());
        if (existing) {
          typeMap[typeName] = existing.id;
        } else {
          try {
            await createWorkAreaType.mutateAsync({
              name: typeName,
              order: stats.typesCreated
            });
            stats.typesCreated++;
            typeMap[typeName] = typeName;
          } catch (err) {
            stats.errors.push(`Type ${typeName}: ${err.message}`);
          }
        }
      }

      // Import work items
      for (const workArea of syncResult.workAreas) {
        try {
          // Use first team as leading team, or first existing team as fallback
          const leadingTeamId = teamMap[workArea.leadingTeam] || Object.values(teamMap)[0] || existingTeams[0]?.id;

          if (!leadingTeamId) {
            stats.errors.push(`Work Item ${workArea.name}: No team available`);
            continue;
          }

          const supportingTeamIds = workArea.supportingTeams
            .map(t => teamMap[t])
            .filter(Boolean);

          const newData = {
            name: workArea.name,
            prod_id: workArea.key,
            type: workArea.type || '',
            leading_team_id: leadingTeamId,
            supporting_team_ids: supportingTeamIds
          };

          // Check if work item already exists by prod_id
          const existingWA = existingWorkAreas.find(wa => wa.prod_id === workArea.key);

          if (existingWA) {
            // Check if anything changed
            const hasChanged = 
              existingWA.name !== newData.name ||
              existingWA.type !== newData.type ||
              existingWA.leading_team_id !== newData.leading_team_id ||
              JSON.stringify(existingWA.supporting_team_ids || []) !== JSON.stringify(supportingTeamIds);

            if (hasChanged) {
              await updateWorkArea.mutateAsync({
                id: existingWA.id,
                workAreaData: newData
              });
              stats.workAreasUpdated++;
            } else {
              stats.workAreasSkipped++;
            }
          } else {
            // Create new work item
            await createWorkArea.mutateAsync({
              ...newData,
              color: colors[stats.workAreasCreated % colors.length]
            });
            stats.workAreasCreated++;
          }
        } catch (err) {
          stats.errors.push(`Work Item ${workArea.name}: ${err.message}`);
        }
      }

      setSyncResult({ ...syncResult, importStats: stats });
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jira Sync"
        subtitle="Import Work Items, Types, and Teams directly from Jira"
      />

      <Card>
        <CardHeader>
          <CardTitle>Connect to Jira</CardTitle>
          <CardDescription>
            Enter a JQL query to fetch Product Discovery issues from Jira
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jql">JQL Query</Label>
            <Textarea
              id="jql"
              placeholder='e.g., project = PROJ AND type = "Product discovery"'
              value={jql}
              onChange={(e) => setJql(e.target.value)}
              disabled={importing}
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Example: project = MYPROJ AND type = "Product discovery" AND status != Done
            </p>
          </div>
          <Button 
            onClick={fetchFromJira} 
            disabled={!jql.trim() || importing || fetching}
            className="w-full"
          >
            {fetching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Fetching from Jira...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Fetch from Jira
              </>
            )}
          </Button>

          {fetching && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fetching Product Discovery issues...</span>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
              <Progress value={50} className="h-2" />
            </div>
          )}

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
                    <p>Found {syncResult.totalIssues} issues, {syncResult.workAreaTypes.length} types, and {syncResult.teams.length} teams</p>
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-1 text-xs">
                      <p className="font-semibold">Work Item Summary:</p>
                      <ul className="space-y-1 ml-2">
                        <li>Will be added: <span className="font-medium text-green-600">{stats.toAdd}</span></li>
                        <li>Will be updated: <span className="font-medium text-blue-600">{stats.toUpdate}</span></li>
                        <li>Will be skipped (no changes): <span className="font-medium text-amber-600">{stats.toSkip}</span></li>
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
                <div className="space-y-1">
                  <p>Import completed:</p>
                  <ul className="list-disc list-inside text-sm">
                     <li>Types created: {syncResult.importStats.typesCreated}</li>
                    <li>Work Items created: {syncResult.importStats.workAreasCreated}</li>
                    <li>Work Items updated: {syncResult.importStats.workAreasUpdated}</li>
                    <li>Work Items skipped: {syncResult.importStats.workAreasSkipped}</li>
                    {syncResult.importStats.errors.length > 0 && (
                      <li className="text-destructive">Errors: {syncResult.importStats.errors.length}</li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {syncResult && !syncResult.importStats && (
        <Card>
          <CardContent className="pt-6">
            <Button 
              onClick={importData} 
              disabled={importing}
              className="w-full"
              size="lg"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import to Database'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {syncResult && syncResult.workAreas && syncResult.workAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Issues found in Jira</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {syncResult.workAreas.slice(0, 20).map((wa, idx) => (
                <div key={idx} className="p-3 border rounded space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{wa.key}</span>
                    <span className="flex-1 font-medium text-sm">{wa.name}</span>
                    {wa.type && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{wa.type}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {wa.leadingTeam && (
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Leading:</span>
                        <span className="bg-secondary px-2 py-0.5 rounded">{wa.leadingTeam}</span>
                      </div>
                    )}
                    {wa.supportingTeams && wa.supportingTeams.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Supporting:</span>
                        <span className="bg-secondary px-2 py-0.5 rounded">{wa.supportingTeams.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {syncResult.workAreas.length > 20 && (
                <p className="text-sm text-muted-foreground text-center">
                  ... and {syncResult.workAreas.length - 20} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}