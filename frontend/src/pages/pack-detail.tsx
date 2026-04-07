import { useState } from "react";
import { useParams } from "react-router-dom";
import { usePack } from "@/hooks/api/use-packs";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { IconGrid } from "@/components/icons/icon-grid";
import { AddRequirement } from "@/components/icons/add-requirement";
import { GenerationConfig, type GenerationConfigValues } from "@/components/generation/generation-config";
import { CandidateReview } from "@/components/review/candidate-review";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type View = "grid" | "review";

export function PackDetailPage() {
  const { packId } = useParams<{ packId: string }>();
  const { data: pack, isLoading, error } = usePack(packId);
  const { rightPanel, setRightPanel } = useSidebar();
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
      <div className="flex items-center justify-center h-full text-base text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="flex items-center justify-center h-full text-base text-destructive">
        Failed to load pack.
      </div>
    );
  }

  const totalIcons = pack.requirements.length;
  const acceptedCount = pack.requirements.filter((r) => r.status === "accepted").length;
  const hasIcons = totalIcons > 0;

  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-6 pb-0 shrink-0">
          {/* Title */}
          <h1 className="text-3xl font-bold tracking-tight">{pack.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalIcons} icon{totalIcons !== 1 ? "s" : ""}
            {acceptedCount > 0 && <> &middot; {acceptedCount} accepted</>}
            {selectedIds.size > 0 && (
              <> &middot; <span className="text-accent font-medium">{selectedIds.size} selected</span></>
            )}
          </p>
        </div>

        {/* Toolbar */}
        <div className="px-8 py-4 flex items-center justify-between shrink-0 border-b border-border">
          {/* Left: view toggle + add */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setView("grid")}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                  view === "grid"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Grid
              </button>
              <button
                onClick={() => setView("review")}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                  view === "review"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Review
              </button>
            </div>
            {hasIcons && <AddRequirement packId={pack.id} />}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                  Clear selection
                </Button>
                <Button
                  variant="default"
                  onClick={() => setRightPanel("generation")}
                >
                  Generate {selectedIds.size} &rarr;
                </Button>
              </>
            ) : (
              <>
                {hasIcons && (
                  <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                    Select All
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRightPanel("profile")}
                >
                  Profile
                </Button>
                {hasIcons && (
                  <Button variant="default" size="sm">
                    Export
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {!hasIcons ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-3xl">
                  📦
                </div>
                <h2 className="text-xl font-semibold">No icons yet</h2>
                <p className="text-muted-foreground max-w-sm">
                  Add icon names to this pack, then generate them with AI. You can add one at a time or paste a whole list.
                </p>
              </div>
              <AddRequirement packId={pack.id} />
            </div>
          ) : view === "grid" ? (
            <div className="p-8">
              <IconGrid
                pack={pack}
                onRequirementClick={handleRequirementClick}
                selectedIds={selectedIds}
                onSelectionChange={handleSelectionChange}
              />
            </div>
          ) : (
            <div className="p-8">
              <CandidateReview pack={pack} />
            </div>
          )}
        </div>
      </div>

      {/* Right panels */}
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
