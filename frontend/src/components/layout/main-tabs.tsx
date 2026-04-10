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
    <div className="flex gap-1 border-b border-border/50 px-6 pt-1">
      <button
        onClick={() => onTabChange("generate")}
        className={cn(
          "relative px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg",
          activeTab === "generate"
            ? "text-foreground bg-card/60 backdrop-blur-sm border border-border/50 border-b-transparent -mb-px"
            : "text-muted-foreground hover:text-foreground hover:bg-card/30",
        )}
      >
        Generate
      </button>
      <button
        onClick={() => onTabChange("project")}
        className={cn(
          "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg",
          activeTab === "project"
            ? "text-foreground bg-card/60 backdrop-blur-sm border border-border/50 border-b-transparent -mb-px"
            : "text-muted-foreground hover:text-foreground hover:bg-card/30",
        )}
      >
        Project
        {iconCount > 0 && (
          <span className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            activeTab === "project"
              ? "bg-accent/15 text-accent"
              : "bg-muted text-muted-foreground",
          )}>
            {iconCount}
          </span>
        )}
      </button>
    </div>
  );
}

export type { MainTab };
