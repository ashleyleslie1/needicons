import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useExportPack } from "@/hooks/api/use-export";
import type { Pack } from "@/lib/types";

interface ExportDialogProps {
  pack: Pack;
  open: boolean;
  onClose: () => void;
}

const AVAILABLE_SIZES = [256, 128, 64, 32, 16];

export function ExportDialog({ pack, open, onClose }: ExportDialogProps) {
  const [selectedSizes, setSelectedSizes] = useState<number[]>([256, 128, 64]);

  const exportPack = useExportPack();

  const unacceptedCount = pack.requirements.filter(
    (r) => r.status !== "accepted"
  ).length;

  const hasWarning = unacceptedCount > 0;
  const hasProfileId = !!pack.profile_id;
  const isExporting = exportPack.isPending;
  const canExport = selectedSizes.length > 0 && hasProfileId && !isExporting;

  function toggleSize(size: number) {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  }

  async function handleExport() {
    if (!pack.profile_id) return;
    await exportPack.mutateAsync({
      packId: pack.id,
      data: {
        profile_id: pack.profile_id,
        sizes: selectedSizes,
      },
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Pack</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Export <span className="font-medium text-foreground">{pack.name}</span> as
            PNG files at the selected sizes.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Warning: unaccepted requirements */}
          {hasWarning && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5 text-sm text-yellow-700 dark:text-yellow-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              <span>
                {unacceptedCount} requirement{unacceptedCount !== 1 ? "s" : ""}{" "}
                {unacceptedCount !== 1 ? "don't" : "doesn't"} have an accepted
                candidate. These icons will be skipped during export.
              </span>
            </div>
          )}

          {/* Warning: no profile */}
          {!hasProfileId && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6" />
                <path d="m9 9 6 6" />
              </svg>
              <span>
                No processing profile is assigned to this pack. Assign a profile
                before exporting.
              </span>
            </div>
          )}

          {/* Output sizes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Output Sizes (px)
            </label>
            <div className="flex gap-2 flex-wrap">
              {AVAILABLE_SIZES.map((size) => {
                const isSelected = selectedSizes.includes(size);
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleSize(size)}
                    className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-accent bg-accent/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-accent/50"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
            {selectedSizes.length === 0 && (
              <p className="text-xs text-destructive">Select at least one size.</p>
            )}
          </div>

          {/* Progress */}
          {isExporting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-spin"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Exporting pack, please wait…
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!canExport}>
            {isExporting ? "Exporting…" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
