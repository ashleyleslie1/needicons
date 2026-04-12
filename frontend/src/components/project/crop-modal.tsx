import { useState, useRef } from "react";
import type { SavedIcon } from "@/lib/types";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface CropModalProps {
  icon: SavedIcon;
  projectId: string;
  previewVersion: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (crop: { crop_x: number; crop_y: number; crop_zoom: number; crop_rotate: number }) => void;
}

export function CropModal({ icon, projectId, previewVersion, open, onOpenChange, onSave }: CropModalProps) {
  const [zoom, setZoom] = useState(icon.crop_zoom);
  const [panX, setPanX] = useState(icon.crop_x);
  const [panY, setPanY] = useState(icon.crop_y);
  const [rotate, setRotate] = useState(icon.crop_rotate);
  const [isPanning, setIsPanning] = useState(false);
  const [isAutoFitting, setIsAutoFitting] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const src = previewVersion > 0
    ? `/api/projects/${projectId}/icons/${icon.id}/preview?v=${previewVersion}`
    : `/api/images/${icon.preview_path}`;

  const hasChanges = zoom !== icon.crop_zoom || panX !== icon.crop_x || panY !== icon.crop_y || rotate !== icon.crop_rotate;
  const isDefault = zoom === 1 && panX === 0 && panY === 0 && rotate === 0;

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.5, z + (e.deltaY > 0 ? -0.05 : 0.05))));
  }

  function handleMouseDown(e: React.MouseEvent) {
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isPanning) return;
    const dx = (e.clientX - panStart.current.x) / 200;
    const dy = (e.clientY - panStart.current.y) / 200;
    setPanX(Math.max(-1, Math.min(1, panStart.current.panX + dx)));
    setPanY(Math.max(-1, Math.min(1, panStart.current.panY + dy)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust — {icon.name}</DialogTitle>
        </DialogHeader>

        {/* Preview area */}
        <div
          className="relative aspect-square w-full overflow-hidden rounded-xl checkerboard border border-border/50"
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
        >
          <img
            src={src}
            alt={icon.name}
            draggable={false}
            className="h-full w-full object-contain select-none"
            style={{
              transform: `scale(${zoom}) translate(${panX * 50}%, ${panY * 50}%) rotate(${rotate}deg)`,
            }}
          />
          {/* Info overlay */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <span className="rounded-md bg-background border border-border/50 px-2 py-1 text-[11px] font-semibold text-foreground shadow-md">
              {Math.round(zoom * 100)}%
            </span>
            {rotate !== 0 && (
              <span className="rounded-md bg-background border border-border/50 px-2 py-1 text-[11px] font-semibold text-foreground shadow-md">
                {Math.round(rotate)}°
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-2">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-muted-foreground w-12 shrink-0">Zoom</span>
            <input
              type="range"
              min="50"
              max="300"
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(parseInt(e.target.value) / 100)}
              className="flex-1 accent-accent"
            />
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums w-10 text-right">{Math.round(zoom * 100)}%</span>
          </div>
          {/* Rotate */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-muted-foreground w-12 shrink-0">Rotate</span>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={Math.round(((rotate % 360) + 360) % 360)}
              onChange={(e) => setRotate(parseInt(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums w-10 text-right">{Math.round(((rotate % 360) + 360) % 360)}°</span>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Scroll to zoom, drag to reposition. Applied during export — the original image is preserved.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            disabled={isAutoFitting}
            onClick={async () => {
              setIsAutoFitting(true);
              try {
                const result = await api.autoFitIcon(projectId, icon.id, rotate);
                setZoom(result.crop_zoom);
                setPanX(result.crop_x);
                setPanY(result.crop_y);
                setRotate(result.crop_rotate);
              } catch { /* ignore */ }
              setIsAutoFitting(false);
            }}
          >
            {isAutoFitting ? "Fitting..." : "Auto fit"}
          </Button>
          {!isDefault && (
            <Button variant="outline" onClick={() => { setZoom(1); setPanX(0); setPanY(0); setRotate(0); }}>
              Reset
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave({ crop_x: panX, crop_y: panY, crop_zoom: zoom, crop_rotate: rotate }); onOpenChange(false); }} disabled={!hasChanges}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
