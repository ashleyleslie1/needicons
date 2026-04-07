import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { SettingsResponse } from "@/lib/types";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
}

export function useUpdateProviderSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SettingsResponse["provider"]>) =>
      api.updateProviderSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useGpuStatus() {
  return useQuery({
    queryKey: ["gpu"],
    queryFn: () => api.getGpuStatus(),
  });
}

export function useUpdateGpuProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => api.updateGpuProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gpu"] });
    },
  });
}

export function useModelCapabilities() {
  return useQuery({
    queryKey: ["model-capabilities"],
    queryFn: () => api.getModelCapabilities(),
    staleTime: 60 * 60 * 1000,
  });
}
