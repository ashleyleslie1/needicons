import { useNavigate } from "react-router-dom";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

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
        "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        isActive
          ? "bg-card font-semibold text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="truncate">{project.name}</span>
      {project.icons.length > 0 && (
        <span className="ml-auto text-xs text-muted-foreground">
          {project.icons.length}
        </span>
      )}
    </button>
  );
}
