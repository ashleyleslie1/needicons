import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { useProfiles, useCreateProfile, useUpdateProfile } from "@/hooks/api/use-profiles";
import type { ProcessingProfile, MaskShape } from "@/lib/types";
import { StepControl, SliderField } from "./step-control";

interface ProfileEditorProps {
  profileId: string | null;
  packName: string;
  onProfileChange: (id: string | null) => void;
}

function defaultProfile(): Partial<ProcessingProfile> {
  return {
    name: "New Profile",
    style_prompt: "",
    background_removal: { enabled: true, model: "u2net", alpha_matting: false, alpha_matting_foreground_threshold: 240, alpha_matting_background_threshold: 10 },
    edge_cleanup: { enabled: false, feather_radius: 2, defringe: false },
    weight_normalization: { enabled: false, target_fill: 70 },
    color: { overlay_color: null, brightness: 0, contrast: 0, saturation: 0, batch_normalize: false },
    stroke: { enabled: false, width: 2, color: "#000000", position: "outer" },
    mask: { shape: "none", corner_radius: 8 },
    shadow: { enabled: false, offset_x: 0, offset_y: 4, blur_radius: 8, color: "#000000", opacity: 0.3 },
    padding: { percent: 10, pixels: null },
  };
}

export function ProfileEditor({ profileId, packName, onProfileChange }: ProfileEditorProps) {
  const { setRightPanel } = useSidebar();
  const { data: profiles } = useProfiles();
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();

  const existing = profiles?.find((p) => p.id === profileId) ?? null;

  const [draft, setDraft] = useState<Partial<ProcessingProfile>>(
    existing ?? defaultProfile()
  );

  useEffect(() => {
    if (existing) {
      setDraft(existing);
    }
  }, [existing]);

  function patch<K extends keyof ProcessingProfile>(key: K, value: ProcessingProfile[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function patchNested<K extends keyof ProcessingProfile>(
    section: K,
    subKey: string,
    value: unknown
  ) {
    setDraft((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as object), [subKey]: value },
    }));
  }

  async function handleSave() {
    if (profileId && existing) {
      await updateProfile.mutateAsync({ id: profileId, data: draft });
    } else {
      const created = await createProfile.mutateAsync({ ...draft, name: `${packName} Profile` });
      onProfileChange(created.id);
    }
  }

  const bg = draft.background_removal;
  const edge = draft.edge_cleanup;
  const weight = draft.weight_normalization;
  const color = draft.color;
  const stroke = draft.stroke;
  const mask = draft.mask;
  const shadow = draft.shadow;
  const padding = draft.padding;

  const SHAPES: MaskShape[] = ["none", "circle", "rounded_rect", "squircle", "square"];

  return (
    <div className="w-[300px] border-l border-border bg-surface flex flex-col h-full shrink-0">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <span className="font-semibold text-base">Profile</span>
        <button
          type="button"
          onClick={() => setRightPanel(null)}
          className="text-muted-foreground hover:text-foreground transition-colors text-base leading-none"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 py-5 space-y-5">

          {/* Background Removal */}
          <StepControl
            label="Background Removal"
            enabled={bg?.enabled}
            onEnabledChange={(v) => patchNested("background_removal", "enabled", v)}
          >
            <p className="text-xs text-muted-foreground">Model: {bg?.model ?? "u2net"}</p>
          </StepControl>

          {/* Edge Cleanup */}
          <StepControl
            label="Edge Cleanup"
            enabled={edge?.enabled}
            onEnabledChange={(v) => patchNested("edge_cleanup", "enabled", v)}
          >
            <SliderField
              label="Feather radius"
              value={edge?.feather_radius ?? 2}
              onChange={(v) => patchNested("edge_cleanup", "feather_radius", v)}
              min={0}
              max={10}
              unit="px"
            />
          </StepControl>

          {/* Weight Normalization */}
          <StepControl
            label="Weight Normalization"
            enabled={weight?.enabled}
            onEnabledChange={(v) => patchNested("weight_normalization", "enabled", v)}
          >
            <SliderField
              label="Target fill"
              value={weight?.target_fill ?? 70}
              onChange={(v) => patchNested("weight_normalization", "target_fill", v)}
              min={20}
              max={95}
              unit="%"
            />
          </StepControl>

          {/* Color */}
          <StepControl label="Color" showToggle={false}>
            <div className="space-y-3">
              <SliderField
                label="Brightness"
                value={color?.brightness ?? 0}
                onChange={(v) => patchNested("color", "brightness", v)}
                min={-100}
                max={100}
              />
              <SliderField
                label="Contrast"
                value={color?.contrast ?? 0}
                onChange={(v) => patchNested("color", "contrast", v)}
                min={-100}
                max={100}
              />
              <SliderField
                label="Saturation"
                value={color?.saturation ?? 0}
                onChange={(v) => patchNested("color", "saturation", v)}
                min={-100}
                max={100}
              />
            </div>
          </StepControl>

          {/* Stroke */}
          <StepControl
            label="Stroke"
            enabled={stroke?.enabled}
            onEnabledChange={(v) => patchNested("stroke", "enabled", v)}
          >
            <SliderField
              label="Width"
              value={stroke?.width ?? 2}
              onChange={(v) => patchNested("stroke", "width", v)}
              min={1}
              max={20}
              unit="px"
            />
          </StepControl>

          {/* Shape Mask */}
          <StepControl label="Shape Mask" showToggle={false}>
            <div className="flex flex-wrap gap-1">
              {SHAPES.map((shape) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => patch("mask", { ...(mask ?? { corner_radius: 8 }), shape })}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    mask?.shape === shape
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {shape}
                </button>
              ))}
            </div>
          </StepControl>

          {/* Drop Shadow */}
          <StepControl
            label="Drop Shadow"
            enabled={shadow?.enabled}
            onEnabledChange={(v) => patchNested("shadow", "enabled", v)}
          >
            <div className="space-y-3">
              <SliderField
                label="Blur"
                value={shadow?.blur_radius ?? 8}
                onChange={(v) => patchNested("shadow", "blur_radius", v)}
                min={0}
                max={20}
                unit="px"
              />
              <SliderField
                label="Offset Y"
                value={shadow?.offset_y ?? 4}
                onChange={(v) => patchNested("shadow", "offset_y", v)}
                min={-10}
                max={10}
                unit="px"
              />
            </div>
          </StepControl>

          {/* Padding */}
          <StepControl label="Padding" showToggle={false}>
            <SliderField
              label="Percent"
              value={padding?.percent ?? 10}
              onChange={(v) => patch("padding", { percent: v, pixels: null })}
              min={0}
              max={30}
              unit="%"
            />
          </StepControl>

        </div>
      </ScrollArea>

      <div className="px-5 py-4 border-t border-border">
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={createProfile.isPending || updateProfile.isPending}
        >
          Save Profile
        </Button>
      </div>
    </div>
  );
}
