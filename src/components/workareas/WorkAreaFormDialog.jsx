import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";

const areaColors = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#6366f1"
];

export default function WorkAreaFormDialog({ open, onOpenChange, workArea, teams, onSave }) {
  const [form, setForm] = useState({
    name: "", type: "", leading_team_id: "", supporting_team_ids: [], color: areaColors[0]
  });

  const { data: workAreaTypes = [] } = useQuery({
    queryKey: ["workAreaTypes"],
    queryFn: () => base44.entities.WorkAreaType.list("order"),
  });

  const allTypes = workAreaTypes.map(t => t.name);

  useEffect(() => {
    if (workArea) {
      setForm({
        name: workArea.name,
        type: workArea.type,
        leading_team_id: workArea.leading_team_id || "",
        supporting_team_ids: workArea.supporting_team_ids || [],
        color: workArea.color || areaColors[0],
      });
    } else {
      setForm({ name: "", type: allTypes[0] || "", leading_team_id: "", supporting_team_ids: [], color: areaColors[Math.floor(Math.random() * areaColors.length)] });
    }
  }, [workArea, open, allTypes]);

  const toggleSupportingTeam = (teamId) => {
    const current = form.supporting_team_ids || [];
    if (current.includes(teamId)) {
      setForm({ ...form, supporting_team_ids: current.filter(id => id !== teamId) });
    } else {
      setForm({ ...form, supporting_team_ids: [...current, teamId] });
    }
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.leading_team_id) return;
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{workArea ? "Edit Work Area" : "New Work Area"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Payment Feature" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {allTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {allTypes.length === 0 && (
              <p className="text-xs text-muted-foreground">No types available. Create types in Work Area Types page.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Leading Team *</Label>
            <Select value={form.leading_team_id} onValueChange={(v) => setForm({ ...form, leading_team_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select leading team" /></SelectTrigger>
              <SelectContent>
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Supporting Teams (optional)</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {teams.filter(t => t.id !== form.leading_team_id).length === 0 ? (
                <p className="text-xs text-muted-foreground">No other teams available</p>
              ) : (
                teams.filter(t => t.id !== form.leading_team_id).map(team => (
                  <label key={team.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(form.supporting_team_ids || []).includes(team.id)}
                      onChange={() => toggleSupportingTeam(team.id)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">{team.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {areaColors.map(c => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-primary" : "opacity-60 hover:opacity-100"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name.trim() || !form.leading_team_id || !form.type}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}