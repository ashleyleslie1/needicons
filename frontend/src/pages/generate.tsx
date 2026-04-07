import { useState } from "react";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { useGenerateIcons } from "@/hooks/api/use-generate-v2";
import { useGenerationHistory } from "@/hooks/api/use-generation-history";
import { useProject } from "@/hooks/api/use-projects";
import { PromptInput } from "@/components/generate/prompt-input";
import { StyleTabs } from "@/components/generate/style-tabs";
import { GenerationSettings } from "@/components/generate/generation-settings";
import { GenerateButton } from "@/components/generate/generate-button";
import { ResultsHistory } from "@/components/generate/results-history";
import { ApiKeyModal } from "@/components/generation/api-key-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import type { IconStyle, QualityMode } from "@/lib/types";

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
  const gen = useGenerateIcons(activeProjectId ?? undefined);

  const [promptText, setPromptText] = useState("");
  const [style, setStyle] = useState<IconStyle>(project?.style_preference ?? "solid");
  const [quality, setQuality] = useState<QualityMode>(project?.quality_preference ?? "normal");
  const [apiQuality, setApiQuality] = useState("");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const parsedPrompts = parsePrompts(promptText);
  const iconCount = parsedPrompts.length;

  function handleGenerate() {
    if (!activeProjectId || parsedPrompts.length === 0) return;
    gen.start({ prompts: parsedPrompts, style, quality, api_quality: apiQuality, project_id: activeProjectId });
    setPromptText("");
  }

  function handleApiKeySaved() {
    setShowApiKeyModal(false);
    handleGenerate();
  }

  const progress = gen.progress;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-8 py-6">
        <PromptInput
          value={promptText}
          onChange={setPromptText}
          onSubmit={handleGenerate}
          disabled={gen.isPending}
        />
        <div className="mt-4 flex items-center gap-4">
          <StyleTabs value={style} onChange={setStyle} />
          <div className="ml-auto flex items-center gap-3">
            <GenerationSettings
              quality={quality}
              onQualityChange={setQuality}
              apiQuality={apiQuality}
              onApiQualityChange={setApiQuality}
            />
            <GenerateButton
              iconCount={iconCount}
              onClick={handleGenerate}
              disabled={!activeProjectId || iconCount === 0}
              loading={gen.isPending}
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8">
          {gen.isPending && (
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {progress?.name ?? "..."}
                </span>
                <span className="text-xs text-muted-foreground">
                  {progress
                    ? progress.status === "generating" ? "Generating..." : "Processing..."
                    : "Starting..."}
                </span>
                {progress && progress.total > 1 && (
                  <span className="ml-auto text-xs text-muted-foreground">{progress.index + 1}/{progress.total}</span>
                )}
              </div>
              <div className="flex gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="relative aspect-square w-24 overflow-hidden rounded-lg bg-muted">
                    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
                  </div>
                ))}
              </div>
              {progress && progress.total > 1 && (
                <Progress
                  className="mt-3"
                  value={((progress.index + (progress.status === "processing" ? 0.5 : 0)) / progress.total) * 100}
                />
              )}
            </div>
          )}
          {history && history.length > 0 ? (
            <ResultsHistory
              records={history}
              onRegenerate={(record) => {
                setPromptText(`${record.name}: ${record.prompt}`);
                setStyle(record.style);
                setQuality(record.quality);
                setApiQuality(record.api_quality ?? "");
              }}
            />
          ) : !gen.isPending ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-2xl">
                {"\u2726"}
              </div>
              <h3 className="text-lg font-semibold text-foreground">Generate your first icon</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Type an icon name above and hit Generate. You'll get 4 variations to pick from.
              </p>
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <ApiKeyModal
        open={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSaved={handleApiKeySaved}
      />
    </div>
  );
}
