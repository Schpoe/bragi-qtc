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
    defaultTeamId: "",
    isCrossTeam: true,
  });
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const createWorkArea = useMutation({
    mutationFn: (data) => base44.entities.WorkArea.create(data),
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

      // Extract data from file
      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
      });

      if (extractResult.status === "error") {
        setResult({ success: false, message: extractResult.details || "Failed to extract data from file" });
        setUploading(false);
        return;
      }

      const items = extractResult.output?.items || extractResult.output || [];
      if (!Array.isArray(items)) {
        setResult({ success: false, message: "Invalid file format" });
        setUploading(false);
        return;
      }

      // Import each item as a WorkArea
      const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
      let imported = 0;
      let failed = 0;

      for (const item of items) {
        if (!item.name) continue;

        try {
          await createWorkArea.mutateAsync({
            name: item.name,
            type: item.type || mapping.defaultType,
            team_id: mapping.isCrossTeam ? "" : mapping.defaultTeamId,
            is_cross_team: mapping.isCrossTeam,
            color: colors[imported % colors.length],
          });
          imported++;
        } catch (error) {
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
                Export your Jira Product Discovery items as CSV or JSON. The file should contain at least a "name" column/field.
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

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="crossTeam"
                  checked={mapping.isCrossTeam}
                  onChange={(e) => setMapping({ ...mapping, isCrossTeam: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <Label htmlFor="crossTeam" className="cursor-pointer">Import as cross-team work areas</Label>
              </div>

              {!mapping.isCrossTeam && (
                <div className="space-y-2">
                  <Label>Assign to Team</Label>
                  <Select value={mapping.defaultTeamId} onValueChange={(v) => setMapping({ ...mapping, defaultTeamId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
              disabled={!file || uploading || (!mapping.isCrossTeam && !mapping.defaultTeamId)}
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
              <li>Choose CSV or JSON format</li>
              <li>Ensure your export includes at least the "name" or "title" field</li>
              <li>Upload the exported file above</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}