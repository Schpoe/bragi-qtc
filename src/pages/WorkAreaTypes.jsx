import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PageHeader from "../components/shared/PageHeader";
import EmptyState from "../components/shared/EmptyState";

export default function WorkAreaTypes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const queryClient = useQueryClient();

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["workAreaTypes"],
    queryFn: () => base44.entities.WorkAreaType.list("order"),
  });

  const createType = useMutation({
    mutationFn: (data) => base44.entities.WorkAreaType.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workAreaTypes"] });
      setDialogOpen(false);
      setFormData({ name: "", description: "" });
    },
  });

  const updateType = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorkAreaType.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workAreaTypes"] });
      setDialogOpen(false);
      setFormData({ name: "", description: "" });
      setEditing(null);
    },
  });

  const deleteType = useMutation({
    mutationFn: (id) => base44.entities.WorkAreaType.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workAreaTypes"] }),
  });

  const handleSave = () => {
    const data = {
      name: formData.name.trim(),
      description: formData.description.trim(),
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
    setFormData({ name: type.name, description: type.description || "" });
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setFormData({ name: "", description: "" });
    setDialogOpen(true);
  };

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
        <EmptyState icon={Tag} title="No work area types yet" description="Create categories to organize your work areas.">
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-2" /> Create First Type
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {types.map(type => (
            <Card key={type.id} className="group hover:shadow-md transition-all">
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
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
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "New"} Work Area Type</DialogTitle>
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