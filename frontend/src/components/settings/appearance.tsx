import { useTheme } from "@/hooks/ui/use-theme";

type Theme = "system" | "light" | "dark";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Appearance</h1>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of the application.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Theme</h2>
        <div className="flex gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                theme === t.id
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
