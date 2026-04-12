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
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";

const SIZES = [1024, 512, 256, 128, 64, 32, 16];

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
  const styles = [...new Set(project.icons.map((i) => i.style))];

  return (
    <Dialog open onOpenChange={() => !exporting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export Pack</DialogTitle>
        </DialogHeader>

        {/* Pack summary */}
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{project.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {project.icons.length} icons · {styles.length} {styles.length === 1 ? "style" : "styles"} · {styles.join(", ")}
            </p>
          </div>
        </div>

        {/* Formats */}
        <div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Formats</div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "png", label: "PNG", desc: "Lossless raster" },
              { value: "webp", label: "WebP", desc: "Smaller file size" },
              { value: "svg", label: "SVG", desc: "Scalable vector" },
            ] as const).map((f) => (
              <button
                key={f.value}
                onClick={() => toggleFormat(f.value)}
                disabled={exporting}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-all",
                  selectedFormats.includes(f.value)
                    ? "border-accent bg-accent/10 shadow-sm"
                    : "border-border/50 bg-card/40 hover:border-border",
                  exporting && "opacity-50 pointer-events-none",
                )}
              >
                <span className={cn("text-xs font-semibold block", selectedFormats.includes(f.value) ? "text-accent" : "text-foreground")}>{f.label}</span>
                <span className="text-[9px] text-muted-foreground">{f.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sizes */}
        <div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Sizes
            {rasterFormats.length === 0 && hasSvg && <span className="ml-1 normal-case tracking-normal font-normal">(SVG is scalable)</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SIZES.map((size) => (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                disabled={exporting}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                  selectedSizes.includes(size)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border/50 bg-card/40 text-muted-foreground hover:text-foreground hover:border-border",
                  exporting && "opacity-50 pointer-events-none",
                )}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>

        {/* SVG settings */}
        {hasSvg && (
          <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">SVG Settings</div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-foreground">Smoothing</span>
                <span className="text-xs text-muted-foreground tabular-nums">{svgSmoothing}/5</span>
              </div>
              <Slider
                value={[svgSmoothing]}
                onValueChange={([v]) => setSvgSmoothing(v)}
                min={1} max={5} step={1}
                disabled={exporting}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-foreground block">Optimize</span>
                <span className="text-[9px] text-muted-foreground">Minify paths and coordinates</span>
              </div>
              <Switch
                checked={svgOptimize}
                onCheckedChange={setSvgOptimize}
                disabled={exporting}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Total files</span>
          <span className="font-semibold text-foreground">{totalFiles.toLocaleString()}</span>
        </div>

        {/* Progress */}
        {exporting && progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate flex-1">
                {progress.current_icon ? `Processing: ${progress.current_icon}` : "Starting..."}
              </span>
              <span className="shrink-0 ml-2">{progress.completed}/{progress.total}</span>
            </div>
            <Progress value={(progress.completed / progress.total) * 100} />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={exporting} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || selectedSizes.length === 0 || selectedFormats.length === 0 || project.icons.length === 0}
            className="flex-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting ? "Exporting..." : "Download ZIP"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
