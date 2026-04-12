import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { PostProcessingSettings } from "@/lib/types";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api.listProjects(),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createProject(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; post_processing?: PostProcessingSettings; [key: string]: unknown }) =>
      api.updateProject(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects", vars.id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useRemoveIcon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, iconId }: { projectId: string; iconId: string }) =>
      api.removeIconFromProject(projectId, iconId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["generation-history"] });
    },
  });
}
