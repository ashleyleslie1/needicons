import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { GenerationMode } from "@/lib/types";

export function useGenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requirementId,
      mode,
    }: {
      requirementId: string;
      mode: GenerationMode;
    }) => api.generate(requirementId, mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}
