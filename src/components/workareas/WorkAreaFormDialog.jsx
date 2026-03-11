import React, { useState, useEffect } from "react";
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

export default function WorkAreaFormDialog({ open, onOpenChange, workArea, teams, onSave, existingTypes = [] }) {
  const [form, setForm] = useState({
    name: "", type: "Product", team_id: "", is_cross_team: true, color: areaColors[0]
  });
  const [customType, setCustomType] = useState("");
  const [showCustomType, setShowCustomType] = useState(false);
  
  const allTypes = [...new Set([...existingTypes, "Product", "Feature", "Project", "Support/Maintenance"])];

  useEffect(() => {
    if (workArea) {
      setForm({
        name: workArea.name,
        type: workArea.type,
        team_id: workArea.team_id || "",
        is_cross_team: workArea.is_cross_team ?? true,
        color: workArea.color || areaColors[0],
      });
    } else {
      setForm({ name: "", type: "Product", team_id: "", is_cross_team: true, color: areaColors[Math.floor(Math.random() * areaColors.length)] });
    }
  }, [workArea, open]);

  const handleAddCustomType = () => {
    if (customType.trim()) {
      setForm({ ...form, type: customType.trim() });
      setCustomType("");
      setShowCustomType(false);
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const data = { ...form };
    if (data.is_cross_team) data.team_id = "";
    onSave(data);
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
            {!showCustomType ? (
              <div className="flex gap-2">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowCustomType(true)}
                  title="Add custom type"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input 
                  value={customType} 
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Enter custom type"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomType()}
                />
                <Button type="button" onClick={handleAddCustomType} size="sm">Add</Button>
                <Button type="button" variant="outline" onClick={() => setShowCustomType(false)} size="sm">Cancel</Button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Label>Cross-team</Label>
            <Switch checked={form.is_cross_team} onCheckedChange={(v) => setForm({ ...form, is_cross_team: v })} />
          </div>
          {!form.is_cross_team && (
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={form.team_id} onValueChange={(v) => setForm({ ...form, team_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
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
          <Button onClick={handleSave} disabled={!form.name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}