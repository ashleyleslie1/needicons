import { useState, useEffect, useRef } from "react";
import type { Project } from "@/lib/types";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const SIZES = [512, 256, 128, 64, 32, 16];
const FORMATS = [
  { value: "png", label: "PNG", disabled: false },
  { value: "webp", label: "WebP", disabled: false },
  { value: "svg", label: "SVG", disabled: true },
];

interface ExportDialogProps {
  project: Project;
  onClose: () => void;
}

export function ExportDialog({ project, onClose }: ExportDialogProps) {
  const [selectedSizes, setSelectedSizes] = useState<number[]>([512, 256, 128]);
  const [format, setFormat] = useState("png");
  const [exporting, setExporting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number; current_icon: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  function toggleSize(size: number) {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    );
  }

  useEffect(() => {
    if (!jobId) return;

    pollRef.current = setInterval(async () => {
      try {
        const status = await api.getExportStatus(project.id, jobId);
        setProgress({ completed: status.completed, total: status.total, current_icon: status.current_icon });

        if (status.status === "completed") {
          clearInterval(pollRef.current);
          const blob = await api.downloadExport(project.id, jobId);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `needicons-${project.name}.zip`;
          a.click();
          URL.revokeObjectURL(url);
          setExporting(false);
          setJobId(null);
          setProgress(null);
          onClose();
        } else if (status.status === "failed") {
          clearInterval(pollRef.current);
          setError(status.error ?? "Export failed");
          setExporting(false);
          setJobId(null);
        }
      } catch {
        clearInterval(pollRef.current);
        setError("Lost connection to server");
        setExporting(false);
        setJobId(null);
      }
    }, 500);

    return () => clearInterval(pollRef.current);
  }, [jobId, project.id, project.name, onClose]);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const result = await api.startExport(project.id, {
        sizes: selectedSizes.sort((a, b) => b - a),
        formats: [format],
      });
      setJobId(result.job_id);
      setProgress({ completed: 0, total: result.total, current_icon: "" });
    } catch {
      setError("Failed to start export");
      setExporting(false);
    }
  }

  const totalFiles = project.icons.length * selectedSizes.length;

  const ppParts: string[] = [];
  if (project.post_processing.stroke.enabled) ppParts.push("Outline");
  if (project.post_processing.shadow.enabled) ppParts.push("Shadow");
  if (project.post_processing.mask.shape !== "none") {
    ppParts.push(project.post_processing.mask.shape.replace("_", " "));
  }
  const ppSummary = ppParts.length > 0 ? ppParts.join(" + ") : "None";

  return (
    <Dialog open onOpenChange={() => !exporting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export {project.name}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {project.icons.length} icons &middot; {ppSummary}
          </p>
        </DialogHeader>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Sizes</div>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((size) => (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                disabled={exporting}
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  selectedSizes.includes(size)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground",
                  exporting && "opacity-50 cursor-not-allowed",
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Format</div>
          <div className="flex gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                onClick={() => !f.disabled && setFormat(f.value)}
                disabled={f.disabled || exporting}
                className={cn(
                  "rounded-lg border px-5 py-2 text-sm font-medium transition-colors",
                  (f.disabled || exporting) && "cursor-not-allowed opacity-40",
                  format === f.value && !f.disabled
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-muted p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Icons</span>
            <span className="text-foreground">{project.icons.length}</span>
          </div>
          <div className="mt-1.5 flex justify-between text-sm">
            <span className="text-muted-foreground">Sizes</span>
            <span className="text-foreground">{selectedSizes.sort((a, b) => b - a).join(", ")}</span>
          </div>
          <div className="mt-1.5 flex justify-between text-sm">
            <span className="text-muted-foreground">Format</span>
            <span className="text-foreground">{format.toUpperCase()}</span>
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total files</span>
              <span className="font-semibold text-foreground">{totalFiles} files</span>
            </div>
          </div>
        </div>

        {exporting && progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Processing{progress.current_icon ? `: ${progress.current_icon}` : "..."}</span>
              <span>{progress.completed}/{progress.total}</span>
            </div>
            <Progress value={(progress.completed / progress.total) * 100} />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-500">
            {error}
          </div>
        )}

        <Button
          onClick={handleExport}
          disabled={exporting || selectedSizes.length === 0 || project.icons.length === 0}
          className="w-full"
        >
          {exporting ? "Exporting..." : "Download ZIP"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
