import { useParams, useNavigate } from "react-router-dom";
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
      {/* Nav */}
      <div className="w-48 shrink-0 border-r border-border bg-card/50 p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4 px-2">Settings</h2>
        <nav className="flex flex-col gap-0.5">
          {ALL_SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/settings/${t.id}`)}
              className={cn(
                "flex items-center gap-2.5 text-[13px] text-left px-3 py-2 rounded-lg transition-all",
                t.id === tab
                  ? "font-medium bg-accent/8 text-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <t.Icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
        <SettingsContent tab={tab} />
      </div>
    </div>
  );
}
