import { useState, useRef } from "react";
import type { SavedIcon } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface CropModalProps {
  icon: SavedIcon;
  projectId: string;
  previewVersion: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (crop: { crop_x: number; crop_y: number; crop_zoom: number }) => void;
}

export function CropModal({ icon, projectId, previewVersion, open, onOpenChange, onSave }: CropModalProps) {
  const [zoom, setZoom] = useState(icon.crop_zoom);
  const [panX, setPanX] = useState(icon.crop_x);
  const [panY, setPanY] = useState(icon.crop_y);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const src = previewVersion > 0
    ? `/api/projects/${projectId}/icons/${icon.id}/preview?v=${previewVersion}`
    : `/api/images/${icon.preview_path}`;

  const hasChanges = zoom !== icon.crop_zoom || panX !== icon.crop_x || panY !== icon.crop_y;
  const isDefault = zoom === 1 && panX === 0 && panY === 0;

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
            className="h-full w-full object-contain select-none transition-transform duration-75"
            style={{
              transform: `scale(${zoom}) translate(${panX * 50}%, ${panY * 50}%)`,
            }}
          />
          {/* Zoom indicator */}
          <div className="absolute top-2 left-2 rounded-md bg-background/80 border border-border/50 px-2 py-0.5 text-[10px] font-medium text-foreground">
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground shrink-0">Zoom</span>
          <input
            type="range"
            min="50"
            max="300"
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(parseInt(e.target.value) / 100)}
            className="flex-1 accent-accent"
          />
          <span className="text-[10px] text-muted-foreground tabular-nums w-8">{Math.round(zoom * 100)}%</span>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Scroll to zoom, drag to reposition. This adjustment is applied during export — the original image is preserved.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          {!isDefault && (
            <Button variant="ghost" onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}>
              Reset
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave({ crop_x: panX, crop_y: panY, crop_zoom: zoom }); onOpenChange(false); }} disabled={!hasChanges}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
