import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/ui/use-theme";

function NavItem({
  to,
  title,
  emoji,
}: {
  to: string;
  title: string;
  emoji: string;
}) {
  return (
    <NavLink
      to={to}
      title={title}
      className={({ isActive }) =>
        cn(
          "flex h-11 w-11 items-center justify-center rounded-lg text-xl transition-colors",
          "hover:bg-muted",
          isActive && "bg-accent text-accent-foreground"
        )
      }
    >
      {emoji}
    </NavLink>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function toggle() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <button
      onClick={toggle}
      title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-11 w-11 items-center justify-center rounded-lg text-xl transition-colors hover:bg-muted"
    >
      {resolvedTheme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-16 flex-col items-center border-r border-border bg-surface py-4 shrink-0">
      {/* Logo */}
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground font-bold text-lg select-none">
        N
      </div>

      {/* Nav links */}
      <nav className="flex flex-1 flex-col items-center gap-2">
        <NavItem to="/packs" title="Packs" emoji="📦" />
        <NavItem to="/profiles" title="Profiles" emoji="🎨" />
      </nav>

      {/* Bottom: Theme + Settings */}
      <div className="flex flex-col items-center gap-2">
        <ThemeToggle />
        <NavItem to="/settings" title="Settings" emoji="⚙️" />
      </div>
    </aside>
  );
}
