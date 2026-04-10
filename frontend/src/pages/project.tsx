import { useState, useCallback, useRef } from "react";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { useProject, useUpdateProject, useRemoveIcon } from "@/hooks/api/use-projects";
import { ControlsBar } from "@/components/project/controls-bar";
import { ProjectIconGrid } from "@/components/project/project-icon-grid";
import { ExportDialog } from "@/components/project/export-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Select a project from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Project header with stats */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">{project.name}</h2>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-muted-foreground">
                {project.icons.length} {project.icons.length === 1 ? "icon" : "icons"}
              </span>
              {project.icons.length > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">
                    {new Set(project.icons.map(i => i.style)).size} {new Set(project.icons.map(i => i.style)).size === 1 ? "style" : "styles"}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {project.icons.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm(`Remove all ${project.icons.length} icons from this project?`)) {
                    for (const icon of project.icons) handleRemoveIcon(icon.id);
                  }
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
                Clear All
              </Button>
            )}
            <Button
              onClick={() => setShowExport(true)}
              disabled={project.icons.length === 0}
              size="sm"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Pack
            </Button>
          </div>
        </div>
      </div>

      {/* Post-processing controls */}
      <ControlsBar
        settings={project.post_processing}
        onChange={handleSettingsChange}
        onExport={() => setShowExport(true)}
        iconCount={project.icons.length}
      />

      {/* Icon grid */}
      <ScrollArea className="flex-1">
        <div className="p-6">
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
