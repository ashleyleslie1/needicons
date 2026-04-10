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
import { Slider } from "@/components/ui/slider";

const SIZES = [1024, 512, 256, 128, 64, 32, 16];
const FORMATS = [
  { value: "png", label: "PNG", disabled: false },
  { value: "webp", label: "WebP", disabled: false },
  { value: "svg", label: "SVG", disabled: false },
];

interface ExportDialogProps {
  project: Project;
  onClose: () => void;
}

export function ExportDialog({ project, onClose }: ExportDialogProps) {
  const [selectedSizes, setSelectedSizes] = useState<number[]>([1024, 512, 256, 128]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(["png", "svg"]);
  const [svgSmoothing, setSvgSmoothing] = useState(1);
  const [svgOptimize, setSvgOptimize] = useState(false);
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

  function toggleFormat(fmt: string) {
    setSelectedFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt],
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
        formats: selectedFormats,
        svg_smoothing: svgSmoothing,
        svg_optimize: svgOptimize,
      });
      setJobId(result.job_id);
      setProgress({ completed: 0, total: result.total, current_icon: "" });
    } catch {
      setError("Failed to start export");
      setExporting(false);
    }
  }

  const rasterFormats = selectedFormats.filter((f) => f !== "svg");
  const hasSvg = selectedFormats.includes("svg");
  const totalFiles = project.icons.length * selectedSizes.length * rasterFormats.length
    + (hasSvg ? project.icons.length : 0);

  return (
    <Dialog open onOpenChange={() => !exporting && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export {project.name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {project.icons.length} {project.icons.length === 1 ? "icon" : "icons"}
          </p>
        </DialogHeader>

        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sizes</div>
          <div className="flex flex-wrap gap-1.5">
            {SIZES.map((size) => (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                disabled={exporting}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                  selectedSizes.includes(size)
                    ? "bg-accent/15 text-accent shadow-sm"
                    : "bg-card/60 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-card",
                  exporting && "opacity-50 cursor-not-allowed",
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Format</div>
          <div className="flex gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                onClick={() => !f.disabled && toggleFormat(f.value)}
                disabled={f.disabled || exporting}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-xs font-medium transition-all",
                  (f.disabled || exporting) && "cursor-not-allowed opacity-30",
                  selectedFormats.includes(f.value) && !f.disabled
                    ? "bg-accent/15 text-accent shadow-sm"
                    : "bg-card/60 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-card",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* SVG settings — shown when SVG format selected */}
        {hasSvg && (
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">SVG Settings</div>
            <div className="space-y-3 rounded-xl bg-card/40 backdrop-blur-sm border border-border/50 p-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Smoothing</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{svgSmoothing}/5</span>
                </div>
                <Slider
                  value={[svgSmoothing]}
                  onValueChange={([v]) => setSvgSmoothing(v)}
                  min={1}
                  max={5}
                  step={1}
                  disabled={exporting}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Optimize</span>
                <button
                  onClick={() => setSvgOptimize(!svgOptimize)}
                  disabled={exporting}
                  className={cn(
                    "text-xs px-2.5 py-0.5 rounded-full transition-all",
                    svgOptimize ? "bg-accent/15 text-accent" : "bg-card/60 text-muted-foreground",
                    exporting && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {svgOptimize ? "On" : "Off"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-card/40 backdrop-blur-sm border border-border/50 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Icons</span>
            <span className="text-foreground">{project.icons.length}</span>
          </div>
          {rasterFormats.length > 0 && (
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-muted-foreground">Sizes</span>
              <span className="text-foreground">{selectedSizes.sort((a, b) => b - a).join(", ")}</span>
            </div>
          )}
          <div className="mt-1.5 flex justify-between text-sm">
            <span className="text-muted-foreground">Formats</span>
            <span className="text-foreground">
              {selectedFormats.map((f) => f.toUpperCase()).join(", ")}
              {hasSvg && rasterFormats.length > 0 && <span className="text-muted-foreground text-xs ml-1">(SVG is scalable)</span>}
            </span>
          </div>
          <div className="mt-2 border-t border-border/50 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total files</span>
              <span className="font-semibold text-foreground">{totalFiles}</span>
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
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <Button
          onClick={handleExport}
          disabled={exporting || selectedSizes.length === 0 || selectedFormats.length === 0 || project.icons.length === 0}
          className="w-full shadow-lg shadow-accent/20"
        >
          {exporting ? "Exporting..." : "Download ZIP"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
