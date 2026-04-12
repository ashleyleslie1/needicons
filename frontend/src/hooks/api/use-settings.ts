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
      queryClient.invalidateQueries({ queryKey: ["model-capabilities"] });
    },
  });
}

export function useUpdateStabilitySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { api_key?: string }) => api.updateStabilitySettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["model-capabilities"] });
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
  });
}

export function useRunPodConfig() {
  return useQuery({
    queryKey: ["runpod-config"],
    queryFn: () => api.getRunPodConfig(),
  });
}

export function useUpdateRunPodConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ enabled: boolean; api_key: string; endpoint_id: string }>) =>
      api.updateRunPodConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runpod-config"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useTestRunPodConnection() {
  return useMutation({
    mutationFn: () => api.testRunPodConnection(),
  });
}

export function useProcessingLog() {
  return useQuery({
    queryKey: ["processing-log"],
    queryFn: () => api.getProcessingLog(),
    refetchInterval: 10000,
  });
}
