import { useEffect } from "react";
import { useProjects } from "@/hooks/api/use-projects";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { ProjectItem } from "./project-item";
import { CreateProjectDialog } from "./create-project-dialog";

export function ProjectSidebar() {
  const { data: projects } = useProjects();
  const { activeProjectId, setActiveProjectId } = useSidebar();

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    // If no active project or stored ID doesn't match any project, select first
    if (!activeProjectId || !projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId(projects[0].id);
    }
  }, [activeProjectId, projects, setActiveProjectId]);

  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Projects
      </div>
      {projects?.map((project) => (
        <ProjectItem
          key={project.id}
          project={project}
          isActive={project.id === activeProjectId}
          onClick={() => setActiveProjectId(project.id)}
        />
      ))}
      <CreateProjectDialog />
    </div>
  );
}
