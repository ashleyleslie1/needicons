import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Panel } from "@/components/layout/panel";
import { Canvas } from "@/components/layout/canvas";
import { AiProviderSettings } from "@/components/settings/ai-provider";
import { GpuSettings } from "@/components/settings/gpu-settings";
import { RunPodSettings } from "@/components/settings/runpod-settings";
import { AppearanceSettings } from "@/components/settings/appearance";
import { AboutSettings } from "@/components/settings/about";
import { useEdition } from "@/hooks/use-edition";
import { cn } from "@/lib/utils";

const ALL_SETTINGS_TABS = [
  { id: "provider", label: "AI Provider" },
  { id: "gpu", label: "GPU / Performance" },
  { id: "runpod", label: "RunPod" },
  { id: "appearance", label: "Appearance" },
  { id: "about", label: "About" },
];

function SettingsContent({ tab }: { tab: string }) {
  switch (tab) {
    case "provider":
      return <AiProviderSettings />;
    case "gpu":
      return <GpuSettings />;
    case "runpod":
      return <RunPodSettings />;
    case "appearance":
      return <AppearanceSettings />;
    case "about":
      return <AboutSettings />;
    default:
      return <AiProviderSettings />;
  }
}

export function SettingsPage() {
  const { tab = "provider" } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { showGpuSettings, showRunPodSettings } = useEdition();

  const tabs = useMemo(() => {
    return ALL_SETTINGS_TABS.filter((t) => {
      if (t.id === "gpu" && !showGpuSettings) return false;
      if (t.id === "runpod" && !showRunPodSettings) return false;
      return true;
    });
  }, [showGpuSettings, showRunPodSettings]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <Panel>
        <h2 className="text-base font-semibold text-foreground mb-4">Settings</h2>
        <nav className="flex flex-col gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/settings/${t.id}`)}
              className={cn(
                "text-sm text-left px-3 py-2 rounded-lg transition-colors",
                t.id === tab
                  ? "font-medium text-foreground bg-card"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </Panel>
      <Canvas>
        <SettingsContent tab={tab} />
      </Canvas>
    </div>
  );
}
