import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileJson, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import PageHeader from "../components/shared/PageHeader";

export default function JiraImport() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [mapping, setMapping] = useState({
    defaultType: "Product",
  });
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: workAreaTypes = [] } = useQuery({
    queryKey: ["workAreaTypes"],
    queryFn: () => base44.entities.WorkAreaType.list(),
  });

  const createWorkArea = useMutation({
    mutationFn: (data) => base44.entities.WorkArea.create(data),
  });

  const createWorkAreaType = useMutation({
    mutationFn: (data) => base44.entities.WorkAreaType.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workAreaTypes"] }),
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Fetch and parse CSV directly
      const response = await fetch(file_url);
      const text = await response.text();
      
      // Simple CSV parser
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        setResult({ success: false, message: "CSV file is empty or has no data rows" });
        setUploading(false);
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const items = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const item = {};
        headers.forEach((header, index) => {
          item[header] = values[index] || '';
        });
        items.push(item);
      }
      
      console.log("CSV Headers:", headers);
      console.log("Parsed items:", items.length, items[0]);

      // Import each item as a WorkArea
      const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
      let imported = 0;
      let failed = 0;

      // Create team name -> ID lookup
      const teamNameMap = Object.fromEntries(
        teams.map(t => [t.name.toLowerCase().trim(), t.id])
      );

      // Create work area type name -> exists lookup and track new types to create
      const existingTypeNames = new Set(workAreaTypes.map(t => t.name.toLowerCase().trim()));
      const newTypesToCreate = new Set();

      // First pass: collect unique types from CSV "Type" field only
      for (const item of items) {
        const typeName = item.Type || item.type;
        if (typeName && typeName.trim() && !existingTypeNames.has(typeName.toLowerCase().trim())) {
          newTypesToCreate.add(typeName.trim());
        }
      }

      // Create missing types
      for (const typeName of newTypesToCreate) {
        try {
          await createWorkAreaType.mutateAsync({
            name: typeName,
            description: "",
            order: workAreaTypes.length + Array.from(newTypesToCreate).indexOf(typeName),
          });
          existingTypeNames.add(typeName.toLowerCase());
        } catch (error) {
          console.error("Failed to create work area type:", typeName, error);
        }
      }

      // Second pass: import work areas
      for (const item of items) {
        // Use "Summary" field for work area name
        const itemName = item.Summary || item.summary || 
                        item.Name || item.name || item.Title || item.title;
        
        if (!itemName || !itemName.trim()) {
          console.log("Skipping item without name:", item);
          continue;
        }

        // Map leading team
        const leadingTeamName = item['Leading Team'] || item['leading team'] || item.LeadingTeam;
        const leadingTeamId = leadingTeamName 
          ? teamNameMap[leadingTeamName.toLowerCase().trim()] 
          : null;

        if (!leadingTeamId) {
          console.log("Skipping item without valid leading team:", itemName, leadingTeamName);
          failed++;
          continue;
        }

        // Map supporting teams (comma-separated)
        const contributingTeamsField = item['Contributing Teams'] || item['contributing teams'] || item.ContributingTeams || '';
        const supportingTeamIds = contributingTeamsField
          .split(',')
          .map(name => name.trim())
          .filter(name => name.length > 0)
          .map(name => teamNameMap[name.toLowerCase()])
          .filter(id => id); // Remove undefined/null values

        try {
          await createWorkArea.mutateAsync({
            name: itemName.trim(),
            type: item.Type || item.type || mapping.defaultType,
            leading_team_id: leadingTeamId,
            supporting_team_ids: supportingTeamIds,
            color: colors[imported % colors.length],
          });
          imported++;
        } catch (error) {
          console.error("Failed to import item:", itemName, error);
          failed++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["workAreas"] });
      setResult({ success: true, imported, failed, total: items.length });
      setFile(null);
    } catch (error) {
      setResult({ success: false, message: error.message || "Import failed" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <PageHeader 
        title="Jira Import" 
        subtitle="Import Product Discovery items from Jira CSV/JSON exports"
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Jira Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Export File</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {file.name.endsWith('.json') ? <FileJson className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                    <span className="truncate max-w-[150px]">{file.name}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Export your Jira Product Discovery items as CSV. Required columns: "Summary" and "Leading Team".
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold">Import Settings</h3>
              
              <div className="space-y-2">
                <Label>Default Type</Label>
                <Input 
                  value={mapping.defaultType} 
                  onChange={(e) => setMapping({ ...mapping, defaultType: e.target.value })}
                  placeholder="e.g. Product, Feature, Project"
                />
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
                <p><strong>Expected CSV columns:</strong></p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li><strong>Summary</strong> - Work area name (required)</li>
                  <li><strong>Leading Team</strong> - Team name for leading team (required)</li>
                  <li><strong>Contributing Teams</strong> - Comma-separated team names (optional)</li>
                  <li><strong>Type</strong> - Work area type (optional, defaults to "{mapping.defaultType}")</li>
                </ul>
              </div>
            </div>

            {result && (
              <div className={`p-4 rounded-lg border ${result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    {result.success ? (
                      <>
                        <p className="font-medium text-green-900">Import Successful</p>
                        <p className="text-sm text-green-700 mt-1">
                          {result.imported} of {result.total} items imported
                          {result.failed > 0 && ` (${result.failed} failed)`}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-red-900">Import Failed</p>
                        <p className="text-sm text-red-700 mt-1">{result.message}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Button 
              onClick={handleImport} 
              disabled={!file || uploading}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Importing..." : "Import to Work Areas"}
            </Button>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">How to Export from Jira</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ol className="list-decimal list-inside space-y-2">
              <li>Open your Jira Product Discovery project</li>
              <li>Go to the list view of your products/ideas</li>
              <li>Click the "..." menu and select "Export"</li>
              <li>Choose CSV format</li>
              <li>Ensure your export includes "Summary", "Leading Team", and optionally "Contributing Teams" columns</li>
              <li>Upload the exported file above</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}