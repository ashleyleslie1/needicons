import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

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
          "flex h-10 w-10 items-center justify-center rounded-md text-lg transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isActive && "bg-accent text-accent-foreground"
        )
      }
    >
      {emoji}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-12 flex-col items-center border-r border-border bg-background py-3 shrink-0">
      {/* Logo */}
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-base select-none">
        N
      </div>

      {/* Nav links */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        <NavItem to="/packs" title="Packs" emoji="📦" />
        <NavItem to="/profiles" title="Profiles" emoji="🎨" />
      </nav>

      {/* Bottom: Settings */}
      <div className="flex flex-col items-center gap-1">
        <NavItem to="/settings" title="Settings" emoji="⚙️" />
      </div>
    </aside>
  );
}
