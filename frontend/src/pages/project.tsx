import { useSidebar } from "@/hooks/ui/use-sidebar";

export function ProjectPage() {
  const { activeProjectId } = useSidebar();
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
      Project view — project: {activeProjectId || "none"}
    </div>
  );
}
