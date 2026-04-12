import { useState, useEffect } from "react";
import type { SavedIcon } from "@/lib/types";
import { Download, Crop, X } from "lucide-react";
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
  onCropSave?: (crop: { crop_x: number; crop_y: number; crop_zoom: number; crop_rotate: number }) => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function ProjectIconTile({
  icon, projectId, previewVersion, onRemove, onCropSave, selected, onToggleSelect,
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
        <div
          className={`group relative aspect-square overflow-hidden rounded-xl checkerboard border transition-all cursor-pointer ${selected ? 'ring-2 ring-accent ring-offset-1 ring-offset-background border-accent shadow-md shadow-accent/10' : 'border-border/50 hover:border-border hover:shadow-md'}`}
          onClick={() => onToggleSelect?.()}
        >
          <img
            src={src}
            alt={icon.name}
            className="h-full w-full object-contain p-1"
            style={
              (icon.crop_zoom !== 1 || icon.crop_x !== 0 || icon.crop_y !== 0 || icon.crop_rotate !== 0)
                ? { transform: `scale(${icon.crop_zoom}) translate(${icon.crop_x * 50}%, ${icon.crop_y * 50}%) rotate(${icon.crop_rotate}deg)` }
                : undefined
            }
            loading="lazy"
            draggable={false}
          />
          {/* Selection indicator — top-right, same style as pick in generate */}
          {onToggleSelect && selected && (
            <div className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[9px] text-white shadow">
              {"\u2713"}
            </div>
          )}
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
              <Crop className="h-3 w-3" />
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
          <DialogContent className="max-w-[85vw] w-auto p-0 gap-0 overflow-hidden">
            <div className="flex" style={{ height: "min(70vh, 600px)" }}>
              {/* Left: preview image — square matching height */}
              <div className="shrink-0 flex items-center justify-center relative checkerboard" style={{ width: "min(70vh, 600px)" }}>
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
                  className={`w-full h-full object-contain transition-opacity ${imageLoading ? "opacity-0" : "opacity-100"}`}
                  draggable={false}
                  onLoad={() => setImageLoading(false)}
                />
              </div>

              {/* Right: controls sidebar */}
              <div className="w-56 shrink-0 border-l border-border/50 flex flex-col bg-background overflow-y-auto">
                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-border/50">
                  <h3 className="text-sm font-semibold truncate">{icon.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{icon.style}</span>
                    {fileSize !== null && (
                      <span className="text-[10px] font-medium text-accent">{formatBytes(fileSize)}</span>
                    )}
                  </div>
                </div>

                <div className="flex-1 px-4 py-3 space-y-4">
                  {/* Format */}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Format</span>
                    <div className="space-y-0.5">
                      {(["png", "webp", "svg"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setPreviewFormat(fmt)}
                          className={`w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                            previewFormat === fmt
                              ? "bg-accent text-white shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          }`}
                        >
                          <span>{fmt.toUpperCase()}</span>
                          <span className={`text-[9px] ${previewFormat === fmt ? "text-white/70" : "opacity-50"}`}>
                            {fmt === "svg" ? "vector" : fmt === "png" ? "lossless" : "smaller"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PNG/WebP quality */}
                  {previewFormat !== "svg" && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Quality</span>
                      <div className="space-y-0.5">
                        {([
                          ["lossless", "Lossless", "100%"],
                          ["high", "High", "90%"],
                          ["medium", "Medium", "75%"],
                          ["low", "Low", "50%"],
                        ] as const).map(([val, label, pct]) => (
                          <button
                            key={val}
                            onClick={() => setQuality(val)}
                            className={`w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                              quality === val
                                ? "bg-accent text-white shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                            }`}
                          >
                            <span>{label}</span>
                            <span className={`text-[9px] ${quality === val ? "text-white/70" : "opacity-50"}`}>{pct}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SVG options */}
                  {previewFormat === "svg" && (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Smoothing</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">{svgSmoothing}/5</span>
                        </div>
                        <Slider value={[svgSmoothing]} onValueChange={([v]) => setSvgSmoothing(v)} min={1} max={5} step={1} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Optimize</span>
                        <button
                          onClick={() => setSvgOptimize(!svgOptimize)}
                          className={`w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${svgOptimize ? "bg-accent text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}
                        >
                          <span>Optimize</span>
                          <span className={`text-[9px] ${svgOptimize ? "text-white/70" : "opacity-50"}`}>{svgOptimize ? "on" : "off"}</span>
                        </button>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Output</span>
                        <div className="space-y-0.5">
                          {([
                            ["raw", "SVG", "Raw vector"],
                            ["react", "React JSX", "Component"],
                            ["react-native", "React Native", "Component"],
                          ] as const).map(([val, label, desc]) => (
                            <button
                              key={val}
                              onClick={() => setSvgFormat(val)}
                              className={`w-full flex items-center justify-between rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                                svgFormat === val
                                  ? "bg-accent text-white shadow-sm"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                              }`}
                            >
                              <span>{label}</span>
                              <span className={`text-[9px] ${svgFormat === val ? "text-white/70" : "opacity-50"}`}>{desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-border/50">
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
