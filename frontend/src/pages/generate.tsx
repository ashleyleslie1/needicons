import { useState, useMemo } from "react";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { useGenerateIcons } from "@/hooks/api/use-generate-v2";
import { api } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useGenerationHistory } from "@/hooks/api/use-generation-history";
import { useProject } from "@/hooks/api/use-projects";
import { useSettings } from "@/hooks/api/use-settings";
import { StyleDropdown } from "@/components/generate/style-dropdown";
import { MoodDropdown } from "@/components/generate/mood-dropdown";
import { ModelDropdown } from "@/components/generate/model-dropdown";
import { QualityToggle } from "@/components/generate/quality-toggle";
import { ResultsHistory } from "@/components/generate/results-history";
import { ApiKeyModal } from "@/components/generation/api-key-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { IconStyle } from "@/lib/types";

function parsePrompts(input: string): Array<{ name: string; prompt: string }> {
  return input
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((segment) => {
      const colonIdx = segment.indexOf(":");
      if (colonIdx > 0) {
        return {
          name: segment.slice(0, colonIdx).trim(),
          prompt: segment.slice(colonIdx + 1).trim(),
        };
      }
      return { name: segment, prompt: segment };
    });
}

export function GeneratePage() {
  const { activeProjectId } = useSidebar();
  const { data: project } = useProject(activeProjectId ?? undefined);
  const { data: history } = useGenerationHistory(activeProjectId ?? undefined);
  const { data: settings } = useSettings();
  const gen = useGenerateIcons(activeProjectId ?? undefined);

  const [promptText, setPromptText] = useState("");
  const [style, setStyle] = useState<IconStyle>(project?.style_preference ?? "solid");
  const [model, setModel] = useState(settings?.provider?.default_model ?? "");
  const [quality, setQuality] = useState("");
  const [mood, setMood] = useState("none");
  const [aiEnhance, setAiEnhance] = useState(false);
  const [variations, setVariations] = useState(1);
  const [showUnpickedOnly, setShowUnpickedOnly] = useState(false);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [dismissedFailBanner, setDismissedFailBanner] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ duplicates: string[]; prompts: Array<{ name: string; prompt: string }> } | null>(null);
  const [isDeletingDupes, setIsDeletingDupes] = useState(false);
  const [dupePreview, setDupePreview] = useState<{ would_delete: number; duplicate_names: number; preview: Array<{ name: string; total: number; keeping: number; deleting: number; has_picks: boolean }> } | null>(null);
  const [dupeExcluded, setDupeExcluded] = useState<Set<string>>(new Set());

  const parsedPrompts = parsePrompts(promptText);
  const iconCount = parsedPrompts.length;

  const effectiveModel = model || "";
  const isStabilityModel = effectiveModel.startsWith("sd3");
  const hasOpenAI = !!settings?.provider?.api_key_set;

  const existingNames = useMemo(() => {
    if (!history) return new Set<string>();
    return new Set(history.map((r) => r.name.toLowerCase()));
  }, [history]);

  const duplicateNames = useMemo(() => {
    if (!history) return new Set<string>();
    const counts = new Map<string, number>();
    for (const r of history) {
      const key = r.name.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([k]) => k));
  }, [history]);

  function doGenerate(prompts: Array<{ name: string; prompt: string }>) {
    if (!activeProjectId || prompts.length === 0) return;
    setDismissedFailBanner(false);
    gen.start({
      prompts,
      style,
      quality: "normal" as const,
      api_quality: quality,
      mood,
      ai_enhance: aiEnhance,
      project_id: activeProjectId,
      model: effectiveModel,
      variations,
    });
    setPromptText("");
  }

  function handleGenerate() {
    if (!activeProjectId || parsedPrompts.length === 0) return;
    const dupes = parsedPrompts.filter((p) => existingNames.has(p.name.toLowerCase()));
    if (dupes.length > 0) {
      setDuplicateWarning({ duplicates: dupes.map((d) => d.name), prompts: parsedPrompts });
      return;
    }
    doGenerate(parsedPrompts);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  }

  function handleApiKeySaved() {
    setShowApiKeyModal(false);
    doGenerate(parsedPrompts);
  }

  const progress = gen.progress;
  const partials = gen.partialImages;
  const lastDone = gen.lastDone;

  const qc = useQueryClient();

  async function handleDeleteDuplicates() {
    if (!activeProjectId) return;
    try {
      const preview = await api.previewDeleteDuplicates(activeProjectId);
      if (preview.would_delete === 0) {
        alert("No duplicates to delete.");
        return;
      }
      // Sort: picked items first, then alphabetical
      preview.preview.sort((a, b) => {
        if (a.has_picks && !b.has_picks) return -1;
        if (!a.has_picks && b.has_picks) return 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
      setDupeExcluded(new Set());
      setDupePreview(preview);
    } catch {
      alert("Failed to check duplicates.");
    }
  }

  async function handleDeleteGroupDuplicates(name: string, mode: "keep_picked" | "keep_newest_only") {
    const msg = mode === "keep_picked"
      ? `Delete unpicked duplicates for "${name}"? Picked entries are kept.`
      : `Delete ALL duplicates for "${name}"? Only the newest entry is kept.`;
    if (!confirm(msg)) return;
    if (!activeProjectId) return;
    setIsDeletingDupes(true);
    try {
      await api.deleteGroupDuplicates(activeProjectId, name, mode);
      qc.invalidateQueries({ queryKey: ["generation-history"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch {
      alert("Failed to delete duplicates.");
    } finally {
      setIsDeletingDupes(false);
    }
  }

  async function confirmDeleteDuplicates() {
    if (!activeProjectId) return;
    setIsDeletingDupes(true);
    try {
      await api.deleteDuplicates(activeProjectId, [...dupeExcluded]);
      qc.invalidateQueries({ queryKey: ["generation-history"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setShowDuplicatesOnly(false);
      setDupePreview(null);
    } catch {
      alert("Failed to delete duplicates.");
    } finally {
      setIsDeletingDupes(false);
    }
  }

  async function handleRetryAllFailed() {
    const jobId = gen.lastJobId;
    if (!jobId) return;
    try {
      await api.retryAllFailed(jobId);
    } catch {
      // Job may have been cleaned up
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden min-w-0">
      {/* LEFT PANEL - Config */}
      <div className="w-[300px] shrink-0 border-r border-border/50 flex flex-col p-5 overflow-auto bg-card/30 backdrop-blur-xl gap-4">
        {/* Prompt */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block font-medium">
            Prompt
          </label>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={gen.isPending}
            placeholder="What icon would you like to generate?"
            rows={4}
            className="w-full resize-none rounded-lg border border-border/50 bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/20 transition-all"
          />
          <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">
            Use <kbd className="rounded bg-muted/60 px-1 py-0.5 font-mono">;</kbd> to separate multiple icons
            {" · "}
            Use <kbd className="rounded bg-muted/60 px-1 py-0.5 font-mono">:</kbd> for name:prompt
          </p>
        </div>

        {/* Model */}
        <ModelDropdown value={effectiveModel} onChange={setModel} />

        {/* Style */}
        <StyleDropdown value={style} onChange={setStyle} />

        {/* Mood */}
        <MoodDropdown value={mood} onChange={setMood} />

        {/* Quality */}
        {!isStabilityModel && (
          <QualityToggle model={effectiveModel} value={quality} onChange={setQuality} />
        )}

        {/* Variations */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block font-medium">
            Variations
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setVariations(n)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-xs font-semibold border transition-all",
                  variations === n
                    ? "bg-accent text-white border-accent shadow-md shadow-accent/20"
                    : "bg-card/40 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted/30 hover:border-border active:scale-95",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* AI Enhance — requires OpenAI API key */}
        <div className={cn(
          "flex items-center justify-between rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm px-3 py-2.5",
          !hasOpenAI && "opacity-40 pointer-events-none",
        )}>
          <div>
            <p className="text-sm font-medium text-foreground">AI Enhance</p>
            <p className="text-[10px] text-muted-foreground">{!hasOpenAI ? "Requires OpenAI API key" : "Improve prompts with GPT"}</p>
          </div>
          <Switch
            checked={hasOpenAI ? aiEnhance : false}
            onCheckedChange={setAiEnhance}
            disabled={!hasOpenAI}
            aria-label="AI Enhance"
          />
        </div>

        {/* Generate button */}
        <div className="mt-auto pt-2">
          <Button
            className="w-full shadow-lg shadow-accent/20"
            onClick={handleGenerate}
            disabled={!activeProjectId || iconCount === 0 || gen.isPending}
          >
            {gen.isPending
              ? "Generating..."
              : iconCount <= 1
              ? "Generate icon"
              : `Generate ${iconCount} icons`}
          </Button>
        </div>
      </div>

      {/* RIGHT PANEL - Results */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="p-4 pb-0 space-y-4 shrink-0">
          {/* Failed generation banner */}
          {lastDone && lastDone.failed > 0 && !dismissedFailBanner && (
            <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 backdrop-blur-md p-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-destructive shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {lastDone.completed}/{lastDone.total} generated, {lastDone.failed} failed
                </p>
                <p className="text-[10px] text-muted-foreground">Some icons failed due to API errors or rate limits</p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={handleRetryAllFailed}>
                Retry {lastDone.failed} failed
              </Button>
              <button onClick={() => setDismissedFailBanner(true)} className="text-muted-foreground hover:text-foreground p-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden px-4 pb-4">
          {history && history.length > 0 ? (
            <ResultsHistory
              records={(() => {
                let filtered = history;
                if (showUnpickedOnly) filtered = filtered.filter((r) => !r.variations.some((v) => v.picked));
                if (showDuplicatesOnly) {
                  filtered = filtered.filter((r) => duplicateNames.has(r.name.toLowerCase()));
                  filtered = [...filtered].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
                }
                if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  filtered = filtered
                    .filter((r) => r.name.toLowerCase().includes(q) || r.prompt.toLowerCase().includes(q))
                    .sort((a, b) => {
                      const an = a.name.toLowerCase();
                      const bn = b.name.toLowerCase();
                      // Exact name match first
                      if (an === q && bn !== q) return -1;
                      if (bn === q && an !== q) return 1;
                      // Name starts with query
                      if (an.startsWith(q) && !bn.startsWith(q)) return -1;
                      if (bn.startsWith(q) && !an.startsWith(q)) return 1;
                      // Name contains query (vs only prompt contains)
                      const aInName = an.includes(q);
                      const bInName = bn.includes(q);
                      if (aInName && !bInName) return -1;
                      if (bInName && !aInName) return 1;
                      return 0;
                    });
                }
                return filtered;
              })()}
              showUnpickedOnly={showUnpickedOnly}
              onToggleUnpicked={() => { setShowUnpickedOnly(!showUnpickedOnly); if (!showUnpickedOnly) setShowDuplicatesOnly(false); }}
              showDuplicatesOnly={showDuplicatesOnly}
              onToggleDuplicates={() => { setShowDuplicatesOnly(!showDuplicatesOnly); if (!showDuplicatesOnly) setShowUnpickedOnly(false); }}
              onDeleteDuplicates={handleDeleteDuplicates}
              onDeleteGroupDuplicates={handleDeleteGroupDuplicates}
              isDeleting={isDeletingDupes}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              totalCount={history.length}
              pendingCard={gen.isPending ? (
                <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {progress?.name ?? "Preparing"}
                      {progress?.style && <span className="text-muted-foreground font-normal ml-1">· {progress.style}</span>}
                    </span>
                    {progress?.model && (
                      <span className="text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 shrink-0">{progress.model}</span>
                    )}
                    {progress?.mood && progress.mood !== "none" && (
                      <span className="text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 shrink-0">{progress.mood}</span>
                    )}
                    <span className="ml-auto text-[11px] text-accent shrink-0 flex items-center gap-1.5">
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
                      </svg>
                      {progress?.status === "enhancing" ? "Enhancing prompt..." : progress?.status === "generating" ? "Generating images..." : progress?.status === "processing" ? "Processing previews..." : "Starting..."}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {Array.from({ length: variations }, (_, i) => (
                      <div key={i} className="relative aspect-square w-[100px] shrink-0 overflow-hidden rounded-lg bg-muted/20 ring-1 ring-border">
                        {partials[i] ? (
                          <img src={partials[i]} alt={`Generating v${i + 1}`} className="h-full w-full object-contain p-1 animate-pulse" />
                        ) : (
                          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
                        )}
                      </div>
                    ))}
                  </div>
                  {progress && progress.total > 1 && (
                    <div className="flex items-center gap-2 mt-1">
                      <Progress className="flex-1" value={((progress.index + (progress.status === "processing" ? 0.5 : 0)) / progress.total) * 100} />
                      <span className="text-[11px] text-muted-foreground shrink-0">{progress.index}/{progress.total}</span>
                    </div>
                  )}
                </div>
              ) : undefined}
              onRegenerate={(record) => {
                setPromptText(`${record.name}: ${record.prompt}`);
                setStyle(record.style);
                setQuality(record.api_quality ?? "");
              }}
            />
          ) : gen.isPending ? (
            <div className="mt-8 flex flex-col items-center justify-center text-center">
              <svg className="h-8 w-8 animate-spin text-accent mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
              </svg>
              <p className="text-sm text-muted-foreground">
                Generating {progress?.name ?? "icons"}...
                {progress && progress.total > 1 && ` (${progress.index}/${progress.total})`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 backdrop-blur-sm">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-foreground">Generate your first icon</h3>
              <p className="mt-1.5 max-w-xs text-sm text-muted-foreground leading-relaxed">
                Enter a prompt on the left and hit Generate. You'll get 4 variations to pick from.
              </p>
            </div>
          )}
        </div>
      </div>

      <ApiKeyModal
        open={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSaved={handleApiKeySaved}
      />

      {/* Duplicate name warning dialog */}
      <Dialog open={!!duplicateWarning} onOpenChange={(open) => { if (!open) setDuplicateWarning(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate icon names</DialogTitle>
            <DialogDescription>
              {duplicateWarning && duplicateWarning.duplicates.length === 1
                ? `"${duplicateWarning.duplicates[0]}" already exists in your history.`
                : `${duplicateWarning?.duplicates.length} names already exist in your history:`}
            </DialogDescription>
          </DialogHeader>
          {duplicateWarning && duplicateWarning.duplicates.length > 1 && (
            <div className="max-h-40 overflow-auto rounded-lg border border-border/50 bg-muted/20 p-2 text-sm">
              {duplicateWarning.duplicates.map((name) => (
                <div key={name} className="py-0.5 text-muted-foreground">{name}</div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDuplicateWarning(null)}>Cancel</Button>
            {duplicateWarning && duplicateWarning.prompts.length > duplicateWarning.duplicates.length && (
              <Button
                variant="outline"
                onClick={() => {
                  if (!duplicateWarning) return;
                  const dupeSet = new Set(duplicateWarning.duplicates.map((d) => d.toLowerCase()));
                  const filtered = duplicateWarning.prompts.filter((p) => !dupeSet.has(p.name.toLowerCase()));
                  setDuplicateWarning(null);
                  if (filtered.length > 0) doGenerate(filtered);
                }}
              >
                Skip duplicates ({duplicateWarning.prompts.length - duplicateWarning.duplicates.length} new)
              </Button>
            )}
            <Button
              onClick={() => {
                if (!duplicateWarning) return;
                const prompts = duplicateWarning.prompts;
                setDuplicateWarning(null);
                doGenerate(prompts);
              }}
            >
              Generate anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete duplicates preview dialog */}
      <Dialog open={!!dupePreview} onOpenChange={(open) => { if (!open) setDupePreview(null); }}>
        <DialogContent className="max-w-lg" style={{ maxHeight: "80vh", minHeight: "500px", display: "flex", flexDirection: "column" }}>
          <DialogHeader>
            <DialogTitle>Delete duplicate entries</DialogTitle>
            <DialogDescription>
              {(() => {
                const activeCount = dupePreview ? dupePreview.preview.filter((i) => !dupeExcluded.has(i.name)).reduce((sum, i) => sum + i.deleting, 0) : 0;
                return `${activeCount} entries will be removed. Uncheck items to keep them.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          {dupePreview && (
            <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-muted/20 p-2 text-[11px] space-y-0.5">
              {dupePreview.preview.map((item) => {
                const excluded = dupeExcluded.has(item.name);
                return (
                  <label key={item.name} className={cn("flex items-center gap-2 py-1 px-1 rounded cursor-pointer hover:bg-muted/30 transition-colors", excluded && "opacity-40")}>
                    <input
                      type="checkbox"
                      checked={!excluded}
                      onChange={() => {
                        setDupeExcluded((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.name)) next.delete(item.name);
                          else next.add(item.name);
                          return next;
                        });
                      }}
                      className="accent-accent"
                    />
                    <span className="text-foreground font-medium truncate flex-1">{item.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {item.total}x → keep {item.keeping}, delete {item.deleting}
                    </span>
                    {item.has_picks && (
                      <span className="text-[9px] text-accent shrink-0">picked</span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0 shrink-0">
            <Button variant="ghost" onClick={() => setDupePreview(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteDuplicates}
              disabled={isDeletingDupes}
            >
              {isDeletingDupes ? "Deleting..." : (() => {
                const activeCount = dupePreview ? dupePreview.preview.filter((i) => !dupeExcluded.has(i.name)).reduce((sum, i) => sum + i.deleting, 0) : 0;
                return `Delete ${activeCount} entries`;
              })()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
