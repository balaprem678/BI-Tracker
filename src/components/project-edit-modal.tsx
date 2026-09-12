import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, Pencil, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProject, deleteProject, type Project, normalizeProjectStatus, normalizeProjectPriority } from "@/lib/project.functions";

export function ProjectEditModal({
  project,
  subAdmins,
  isOpen,
  onClose,
  onSuccess,
}: {
  project: Project | null;
  subAdmins: { id: string; full_name: string; email?: string | null }[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const updateProjectFn = useServerFn(updateProject);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [status, setStatus] = useState<"Not Started" | "In Progress" | "Completed" | "Delayed">("Not Started");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [deadline, setDeadline] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<number>(0);
  const [assignedSubAdminId, setAssignedSubAdminId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setCode(project.code || "");
      setDescription(project.description || "");
      setPriority(normalizeProjectPriority(project.priority));
      setStatus(normalizeProjectStatus(project.status));
      setProgressPercent(Number(project.progress_percent || 0));
      setDeadline(project.deadline ? project.deadline.slice(0, 10) : "");
      setEstimatedHours(Number(project.estimated_hours || 0));
      setAssignedSubAdminId(project.assigned_sub_admin_id || "");
      setErrorMsg("");
    }
  }, [project, isOpen]);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateProjectFn>[0]["data"]) => updateProjectFn({ data }),
    onSuccess: (res) => {
      toast.success(res.message || "Project updated successfully");
      queryClient.invalidateQueries({ queryKey: ["my-projects"] });
      queryClient.refetchQueries({ queryKey: ["my-projects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-monitoring-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-hourly-report"] });
      queryClient.invalidateQueries({ queryKey: ["all-leaves-search"] });
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      let msg = err.message || "Failed to update project. Please try again.";
      try {
        const parsed = JSON.parse(msg);
        if (Array.isArray(parsed) && parsed[0]?.message) {
          msg = parsed.map((e: any) => e.message).join(". ");
        }
      } catch {
        // use raw msg string
      }
      setErrorMsg(msg);
      toast.error(msg);
    },
  });

  if (!isOpen || !project) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Project name is required.");
      return;
    }

    updateMutation.mutate({
      id: project.id,
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
      priority,
      status,
      progressPercent: Math.min(100, Math.max(0, Number(progressPercent) || 0)),
      deadline: deadline || undefined,
      estimatedHours: Math.max(0, Number(estimatedHours) || 0),
      assignedSubAdminId: assignedSubAdminId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="flex items-center justify-between border-b border-border pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Pencil className="size-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Edit Project Details</h3>
              <p className="text-xs text-muted-foreground">
                Update project metadata, status, delivery timeline, and workforce leader.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-foreground mb-1">Project Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Mobile App Redesign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">Project Code</label>
              <input
                type="text"
                placeholder="e.g. PRJ-2026-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">Project Status</label>
              <select
                value={status}
                onChange={(e) => {
                  const s = e.target.value as any;
                  setStatus(s);
                  if (s === "Completed") setProgressPercent(100);
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Delayed">Delayed</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-foreground">Progress Completion</label>
                <span className="font-bold text-primary">{progressPercent}%</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progressPercent}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setProgressPercent(val);
                    if (val === 100 && status !== "Completed") {
                      setStatus("Completed");
                    }
                  }}
                  className="w-full accent-primary cursor-pointer"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={progressPercent}
                  onChange={(e) => setProgressPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-14 rounded-md border border-input bg-background px-1.5 py-1 text-center font-semibold text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-foreground mb-1">Target Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-foreground mb-1">Estimated Hours</label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">Assigned Sub-Admin Lead</label>
            <select
              value={assignedSubAdminId}
              onChange={(e) => setAssignedSubAdminId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="">-- Unassigned --</option>
              {subAdmins.map((sa) => (
                <option key={sa.id} value={sa.id}>
                  {sa.full_name} {sa.email ? `(${sa.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-foreground mb-1">Project Description</label>
            <textarea
              rows={3}
              placeholder="Describe deliverables, requirements, client details, and project objectives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 border-t border-border pt-4">
            <button
              type="button"
              disabled={updateMutation.isPending}
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ProjectDeleteModal({
  project,
  isOpen,
  onClose,
  onSuccess,
}: {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const deleteProjectFn = useServerFn(deleteProject);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProjectFn({ data: { id } }),
    onSuccess: () => {
      toast.success(`Project "${project?.name}" deleted successfully.`);
      queryClient.invalidateQueries({ queryKey: ["my-projects"] });
      queryClient.refetchQueries({ queryKey: ["my-projects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-monitoring-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-hourly-report"] });
      queryClient.invalidateQueries({ queryKey: ["all-leaves-search"] });
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Could not delete project.");
    },
  });

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-destructive/10 p-2.5 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-foreground">Delete Project</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Are you sure you want to permanently delete project{" "}
              <strong className="text-foreground">{project.name}</strong>
              {project.code ? ` (${project.code})` : ""}?
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive space-y-1">
          <p className="font-semibold">⚠️ Irreversible Action</p>
          <p className="text-[11px] text-destructive/80">
            This will permanently remove all team assignments and associated session logs for this project from the database.
          </p>
        </div>

        <div className="flex justify-end gap-2.5 border-t border-border pt-4">
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(project.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground shadow-sm hover:bg-destructive/90 transition-all disabled:opacity-50"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="size-3.5" />
                Yes, Delete Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
