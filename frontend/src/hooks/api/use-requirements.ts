import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useAddRequirements() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      packId,
      requirements,
    }: {
      packId: string;
      requirements: Array<{ name: string; description?: string }>;
    }) => api.addRequirements(packId, requirements),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] });
    },
  });
}

export function useDeleteRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteRequirement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] });
    },
  });
}
