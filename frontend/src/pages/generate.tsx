import { useState } from "react";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { useGenerateIcons } from "@/hooks/api/use-generate-v2";
import { useGenerationHistory } from "@/hooks/api/use-generation-history";
import { useProject } from "@/hooks/api/use-projects";
import { useSettings } from "@/hooks/api/use-settings";
import { StyleDropdown } from "@/components/generate/style-dropdown";
import { MoodDropdown } from "@/components/generate/mood-dropdown";
import { ModelDropdown } from "@/components/generate/model-dropdown";
import { QualityToggle } from "@/components/generate/quality-toggle";
import { ResultsHistory } from "@/components/generate/results-history";
import { ApiKeyModal } from "@/components/generation/api-key-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  const parsedPrompts = parsePrompts(promptText);
  const iconCount = parsedPrompts.length;

  const effectiveModel = model || settings?.provider?.default_model || "gpt-image-1";

  function handleGenerate() {
    if (!activeProjectId || parsedPrompts.length === 0) return;
    gen.start({
      prompts: parsedPrompts,
      style,
      quality: "normal" as const,
      api_quality: quality,
      mood,
      ai_enhance: aiEnhance,
      project_id: activeProjectId,
    });
    setPromptText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  }

  function handleApiKeySaved() {
    setShowApiKeyModal(false);
    handleGenerate();
  }

  const progress = gen.progress;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* LEFT PANEL - Config */}
      <div className="w-[300px] shrink-0 border-r border-border flex flex-col p-5 overflow-auto bg-card/40 backdrop-blur-sm gap-4">
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
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors"
          />
          <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">
            Use <kbd className="rounded bg-muted px-1 py-0.5 font-mono">;</kbd> to separate multiple icons
            {" · "}
            Use <kbd className="rounded bg-muted px-1 py-0.5 font-mono">:</kbd> for name:prompt
          </p>
        </div>

        {/* Model */}
        <ModelDropdown value={effectiveModel} onChange={setModel} />

        {/* Style + Mood side by side */}
        <div className="grid grid-cols-2 gap-3">
          <StyleDropdown value={style} onChange={setStyle} />
          <MoodDropdown value={mood} onChange={setMood} />
        </div>

        {/* Quality */}
        <QualityToggle model={effectiveModel} value={quality} onChange={setQuality} />

        {/* AI Enhance */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-foreground">AI Enhance</p>
            <p className="text-[10px] text-muted-foreground">Improve prompts with GPT</p>
          </div>
          <Switch
            checked={aiEnhance}
            onCheckedChange={setAiEnhance}
            aria-label="AI Enhance"
          />
        </div>

        {/* Generate button */}
        <div className="mt-auto pt-2">
          <Button
            className="w-full"
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
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Active generation shimmer */}
          {gen.isPending && (
            <div className="rounded-xl border border-border bg-card/80 backdrop-blur-md p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {progress?.name ?? "..."}
                </span>
                <span className="text-xs text-muted-foreground">
                  {progress
                    ? progress.status === "generating"
                      ? "Generating..."
                      : "Processing..."
                    : "Starting..."}
                </span>
                {progress && progress.total > 1 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {progress.index + 1}/{progress.total}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="relative aspect-square w-[76px] overflow-hidden rounded-lg bg-muted"
                  >
                    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
                  </div>
                ))}
              </div>
              {progress && progress.total > 1 && (
                <Progress
                  className="mt-3"
                  value={
                    ((progress.index + (progress.status === "processing" ? 0.5 : 0)) /
                      progress.total) *
                    100
                  }
                />
              )}
            </div>
          )}

          {/* Completed results */}
          {history && history.length > 0 ? (
            <ResultsHistory
              records={history}
              onRegenerate={(record) => {
                setPromptText(`${record.name}: ${record.prompt}`);
                setStyle(record.style);
                setQuality(record.api_quality ?? "");
              }}
            />
          ) : !gen.isPending ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-foreground">Generate your first icon</h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Enter a prompt on the left and hit Generate. You'll get 4 variations to pick from.
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
