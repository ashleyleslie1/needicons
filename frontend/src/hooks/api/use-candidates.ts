import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useCandidates(requirementId: string | undefined) {
  return useQuery({
    queryKey: ["candidates", requirementId],
    queryFn: () => api.listCandidates(requirementId!),
    enabled: !!requirementId,
  });
}

export function usePickCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.pickCandidate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["packs"] });
    },
  });
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCandidate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["packs"] });
    },
  });
}
