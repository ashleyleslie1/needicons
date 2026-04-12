import { NavLink, Link } from "react-router-dom";
import { useTheme } from "@/hooks/ui/use-theme";
import { ProjectSidebar } from "@/components/sidebar/project-sidebar";
import { Sun, Moon, Settings } from "lucide-react";
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
      className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col bg-sidebar-bg border-r border-sidebar-border">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3 px-5 py-5 no-underline">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white shadow-lg shadow-accent/25">
          N
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">NeedIcons</span>
      </Link>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto px-3">
        <ProjectSidebar />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 border-t border-sidebar-border px-4 py-3">
        <ThemeToggle />
        <NavLink to="/settings" className="ml-auto">
          {({ isActive }) => (
            <button className={cn(
              "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
              isActive
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}>
              <Settings className="h-4 w-4" />
            </button>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
