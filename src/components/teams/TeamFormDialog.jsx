import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ColorPicker from "@/components/shared/ColorPicker";
import { teamColorHex } from "@/lib/utils";

// Convert a stored color value (named or hex) to a hex string for the picker
function toHex(color) {
  if (!color) return "#3b82f6";
  if (color.startsWith("#")) return color;
  return teamColorHex[color] ?? "#3b82f6";
}

export default function TeamFormDialog({ open, onOpenChange, team, onSave }) {
  const [form, setForm] = useState({ name: "", description: "", color: "#3b82f6", jira_project_key: "" });

  useEffect(() => {
    if (team) {
      setForm({ name: team.name, description: team.description || "", color: toHex(team.color), jira_project_key: team.jira_project_key || "" });
    } else {
      setForm({ name: "", description: "", color: "#3b82f6", jira_project_key: "" });
    }
  }, [team, open]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? "Edit Team" : "New Team"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mobile Team" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker
              value={form.color}
              onChange={(c) => setForm({ ...form, color: c || "#3b82f6" })}
            />
          </div>
          <div className="space-y-2">
            <Label>Jira Project Key</Label>
            <Input
              value={form.jira_project_key}
              onChange={(e) => setForm({ ...form, jira_project_key: e.target.value.toUpperCase() })}
              placeholder="e.g. MOBILE"
            />
            <p className="text-xs text-muted-foreground">Used to fetch quarterly actuals from Jira</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
