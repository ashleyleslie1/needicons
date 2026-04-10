import { useParams, useNavigate } from "react-router-dom";
import { Panel } from "@/components/layout/panel";
import { Canvas } from "@/components/layout/canvas";
import { AiProviderSettings } from "@/components/settings/ai-provider";
import { AppearanceSettings } from "@/components/settings/appearance";
import { AboutSettings } from "@/components/settings/about";
import { Key, Palette, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_SETTINGS_TABS = [
  { id: "provider", label: "API Keys", Icon: Key },
  { id: "appearance", label: "Appearance", Icon: Palette },
  { id: "about", label: "About", Icon: Info },
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
    <div className="flex flex-1 overflow-hidden">
      <Panel>
        <h2 className="text-base font-semibold text-foreground mb-4 tracking-tight">Settings</h2>
        <nav className="flex flex-col gap-0.5">
          {ALL_SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/settings/${t.id}`)}
              className={cn(
                "flex items-center gap-2.5 text-sm text-left px-3 py-2 rounded-lg transition-all",
                t.id === tab
                  ? "font-medium bg-accent/10 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              )}
            >
              <t.Icon className="h-3.5 w-3.5" />
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
