import { useState, useCallback, useRef } from "react";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { useProject, useUpdateProject, useRemoveIcon } from "@/hooks/api/use-projects";
import { ControlsBar } from "@/components/project/controls-bar";
import { ProjectIconGrid } from "@/components/project/project-icon-grid";
import { ExportDialog } from "@/components/project/export-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PostProcessingSettings } from "@/lib/types";
import { api } from "@/lib/api-client";

export function ProjectPage() {
  const { activeProjectId } = useSidebar();
  const { data: project } = useProject(activeProjectId ?? undefined);
  const updateProject = useUpdateProject();
  const removeIcon = useRemoveIcon();
  const [showExport, setShowExport] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSettingsChange = useCallback(
    (settings: PostProcessingSettings) => {
      if (!activeProjectId) return;
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateProject.mutate(
          { id: activeProjectId, post_processing: settings },
          { onSuccess: () => {
            setPreviewVersion((v) => v + 1);
            // Trigger background refresh of all icon previews
            api.refreshPreviews(activeProjectId).catch(() => {});
          } },
        );
      }, 300);
    },
    [activeProjectId, updateProject],
  );

  function handleRemoveIcon(iconId: string) {
    if (!activeProjectId) return;
    removeIcon.mutate({ projectId: activeProjectId, iconId });
  }

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Select a project from the sidebar
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ControlsBar
        settings={project.post_processing}
        onChange={handleSettingsChange}
        onExport={() => setShowExport(true)}
        iconCount={project.icons.length}
      />
      <ScrollArea className="flex-1">
        <div className="p-8">
          <ProjectIconGrid
            icons={project.icons}
            projectId={project.id}
            previewVersion={previewVersion}
            onRemoveIcon={handleRemoveIcon}
          />
        </div>
      </ScrollArea>
      {showExport && (
        <ExportDialog project={project} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
