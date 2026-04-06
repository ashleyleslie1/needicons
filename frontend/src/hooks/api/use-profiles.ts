import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ProcessingProfile } from "@/lib/types";

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: () => api.listProfiles(),
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ProcessingProfile>) => api.createProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProcessingProfile> }) =>
      api.updateProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}
