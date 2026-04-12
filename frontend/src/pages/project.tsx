import { useState, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { useProject, useUpdateProject, useRemoveIcon } from "@/hooks/api/use-projects";
import { ControlsBar } from "@/components/project/controls-bar";
import { ProjectIconGrid } from "@/components/project/project-icon-grid";
import { ExportDialog } from "@/components/project/export-dialog";
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
  const [searchQuery, setSearchQuery] = useState("");
  const qc = useQueryClient();

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

  const filteredIcons = useMemo(() => {
    if (!project) return [];
    if (!searchQuery) return project.icons;
    const q = searchQuery.toLowerCase();
    return project.icons.filter((icon) =>
      icon.name.toLowerCase().includes(q) || icon.prompt.toLowerCase().includes(q)
    );
  }, [project?.icons, searchQuery]);

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
      {/* Project header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm px-6 py-2.5">
        <div className="flex items-center gap-3">
          {/* Icon count */}
          <span className="text-[11px] text-muted-foreground shrink-0">
            {searchQuery ? `${filteredIcons.length} of ${project.icons.length}` : `${project.icons.length} icons`}
          </span>

          {/* Search */}
          {project.icons.length > 0 && (
            <div className="relative">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="h-7 w-40 rounded-lg border border-border/50 bg-input pl-7 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/20 transition-all"
              />
            </div>
          )}

          {/* Actions — right side */}
          <div className="flex items-center gap-2 ml-auto">
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
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <ProjectIconGrid
            icons={filteredIcons}
            projectId={project.id}
            previewVersion={previewVersion}
            onRemoveIcon={handleRemoveIcon}
            onCropSave={async (iconId, crop) => {
              await api.updateIconCrop(project.id, iconId, crop);
              qc.invalidateQueries({ queryKey: ["projects"] });
            }}
          />
        </div>
      </div>

      {showExport && (
        <ExportDialog project={project} onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
