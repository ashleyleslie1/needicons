import { useState } from "react";
import { useParams } from "react-router-dom";
import { usePack } from "@/hooks/api/use-packs";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { PackHeader } from "@/components/icons/pack-header";
import { IconGrid } from "@/components/icons/icon-grid";

export function PackDetailPage() {
  const { packId } = useParams<{ packId: string }>();
  const { data: pack, isLoading, error } = usePack(packId);
  const { rightPanel } = useSidebar();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function handleSelectionChange(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAll() {
    if (!pack) return;
    setSelectedIds(new Set(pack.requirements.map((r) => r.id)));
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  function handleRequirementClick(id: string) {
    // Task 11 will open candidate review panel
    handleSelectionChange(id);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-destructive">
        Failed to load pack.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PackHeader
        pack={pack}
        selectedCount={selectedIds.size}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
      />
      <div className="flex-1 overflow-y-auto">
        <IconGrid
          pack={pack}
          onRequirementClick={handleRequirementClick}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
        />
      </div>
      {/* Right panel placeholder — Tasks 8 and 12 will add generation config and profile editor */}
      {rightPanel && (
        <div className="hidden">
          {/* Panel content rendered by layout shell in future tasks */}
        </div>
      )}
    </div>
  );
}
