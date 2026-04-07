import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { GenerateIconsRequest } from "@/lib/types";

export function useGenerateIcons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateIconsRequest) => api.generateIcons(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["projects", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["generation-history", vars.project_id] });
    },
  });
}

export function usePickVariation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ generationId, variationIndex }: { generationId: string; variationIndex: number }) =>
      api.pickVariation(generationId, variationIndex),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["generation-history"] });
    },
  });
}
