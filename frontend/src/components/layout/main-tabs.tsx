import { cn } from "@/lib/utils";
import { useProject } from "@/hooks/api/use-projects";
import { useSidebar } from "@/hooks/ui/use-sidebar";

type MainTab = "generate" | "project";

interface MainTabsProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

export function MainTabs({ activeTab, onTabChange }: MainTabsProps) {
  const { activeProjectId } = useSidebar();
  const { data: project } = useProject(activeProjectId ?? undefined);
  const iconCount = project?.icons.length ?? 0;

  return (
    <div className="flex border-b border-border px-8">
      <button
        onClick={() => onTabChange("generate")}
        className={cn(
          "border-b-2 px-5 py-3 text-sm font-medium transition-colors",
          activeTab === "generate"
            ? "border-accent text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        Generate
      </button>
      <button
        onClick={() => onTabChange("project")}
        className={cn(
          "flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors",
          activeTab === "project"
            ? "border-accent text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        Project
        {iconCount > 0 && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {iconCount}
          </span>
        )}
      </button>
    </div>
  );
}

export type { MainTab };
