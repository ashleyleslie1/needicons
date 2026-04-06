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
