import { useTheme } from "@/hooks/ui/use-theme";
import { cn } from "@/lib/utils";
import { Monitor, Sun, Moon } from "lucide-react";

type Theme = "system" | "light" | "dark";

const THEMES: { id: Theme; label: string; icon: typeof Monitor; desc: string }[] = [
  { id: "system", label: "System", icon: Monitor, desc: "Match OS preference" },
  { id: "light", label: "Light", icon: Sun, desc: "Light background" },
  { id: "dark", label: "Dark", icon: Moon, desc: "Dark background" },
];

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Appearance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize the look and feel.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              "rounded-xl border p-4 text-left transition-all",
              theme === t.id
                ? "border-accent bg-accent/5 shadow-sm"
                : "border-border bg-card hover:border-border hover:shadow-sm",
            )}
          >
            <t.icon className={cn("h-5 w-5 mb-2", theme === t.id ? "text-accent" : "text-muted-foreground")} />
            <p className={cn("text-sm font-medium", theme === t.id ? "text-foreground" : "text-foreground")}>{t.label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
