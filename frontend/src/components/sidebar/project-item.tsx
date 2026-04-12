import { useNavigate } from "react-router-dom";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Folder } from "lucide-react";

interface ProjectItemProps {
  project: Project;
  isActive: boolean;
  onClick: () => void;
}

export function ProjectItem({ project, isActive, onClick }: ProjectItemProps) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => { onClick(); navigate("/"); }}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all",
        isActive
          ? "bg-accent/8 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <div className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition-colors",
        isActive ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground group-hover:text-foreground",
      )}>
        <Folder className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <span className={cn("block text-[13px] truncate", isActive && "font-medium")}>{project.name}</span>
      </div>
      {project.icons.length > 0 && (
        <span className={cn(
          "text-[11px] tabular-nums shrink-0",
          isActive ? "text-accent" : "text-muted-foreground",
        )}>
          {project.icons.length}
        </span>
      )}
    </button>
  );
}
