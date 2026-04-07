import { NavLink } from "react-router-dom";
import { useTheme } from "@/hooks/ui/use-theme";
import { ProjectSidebar } from "@/components/sidebar/project-sidebar";
import { cn } from "@/lib/utils";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  function toggle() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }
  return (
    <button
      onClick={toggle}
      title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-muted"
    >
      {resolvedTheme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}
    </button>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
          N
        </div>
        <span className="text-sm font-bold text-foreground">NeedIcons</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        <ProjectSidebar />
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-3">
        <ThemeToggle />
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-muted",
              isActive && "bg-muted",
            )
          }
        >
          {"\u2699\uFE0F"}
        </NavLink>
      </div>
    </aside>
  );
}
