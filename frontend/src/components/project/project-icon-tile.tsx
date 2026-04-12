import { useState, useEffect } from "react";
import type { SavedIcon } from "@/lib/types";
import { Download, Move, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { CropModal } from "./crop-modal";

interface ProjectIconTileProps {
  icon: SavedIcon;
  projectId: string;
  previewVersion: number;
  isPreview: boolean;
  onRemove: () => void;
  onSetPreview: () => void;
  onCropSave?: (crop: { crop_x: number; crop_y: number; crop_zoom: number }) => void;
}

export function ProjectIconTile({
  icon, projectId, previewVersion, onRemove, onCropSave,
}: ProjectIconTileProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<"png" | "svg" | "webp">("png");
  const [svgSmoothing, setSvgSmoothing] = useState(1);
  const [svgOptimize, setSvgOptimize] = useState(false);
  const [svgFormat, setSvgFormat] = useState<"raw" | "react" | "react-native">("raw");
  const [quality, setQuality] = useState<"lossless" | "high" | "medium" | "low">("lossless");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  const src = previewVersion > 0
    ? `/api/projects/${projectId}/icons/${icon.id}/preview?v=${previewVersion}`
    : `/api/images/${icon.preview_path}`;

  const qualityParam = previewFormat !== "svg" && quality !== "lossless" ? `&quality=${quality}` : "";
  const exportPreviewUrl = `/api/projects/${projectId}/icons/${icon.id}/export-preview?format=${previewFormat}&size=512${previewFormat === "svg" ? `&svg_smoothing=${svgSmoothing}&optimize=${svgOptimize}&svg_format=${svgFormat}` : ""}${qualityParam}`;

  // Fetch file size when format or smoothing changes
  useEffect(() => {
    if (!showPreview) return;
    setFileSize(null);
    setImageLoading(true);
    fetch(exportPreviewUrl, { method: "HEAD" }).then((res) => {
      const size = res.headers.get("X-File-Size");
      if (size) setFileSize(parseInt(size));
      else setFileSize(null);
    }).catch(() => setFileSize(null));
  }, [showPreview, exportPreviewUrl]);

  function handleDownload() {
    const a = document.createElement("a");
    a.href = exportPreviewUrl;
    const ext = previewFormat === "svg" && svgFormat !== "raw" ? "jsx" : previewFormat;
    a.download = `${icon.name}.${ext}`;
    a.click();
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <>
      <div className="text-center">
        <div className="group relative aspect-square overflow-hidden rounded-xl checkerboard border border-border/50 hover:border-border hover:shadow-md transition-all">
          <img
            src={src}
            alt={icon.name}
            className="h-full w-full object-contain p-1"
            loading="lazy"
            draggable={false}
          />
          {/* Hover actions — inside image container only */}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="flex-1 flex items-center justify-center gap-1 h-7 rounded-md bg-background border border-border text-[10px] font-semibold text-foreground shadow-lg transition-all hover:bg-accent hover:text-white hover:border-accent hover:shadow-accent/20 active:scale-95"
              onClick={() => setShowPreview(true)}
            >
              <Download className="h-3 w-3" /> Export
            </button>
            <button
              className="flex items-center justify-center h-7 w-7 rounded-md bg-background border border-border text-foreground shadow-lg transition-all hover:bg-accent hover:text-white hover:border-accent hover:shadow-accent/20 active:scale-95"
              onClick={() => setShowCrop(true)}
              title="Adjust position & zoom"
            >
              <Move className="h-3 w-3" />
            </button>
            <button
              className="flex items-center justify-center h-7 w-7 rounded-md bg-background border border-border text-foreground shadow-lg transition-all hover:bg-destructive hover:text-white hover:border-destructive hover:shadow-destructive/20 active:scale-95"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
        <span className="mt-1 block truncate text-[10px] text-muted-foreground">{icon.name}</span>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <Dialog open onOpenChange={() => setShowPreview(false)}>
          <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
            <div className="flex" style={{ height: "560px" }}>
              {/* Left: preview image */}
              <div
                className="flex-1 flex items-center justify-center p-4 relative"
                style={{
                  backgroundImage: "linear-gradient(45deg, var(--muted) 25%, transparent 25%), linear-gradient(-45deg, var(--muted) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--muted) 75%), linear-gradient(-45deg, transparent 75%, var(--muted) 75%)",
                  backgroundSize: "12px 12px",
                  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
                }}
              >
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="h-6 w-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
                <img
                  src={exportPreviewUrl}
                  alt={`${icon.name} ${previewFormat}`}
                  className={`max-w-full max-h-full object-contain transition-opacity ${imageLoading ? "opacity-0" : "opacity-100"}`}
                  draggable={false}
                  onLoad={() => setImageLoading(false)}
                />
              </div>

              {/* Right: controls sidebar */}
              <div className="w-[220px] shrink-0 border-l border-border/50 flex flex-col bg-background p-4 overflow-y-auto">
                <h3 className="text-sm font-semibold truncate">{icon.name}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">{icon.style}</p>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Format</span>
                    {fileSize !== null && (
                      <span className="text-[10px] font-medium text-foreground">{formatBytes(fileSize)}</span>
                    )}
                  </div>
                  {(["png", "webp", "svg"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setPreviewFormat(fmt)}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all ${
                        previewFormat === fmt
                          ? "bg-accent/15 text-accent font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                      }`}
                    >
                      <span>{fmt.toUpperCase()}</span>
                      <span className="text-[9px] opacity-60">
                        {fmt === "svg" ? "vector" : fmt === "png" ? "lossless" : "smaller"}
                      </span>
                    </button>
                  ))}
                </div>

                {/* PNG/WebP quality */}
                {previewFormat !== "svg" && (
                  <div className="mt-3 space-y-1">
                    <span className="text-[10px] text-muted-foreground">Quality</span>
                    <div className="flex flex-col gap-0.5">
                      {([
                        ["lossless", "Lossless", "100%"],
                        ["high", "High", "90%"],
                        ["medium", "Medium", "75%"],
                        ["low", "Low", "50%"],
                      ] as const).map(([val, label, pct]) => (
                        <button
                          key={val}
                          onClick={() => setQuality(val)}
                          className={`flex items-center justify-between text-[10px] px-2 py-1 rounded transition-all ${quality === val ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-card/60"}`}
                        >
                          <span>{label}</span>
                          <span className="opacity-60">{pct}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* SVG options */}
                {previewFormat === "svg" && (
                  <div className="mt-3 space-y-2.5">
                    {/* Smoothing */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Smoothing</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{svgSmoothing}/5</span>
                      </div>
                      <Slider value={[svgSmoothing]} onValueChange={([v]) => setSvgSmoothing(v)} min={1} max={5} step={1} />
                    </div>

                    {/* Optimize */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Optimize</span>
                      <button
                        onClick={() => setSvgOptimize(!svgOptimize)}
                        className={`text-[10px] px-2 py-0.5 rounded-full transition-all ${svgOptimize ? "bg-accent/15 text-accent" : "bg-card/60 text-muted-foreground"}`}
                      >
                        {svgOptimize ? "On" : "Off"}
                      </button>
                    </div>

                    {/* Framework format */}
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-1">Output</span>
                      <div className="flex flex-col gap-0.5">
                        {([
                          ["raw", "SVG"],
                          ["react", "React JSX"],
                          ["react-native", "React Native"],
                        ] as const).map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => setSvgFormat(val)}
                            className={`text-left text-[10px] px-2 py-1 rounded transition-all ${svgFormat === val ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-card/60"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-4">
                  <Button className="w-full" size="sm" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Crop/zoom modal */}
      {showCrop && (
        <CropModal
          icon={icon}
          projectId={projectId}
          previewVersion={previewVersion}
          open={showCrop}
          onOpenChange={setShowCrop}
          onSave={(crop) => onCropSave?.(crop)}
        />
      )}
    </>
  );
}
