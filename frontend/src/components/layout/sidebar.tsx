import { NavLink, Link } from "react-router-dom";
import { useTheme } from "@/hooks/ui/use-theme";
import { ProjectSidebar } from "@/components/sidebar/project-sidebar";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  function toggle() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      className="h-8 w-8"
    >
      {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border/50 bg-surface/80 backdrop-blur-xl">
      <Link to="/" className="flex items-center gap-2.5 px-4 py-4 no-underline">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground shadow-lg shadow-accent/20">
          N
        </div>
        <span className="text-sm font-bold text-foreground tracking-tight">NeedIcons</span>
      </Link>
      <div className="flex-1 overflow-y-auto px-2">
        <ProjectSidebar />
      </div>
      <div className="flex items-center justify-between border-t border-border/50 px-3 py-3">
        <ThemeToggle />
        <NavLink to="/settings">
          {({ isActive }) => (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", isActive && "bg-accent/10 text-accent")}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
