import { useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { GenerateIconsRequest, GenerationRecord } from "@/lib/types";

interface GenerationProgress {
  index: number;
  total: number;
  name: string;
  status: "generating" | "processing";
}

interface UseGenerateResult {
  start: (data: GenerateIconsRequest) => void;
  isPending: boolean;
  progress: GenerationProgress | null;
  jobId: string | null;
}

/**
 * Hook for icon generation with background job support.
 * Survives page navigation — reconnects to active jobs on mount.
 */
export function useGenerateIcons(projectId: string | undefined): UseGenerateResult {
  const qc = useQueryClient();
  const unsubRef = useRef<(() => void) | null>(null);
  const progressRef = useRef<GenerationProgress | null>(null);
  const jobIdRef = useRef<string | null>(null);

  // Poll for active jobs so we reconnect after backend restart or page refresh
  const activeJobId = qc.getQueryData<string>(["active-generation-job"]) ?? null;
  const { data: activeJobs } = useQuery({
    queryKey: ["active-generation-jobs"],
    queryFn: () => api.getActiveJobs(),
    refetchInterval: activeJobId ? false : 3000,
  });

  const handleEvent = useCallback((event: { type: string; data: unknown }) => {
    if (event.type === "progress") {
      progressRef.current = event.data as GenerationProgress;
      // Force re-render by updating query data
      qc.setQueryData(["generation-progress", jobIdRef.current], event.data);
    } else if (event.type === "record") {
      // A new record arrived — refresh history
      qc.invalidateQueries({ queryKey: ["generation-history"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    } else if (event.type === "done" || event.type === "error") {
      progressRef.current = null;
      jobIdRef.current = null;
      qc.setQueryData(["generation-progress", jobIdRef.current], null);
      qc.setQueryData(["active-generation-job"], null);
      qc.invalidateQueries({ queryKey: ["generation-history"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["active-generation-jobs"] });
    }
  }, [qc]);

  const subscribe = useCallback((jobId: string) => {
    unsubRef.current?.();
    jobIdRef.current = jobId;
    qc.setQueryData(["active-generation-job"], jobId);
    unsubRef.current = api.subscribeToJob(jobId, handleEvent);
  }, [handleEvent, qc]);

  // Reconnect to active job on mount or after backend restart
  useEffect(() => {
    if (!activeJobs?.length) return;
    // Prefer job matching current project, but reconnect to any active job
    const activeJob =
      activeJobs.find((j) => j.project_id === projectId) ??
      activeJobs[0];
    if (activeJob && activeJob.job_id !== jobIdRef.current) {
      subscribe(activeJob.job_id);
    }
  }, [activeJobs, projectId, subscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { unsubRef.current?.(); };
  }, []);

  const mutation = useMutation({
    mutationFn: (data: GenerateIconsRequest) => api.startGeneration(data),
    onSuccess: (result) => {
      subscribe(result.job_id);
    },
  });

  const currentProgress = qc.getQueryData<GenerationProgress | null>(["generation-progress", activeJobId]);

  return {
    start: (data: GenerateIconsRequest) => mutation.mutate(data),
    isPending: mutation.isPending || !!activeJobId,
    progress: currentProgress ?? null,
    jobId: activeJobId,
  };
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

export function useUnpickVariation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (generationId: string) => api.unpickVariation(generationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["generation-history"] });
    },
  });
}

export function useDeleteGeneration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (generationId: string) => api.deleteGeneration(generationId),
    onMutate: async (generationId) => {
      await qc.cancelQueries({ queryKey: ["generation-history"] });
      qc.setQueriesData<GenerationRecord[]>(
        { queryKey: ["generation-history"] },
        (old) => old?.filter((r) => r.id !== generationId),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["generation-history"] });
    },
  });
}

export function useRemoveBackground() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      generationId,
      enabled,
      aggressiveness,
    }: {
      generationId: string;
      enabled: boolean;
      aggressiveness: number;
    }) => api.removeBackground(generationId, enabled, aggressiveness),
    onSuccess: (updatedRecord) => {
      qc.setQueriesData<GenerationRecord[]>(
        { queryKey: ["generation-history"] },
        (old) =>
          old?.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)),
      );
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
