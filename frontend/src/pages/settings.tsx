import { useParams, useNavigate } from "react-router-dom";
import { Panel } from "@/components/layout/panel";
import { Canvas } from "@/components/layout/canvas";
import { AiProviderSettings } from "@/components/settings/ai-provider";
import { AppearanceSettings } from "@/components/settings/appearance";
import { AboutSettings } from "@/components/settings/about";
import { cn } from "@/lib/utils";

const SETTINGS_TABS = [
  { id: "provider", label: "AI Provider" },
  { id: "appearance", label: "Appearance" },
  { id: "about", label: "About" },
];

function SettingsContent({ tab }: { tab: string }) {
  switch (tab) {
    case "provider":
      return <AiProviderSettings />;
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

  return (
    <>
      <Panel>
        <h2 className="text-base font-semibold text-foreground mb-4">Settings</h2>
        <nav className="flex flex-col gap-1">
          {SETTINGS_TABS.map((t) => (
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
    </>
  );
}
