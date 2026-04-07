import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useGenerationHistory(projectId: string | undefined) {
  return useQuery({
    queryKey: ["generation-history", projectId],
    queryFn: () => api.getGenerationHistory(projectId!),
    enabled: !!projectId,
  });
}
