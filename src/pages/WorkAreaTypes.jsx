import React, { useState } from "react";
import { bragiQTC } from "@/api/bragiQTCClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";
import { useAuth } from "@/lib/AuthContext";
import { canManageWorkAreaTypes, isViewer } from "@/lib/permissions";
import { getWorkAreaTypeColor } from "@/lib/utils";

const PRESET_COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#6366f1", "#84cc16", "#f97316",
  "#14b8a6", "#a855f7", "#f43f5e", "#0ea5e9", "#64748b",
];

function ColorPicker({ value, onChange }) {
  const activeColor = value || "";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="w-7 h-7 rounded-full border-2 transition-all"
            style={{
              backgroundColor: c,
              borderColor: activeColor === c ? "#000" : "transparent",
              boxShadow: activeColor === c ? "0 0 0 1px #fff inset" : "none",
            }}
            title={c}
          />
        ))}
        {/* Custom color via native picker */}
        <label className="w-7 h-7 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:border-muted-foreground transition-colors overflow-hidden relative" title="Custom color">
          <span className="text-xs text-muted-foreground leading-none select-none">+</span>
          <input
            type="color"
            value={activeColor || "#6b7280"}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
        {activeColor && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-muted-foreground hover:text-foreground px-2 h-7 rounded border border-dashed border-muted-foreground/40"
          >
            Auto
          </button>
        )}
      </div>
      {activeColor && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: activeColor }} />
          {activeColor}
        </div>
      )}
    </div>
  );
}

export default function WorkAreaTypes() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "", color: "" });
  const queryClient = useQueryClient();

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["workAreaTypes"],
    queryFn: () => bragiQTC.entities.WorkAreaType.list(),
  });

  const createType = useMutation({
    mutationFn: (data) => bragiQTC.entities.WorkAreaType.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workAreaTypes"] });
      setDialogOpen(false);
      setFormData({ name: "", description: "", color: "" });
    },
  });

  const updateType = useMutation({
    mutationFn: ({ id, data }) => bragiQTC.entities.WorkAreaType.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workAreaTypes"] });
      setDialogOpen(false);
      setFormData({ name: "", description: "", color: "" });
      setEditing(null);
    },
  });

  const deleteType = useMutation({
    mutationFn: (id) => bragiQTC.entities.WorkAreaType.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workAreaTypes"] }),
  });

  const handleSave = () => {
    const data = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      color: formData.color || null,
      order: editing ? editing.order : types.length,
    };
    if (editing) {
      updateType.mutate({ id: editing.id, data });
    } else {
      createType.mutate(data);
    }
  };

  const handleEdit = (type) => {
    setEditing(type);
    setFormData({ name: type.name, description: type.description || "", color: type.color || "" });
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setFormData({ name: "", description: "", color: "" });
    setDialogOpen(true);
  };

  if (isViewer(user)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
          <Tag className="w-7 h-7 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Access Restricted</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">Viewers don't have access to Work Item Types.</p>
      </div>
    );
  }

  if (!canManageWorkAreaTypes(user)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
          <Tag className="w-7 h-7 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Access Restricted</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">Only administrators can manage work item types.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Work Item Types" subtitle="Manage categories for work items">
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" /> New Type
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : types.length === 0 ? (
        <EmptyState icon={Tag} title="No work item types yet" description="Create categories to organize your work items.">
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-2" /> Create First Type
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {types.map(type => {
            const color = type.color || getWorkAreaTypeColor(type.name);
            return (
              <Card key={type.id} className="group hover:shadow-md transition-all">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{type.name}</p>
                      {type.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(type)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteType.mutate(type.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "New"} Work Item Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Product, Feature, Project"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker
                value={formData.color}
                onChange={(c) => setFormData({ ...formData, color: c })}
              />
              <p className="text-xs text-muted-foreground">
                Leave on Auto to use the default assigned color.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
