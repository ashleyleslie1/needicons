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
import { Search, Trash2, Download } from "lucide-react";

export function ProjectPage() {
  const { activeProjectId } = useSidebar();
  const { data: project } = useProject(activeProjectId ?? undefined);
  const updateProject = useUpdateProject();
  const removeIcon = useRemoveIcon();
  const [showExport, setShowExport] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
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
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-card/50 px-5 py-2.5">
        {/* Count */}
        <span className="text-[12px] text-muted-foreground tabular-nums shrink-0">
          {searchQuery ? `${filteredIcons.length} / ${project.icons.length}` : `${project.icons.length} icons`}
        </span>

        {/* Search */}
        {project.icons.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-8 w-44 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 transition-all"
            />
          </div>
        )}

        {/* Selection */}
        {project.icons.length > 0 && (
          <button
            onClick={() => {
              if (selectedIds.size === filteredIcons.length) setSelectedIds(new Set());
              else setSelectedIds(new Set(filteredIcons.map((i) => i.id)));
            }}
            className="pill pill-inactive"
          >
            {selectedIds.size === filteredIcons.length && filteredIcons.length > 0 ? "Deselect all" : "Select all"}
          </button>
        )}

        <span className={`text-[11px] font-medium transition-opacity ${selectedIds.size > 0 ? "text-accent opacity-100" : "opacity-0"}`}>
          {selectedIds.size} selected
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        {project.icons.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (confirm(`Remove all ${project.icons.length} icons?`)) {
                for (const icon of project.icons) handleRemoveIcon(icon.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
        <Button
          onClick={() => setShowExport(true)}
          disabled={project.icons.length === 0}
          size="sm"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Post-processing controls */}
      <ControlsBar
        settings={project.post_processing}
        onChange={handleSettingsChange}
        onExport={() => setShowExport(true)}
        iconCount={project.icons.length}
        selectedCount={selectedIds.size}
        isBulkProcessing={isBulkProcessing}
        onAutoFitSelected={async () => {
          if (selectedIds.size === 0) return;
          setIsBulkProcessing(true);
          try {
            for (const iconId of selectedIds) {
              await api.autoFitIcon(project.id, iconId);
            }
            qc.invalidateQueries({ queryKey: ["projects"] });
          } catch { /* ignore */ }
          setIsBulkProcessing(false);
        }}
        onRotateSelected={async (degrees) => {
          if (selectedIds.size === 0) return;
          setIsBulkProcessing(true);
          try {
            for (const iconId of selectedIds) {
              const icon = project.icons.find((i) => i.id === iconId);
              if (!icon) continue;
              const newRotate = ((icon.crop_rotate || 0) + degrees + 360) % 360;
              await api.autoFitIcon(project.id, iconId, newRotate);
            }
            qc.invalidateQueries({ queryKey: ["projects"] });
          } catch { /* ignore */ }
          setIsBulkProcessing(false);
        }}
      />

      {/* Bulk processing overlay */}
      {isBulkProcessing && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl bg-card border border-border px-5 py-3 shadow-xl">
            <svg className="h-5 w-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-medium text-foreground">Applying adjustments...</span>
          </div>
        </div>
      )}

      {/* Icon grid */}
      <div className="flex-1 overflow-auto">
        <div className="p-5">
          <ProjectIconGrid
            icons={filteredIcons}
            projectId={project.id}
            previewVersion={previewVersion}
            onRemoveIcon={handleRemoveIcon}
            onCropSave={async (iconId, crop) => {
              await api.updateIconCrop(project.id, iconId, crop);
              qc.invalidateQueries({ queryKey: ["projects"] });
            }}
            selectedIds={selectedIds}
            onToggleSelect={(iconId) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(iconId)) next.delete(iconId);
                else next.add(iconId);
                return next;
              });
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
