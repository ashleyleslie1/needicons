import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { CreatePackRequest } from "@/lib/types";

export function usePacks() {
  return useQuery({
    queryKey: ["packs"],
    queryFn: () => api.listPacks(),
  });
}

export function usePack(id: string | undefined) {
  return useQuery({
    queryKey: ["packs", id],
    queryFn: () => api.getPack(id!),
    enabled: !!id,
  });
}

export function useCreatePack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePackRequest) => api.createPack(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] });
    },
  });
}

export function useUpdatePack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePackRequest> }) =>
      api.updatePack(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] });
    },
  });
}

export function useDeletePack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packs"] });
    },
  });
}
