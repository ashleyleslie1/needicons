import { cn } from "@/lib/utils";
import { useProject } from "@/hooks/api/use-projects";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { Sparkles, Package } from "lucide-react";

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
    <div className="flex items-center gap-1 border-b border-border px-5 bg-card/50">
      <button
        onClick={() => onTabChange("generate")}
        className={cn(
          "relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-all",
          activeTab === "generate"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Create
        {activeTab === "generate" && (
          <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent" />
        )}
      </button>
      <button
        onClick={() => onTabChange("project")}
        className={cn(
          "relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-all",
          activeTab === "project"
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Package className="h-3.5 w-3.5" />
        Pack
        {iconCount > 0 && (
          <span className={cn(
            "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
            activeTab === "project"
              ? "bg-accent/10 text-accent"
              : "bg-muted text-muted-foreground",
          )}>
            {iconCount}
          </span>
        )}
        {activeTab === "project" && (
          <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-accent" />
        )}
      </button>
    </div>
  );
}

export type { MainTab };
