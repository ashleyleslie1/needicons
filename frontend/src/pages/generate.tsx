import { useSidebar } from "@/hooks/ui/use-sidebar";

export function GeneratePage() {
  const { activeProjectId } = useSidebar();
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
      Generate view — project: {activeProjectId || "none"}
    </div>
  );
}
