import { useState } from "react";
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
  const [downloading, setDownloading] = useState(false);

  function toggleSize(size: number) {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    );
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const blob = await api.exportProject(project.id, {
        sizes: selectedSizes.sort((a, b) => b - a),
        formats: [format],
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `needicons-${project.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      // handled by ApiError
    } finally {
      setDownloading(false);
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
    <Dialog open onOpenChange={() => onClose()}>
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
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  selectedSizes.includes(size)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground",
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
                disabled={f.disabled}
                className={cn(
                  "rounded-lg border px-5 py-2 text-sm font-medium transition-colors",
                  f.disabled && "cursor-not-allowed opacity-40",
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

        <Button
          onClick={handleDownload}
          disabled={downloading || selectedSizes.length === 0 || project.icons.length === 0}
          className="w-full"
        >
          {downloading ? "Preparing..." : "Download ZIP"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
