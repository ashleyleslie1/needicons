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

  const effectiveModel = model || settings?.provider?.default_model || "gpt-image-1.5";

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
      model: effectiveModel,
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
  const partials = gen.partialImages;

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
        <QualityToggle model={effectiveModel} value={quality} onChange={setQuality} />

        {/* AI Enhance */}
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm px-3 py-2.5">
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
      <ScrollArea className="flex-1 min-w-0">
        <div className="p-4 space-y-4">
          {history && history.length > 0 ? (
            <ResultsHistory
              records={history}
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
                    {[0, 1, 2, 3].map((i) => (
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
                    <Progress className="mt-1" value={((progress.index + (progress.status === "processing" ? 0.5 : 0)) / progress.total) * 100} />
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
              <p className="text-sm text-muted-foreground">Generating {progress?.name ?? "icons"}...</p>
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
      </ScrollArea>

      <ApiKeyModal
        open={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSaved={handleApiKeySaved}
      />
    </div>
  );
}
