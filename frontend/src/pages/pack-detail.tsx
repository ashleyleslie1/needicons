import { useState } from "react";
import { useParams } from "react-router-dom";
import { usePack } from "@/hooks/api/use-packs";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { PackHeader } from "@/components/icons/pack-header";
import { IconGrid } from "@/components/icons/icon-grid";
import { GenerationConfig, type GenerationConfigValues } from "@/components/generation/generation-config";
import { CandidateReview } from "@/components/review/candidate-review";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { Button } from "@/components/ui/button";

type View = "grid" | "review";

export function PackDetailPage() {
  const { packId } = useParams<{ packId: string }>();
  const { data: pack, isLoading, error } = usePack(packId);
  const { rightPanel } = useSidebar();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("grid");
  const [profileId, setProfileId] = useState<string | null>(pack?.profile_id ?? null);

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
    const req = pack?.requirements.find((r) => r.id === id);
    if (req && req.candidates.length > 0) {
      setView("review");
    } else {
      handleSelectionChange(id);
    }
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
        <div className="flex items-start justify-between">
          <PackHeader
            pack={pack}
            selectedCount={selectedIds.size}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
          />
          {/* View toggle */}
          <div className="flex items-center gap-1 shrink-0 ml-2 mt-3">
            <Button
              variant={view === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("grid")}
              aria-label="Grid view"
            >
              Grid
            </Button>
            <Button
              variant={view === "review" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("review")}
              aria-label="Review view"
            >
              Review
            </Button>
          </div>
        </div>

        {view === "grid" ? (
          <IconGrid
            pack={pack}
            onRequirementClick={handleRequirementClick}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
          />
        ) : (
          <div className="mt-4">
            <CandidateReview pack={pack} />
          </div>
        )}
      </div>
      {rightPanel === "generation" && (
        <GenerationConfig
          selectedCount={selectedIds.size}
          onGenerate={handleGenerate}
          isGenerating={false}
        />
      )}
      {rightPanel === "profile" && (
        <ProfileEditor
          profileId={profileId}
          packName={pack.name}
          onProfileChange={setProfileId}
        />
      )}
    </div>
  );
}
