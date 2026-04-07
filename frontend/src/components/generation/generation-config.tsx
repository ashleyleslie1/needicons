import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { CostEstimate } from "./cost-estimate";

type Quality = "normal" | "hq";
type Variations = 1 | 2 | 4;

export interface GenerationConfigValues {
  quality: Quality;
  variations: Variations;
}

interface GenerationConfigProps {
  selectedCount: number;
  onGenerate: (config: GenerationConfigValues) => void;
  isGenerating: boolean;
}

const qualityHints: Record<Quality, string> = {
  hq: "HQ mode generates one image per API call for maximum quality. Best for final production assets.",
  normal:
    "Normal mode batches up to 4 icons per API call, significantly reducing cost. Ideal for drafts and exploration.",
};

export function GenerationConfig({
  selectedCount,
  onGenerate,
  isGenerating,
}: GenerationConfigProps) {
  const { setRightPanel } = useSidebar();
  const [quality, setQuality] = useState<Quality>("hq");
  const [variations, setVariations] = useState<Variations>(1);

  const apiCallsForCost =
    quality === "hq"
      ? selectedCount * variations
      : variations > 1
        ? selectedCount * Math.ceil(variations / 4)
        : Math.ceil(selectedCount / 4);
  const estimatedCost = apiCallsForCost * 0.04;

  function handleGenerate() {
    onGenerate({ quality, variations });
  }

  return (
    <div className="w-[300px] border-l border-border bg-surface flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <span className="font-semibold text-base">Generate</span>
        <button
          onClick={() => setRightPanel(null)}
          className="text-muted-foreground hover:text-foreground transition-colors text-base leading-none"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 py-5 space-y-6">
          {/* Quality */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Quality
            </p>
            <ToggleGroup
              type="single"
              value={quality}
              onValueChange={(v) => { if (v) setQuality(v as Quality); }}
              className="flex-col items-stretch gap-1"
            >
              <ToggleGroupItem
                value="hq"
                size="sm"
                className="justify-start text-xs w-full"
              >
                HQ ~$0.04/icon
              </ToggleGroupItem>
              <ToggleGroupItem
                value="normal"
                size="sm"
                className="justify-start text-xs w-full"
              >
                Normal ~$0.02/icon
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Variations */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Variations
            </p>
            <ToggleGroup
              type="single"
              value={String(variations)}
              onValueChange={(v) => { if (v) setVariations(Number(v) as Variations); }}
              className="gap-1"
            >
              {([1, 2, 4] as Variations[]).map((n) => (
                <ToggleGroupItem key={n} value={String(n)} size="sm" className="flex-1">
                  {n}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Cost estimate */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Cost estimate
            </p>
            <CostEstimate
              iconCount={selectedCount}
              quality={quality}
              variations={variations}
            />
          </div>

          {/* Hint */}
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed">
            {qualityHints[quality]}
          </div>
        </div>
      </ScrollArea>

      {/* Generate button */}
      <div className="px-5 py-4 border-t border-border">
        <Button
          size="lg"
          className="w-full"
          disabled={isGenerating || selectedCount === 0}
          onClick={handleGenerate}
        >
          {isGenerating
            ? "Generating…"
            : `Generate ${selectedCount} icon${selectedCount !== 1 ? "s" : ""} · $${estimatedCost.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
