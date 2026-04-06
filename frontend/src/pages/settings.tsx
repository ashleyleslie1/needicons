import { useParams } from "react-router-dom";
import { Panel } from "@/components/layout/panel";
import { Canvas } from "@/components/layout/canvas";

const SETTINGS_TABS = [
  { id: "general", label: "General" },
  { id: "api-keys", label: "API Keys" },
  { id: "appearance", label: "Appearance" },
];

export function SettingsPage() {
  const { tab = "general" } = useParams<{ tab?: string }>();

  return (
    <>
      <Panel>
        <h2 className="text-sm font-semibold text-foreground mb-2">Settings</h2>
        <nav className="flex flex-col gap-1">
          {SETTINGS_TABS.map((t) => (
            <span
              key={t.id}
              className={
                t.id === tab
                  ? "text-xs font-medium text-foreground"
                  : "text-xs text-muted-foreground"
              }
            >
              {t.label}
            </span>
          ))}
        </nav>
      </Panel>
      <Canvas>
        <h1 className="text-xl font-semibold capitalize mb-4">{tab}</h1>
        <p className="text-sm text-muted-foreground">
          Settings content will be implemented in Task 13.
        </p>
      </Canvas>
    </>
  );
}
