import { useState } from "react";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { useGenerateIcons } from "@/hooks/api/use-generate-v2";
import { useGenerationHistory } from "@/hooks/api/use-generation-history";
import { useProject } from "@/hooks/api/use-projects";
import { PromptInput } from "@/components/generate/prompt-input";
import { StyleTabs } from "@/components/generate/style-tabs";
import { QualityToggle } from "@/components/generate/quality-toggle";
import { GenerateButton } from "@/components/generate/generate-button";
import { ResultsHistory } from "@/components/generate/results-history";
import { ApiKeyModal } from "@/components/generation/api-key-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const generateIcons = useGenerateIcons();
  const { data: history } = useGenerationHistory(activeProjectId ?? undefined);

  const [promptText, setPromptText] = useState("");
  const [style, setStyle] = useState<IconStyle>(project?.style_preference ?? "solid");
  const [quality, setQuality] = useState<QualityMode>(project?.quality_preference ?? "normal");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const parsedPrompts = parsePrompts(promptText);
  const iconCount = parsedPrompts.length;

  function handleGenerate() {
    if (!activeProjectId || parsedPrompts.length === 0) return;
    generateIcons.mutate(
      { prompts: parsedPrompts, style, quality, project_id: activeProjectId },
      {
        onSuccess: () => setPromptText(""),
        onError: (err) => {
          if (err.message?.includes("No API key")) {
            setShowApiKeyModal(true);
          }
        },
      },
    );
  }

  function handleApiKeySaved() {
    setShowApiKeyModal(false);
    handleGenerate();
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-8 py-6">
        <PromptInput
          value={promptText}
          onChange={setPromptText}
          onSubmit={handleGenerate}
          disabled={generateIcons.isPending}
        />
        <div className="mt-4 flex items-center gap-4">
          <StyleTabs value={style} onChange={setStyle} />
          <div className="ml-auto flex items-center gap-3">
            <QualityToggle value={quality} onChange={setQuality} />
            <GenerateButton
              iconCount={iconCount}
              onClick={handleGenerate}
              disabled={!activeProjectId || iconCount === 0}
              loading={generateIcons.isPending}
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-8">
          {generateIcons.isPending && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm text-foreground">Generating icons...</span>
            </div>
          )}
          {history && history.length > 0 ? (
            <ResultsHistory records={history} />
          ) : !generateIcons.isPending ? (
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
