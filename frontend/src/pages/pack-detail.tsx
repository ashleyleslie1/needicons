import { useState } from "react";
import { useParams } from "react-router-dom";
import { usePack } from "@/hooks/api/use-packs";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { PackHeader } from "@/components/icons/pack-header";
import { IconGrid } from "@/components/icons/icon-grid";
import { GenerationConfig, type GenerationConfigValues } from "@/components/generation/generation-config";

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

  function handleGenerate(config: GenerationConfigValues) {
    console.log("generate", config, selectedIds);
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
    <div className="flex flex-1 h-screen overflow-hidden">
      <div className="flex-1 p-4 overflow-auto">
        <PackHeader
          pack={pack}
          selectedCount={selectedIds.size}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
        />
        <IconGrid
          pack={pack}
          onRequirementClick={handleRequirementClick}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
        />
      </div>
      {rightPanel === "generation" && (
        <GenerationConfig
          selectedCount={selectedIds.size}
          onGenerate={handleGenerate}
          isGenerating={false}
        />
      )}
    </div>
  );
}
