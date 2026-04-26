import { useEffect, useRef, useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { GenerateIconsRequest, GenerationRecord, QueueStatus } from "@/lib/types";

interface GenerationProgress {
  index: number;
  total: number;
  name: string;
  status: "enhancing" | "generating" | "processing";
  style?: string;
  model?: string;
  mood?: string;
}

interface PartialImage {
  variation: number;
  image: string; // base64
}

export interface QueueUpdate {
  queue_id: string;
  status: string;
  error?: string;
  record_id?: string;
  attempt?: number;
  delay?: number;
}

export interface DoneEvent {
  total: number;
  completed: number;
  failed: number;
}

interface UseGenerateResult {
  start: (data: GenerateIconsRequest) => void;
  isPending: boolean;
  progress: GenerationProgress | null;
  partialImages: Record<number, string>; // variation index -> base64 data URL
  jobId: string | null;
  lastDone: DoneEvent | null;
  lastJobId: string | null;
  queueStatus: QueueStatus | null;
}

/**
 * Hook for icon generation with background job support.
 * Survives page navigation — reconnects to active jobs on mount.
 */
export function useGenerateIcons(projectId: string | undefined): UseGenerateResult {
  const qc = useQueryClient();
  const unsubRef = useRef<(() => void) | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [partialImages, setPartialImages] = useState<Record<number, string>>({});
  const [lastDone, setLastDone] = useState<DoneEvent | null>(null);
  const lastJobIdRef = useRef<string | null>(null);

  // Poll for active jobs so we reconnect after backend restart or page refresh
  const activeJobId = qc.getQueryData<string>(["active-generation-job"]) ?? null;
  const { data: activeJobs } = useQuery({
    queryKey: ["active-generation-jobs"],
    queryFn: () => api.getActiveJobs(),
    refetchInterval: activeJobId ? false : 3000,
  });

  // Queue status drives the honest "X / Y done · M in flight" progress
  // display. SSE alone is unreliable for this when many icons run
  // concurrently (the latest progress event is just whichever one happened
  // to fire most recently, not a true running total).
  const { data: queueStatus = null } = useQuery({
    queryKey: ["queue-status", activeJobId],
    queryFn: () => activeJobId ? api.getQueueStatus(activeJobId) : null,
    enabled: !!activeJobId,
    refetchInterval: 2000,
  });

  const handleEvent = useCallback((event: { type: string; data: unknown }) => {
    if (event.type === "progress") {
      setProgress(event.data as GenerationProgress);
    } else if (event.type === "partial_image") {
      const pi = event.data as PartialImage;
      setPartialImages((prev) => ({
        ...prev,
        [pi.variation]: `data:image/png;base64,${pi.image}`,
      }));
    } else if (event.type === "record") {
      setPartialImages({});
      qc.invalidateQueries({ queryKey: ["generation-history"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    } else if (event.type === "item_failed") {
      // Per-icon failure — do NOT reset progress or jobIdRef; the job is
      // still running and other icons in the same batch are still in flight.
      // The queue endpoint already reflects the failure count; nothing to do.
    } else if (event.type === "done") {
      const doneData = event.data as DoneEvent;
      setProgress(null);
      setPartialImages({});
      if (doneData.failed > 0) {
        setLastDone(doneData);
      }
      jobIdRef.current = null;
      qc.setQueryData(["active-generation-job"], null);
      qc.invalidateQueries({ queryKey: ["generation-history"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["active-generation-jobs"] });
    } else if (event.type === "error") {
      setProgress(null);
      setPartialImages({});
      jobIdRef.current = null;
      qc.setQueryData(["active-generation-job"], null);
      qc.invalidateQueries({ queryKey: ["generation-history"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["active-generation-jobs"] });
    }
  }, [qc]);

  const subscribe = useCallback((jobId: string) => {
    unsubRef.current?.();
    jobIdRef.current = jobId;
    lastJobIdRef.current = jobId;
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

  // Show as pending if we have an active job OR if polling found active jobs not yet subscribed
  const hasUnsubscribedJob = (activeJobs?.length ?? 0) > 0 && !activeJobId;

  return {
    start: (data: GenerateIconsRequest) => { setLastDone(null); mutation.mutate(data); },
    isPending: mutation.isPending || !!activeJobId || hasUnsubscribedJob,
    progress,
    partialImages,
    jobId: activeJobId,
    lastDone,
    lastJobId: lastJobIdRef.current,
    queueStatus,
  };
}

export function usePickVariation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ generationId, variationIndex }: { generationId: string; variationIndex: number }) =>
      api.pickVariation(generationId, variationIndex),
    onSuccess: (updatedRecord) => {
      qc.setQueriesData<GenerationRecord[]>(
        { queryKey: ["generation-history"] },
        (old) => old?.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)),
      );
      // Mark projects as stale — refetched when user switches to project tab
      qc.invalidateQueries({ queryKey: ["projects"], refetchType: "none" });
    },
  });
}

export function useUnpickVariation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (generationId: string) => api.unpickVariation(generationId),
    onSuccess: (updatedRecord) => {
      qc.setQueriesData<GenerationRecord[]>(
        { queryKey: ["generation-history"] },
        (old) => old?.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)),
      );
      qc.invalidateQueries({ queryKey: ["projects"], refetchType: "none" });
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
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: ({
      generationId,
      level,
      requestId,
      signal,
    }: {
      generationId: string;
      level: number;
      requestId: string;
      signal?: AbortSignal;
    }) => api.removeBackground(generationId, level, requestId, signal),
    onSuccess: (updatedRecord) => {
      qc.setQueriesData<GenerationRecord[]>(
        { queryKey: ["generation-history"] },
        (old) =>
          old?.map((r) => (r.id === updatedRecord.id ? updatedRecord : r)),
      );
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const debouncedMutate = useCallback(
    (generationId: string, level: number) => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        const controller = new AbortController();
        abortRef.current = controller;
        const requestId = String(Date.now());

        mutation.mutate({
          generationId,
          level,
          requestId,
          signal: controller.signal,
        });
      }, 300);
    },
    [mutation],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    mutate: debouncedMutate,
    isPending: mutation.isPending,
  };
}

export function useColorAdjust() {
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: (p: { generationId: string; brightness: number; contrast: number; saturation: number; signal?: AbortSignal }) =>
      api.colorAdjust(p.generationId, p.brightness, p.contrast, p.saturation, String(Date.now()), p.signal),
    onSuccess: (rec) => {
      qc.setQueriesData<GenerationRecord[]>({ queryKey: ["generation-history"] }, (old) =>
        old?.map((r) => (r.id === rec.id ? rec : r)));
    },
  });

  const debouncedMutate = useCallback(
    (generationId: string, brightness: number, contrast: number, saturation: number) => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const c = new AbortController();
        abortRef.current = c;
        mutation.mutate({ generationId, brightness, contrast, saturation, signal: c.signal });
      }, 300);
    }, [mutation]);

  useEffect(() => () => { abortRef.current?.abort(); if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
  return { mutate: debouncedMutate, isPending: mutation.isPending };
}

export function useEdgeCleanup() {
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: (p: { generationId: string; feather: number; signal?: AbortSignal }) =>
      api.edgeCleanup(p.generationId, p.feather, String(Date.now()), p.signal),
    onSuccess: (rec) => {
      qc.setQueriesData<GenerationRecord[]>({ queryKey: ["generation-history"] }, (old) =>
        old?.map((r) => (r.id === rec.id ? rec : r)));
    },
  });

  const debouncedMutate = useCallback(
    (generationId: string, feather: number) => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const c = new AbortController();
        abortRef.current = c;
        mutation.mutate({ generationId, feather, signal: c.signal });
      }, 300);
    }, [mutation]);

  useEffect(() => () => { abortRef.current?.abort(); if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
  return { mutate: debouncedMutate, isPending: mutation.isPending };
}

export function useUpscale() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (p: { generationId: string; factor: number }) =>
      api.upscaleGeneration(p.generationId, p.factor, String(Date.now())),
    onSuccess: (rec) => {
      qc.setQueriesData<GenerationRecord[]>({ queryKey: ["generation-history"] }, (old) =>
        old?.map((r) => (r.id === rec.id ? rec : r)));
    },
  });
  return mutation;
}

export function useDenoise() {
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: (p: { generationId: string; strength: number; signal?: AbortSignal }) =>
      api.denoiseGeneration(p.generationId, p.strength, String(Date.now()), p.signal),
    onSuccess: (rec) => {
      qc.setQueriesData<GenerationRecord[]>({ queryKey: ["generation-history"] }, (old) =>
        old?.map((r) => (r.id === rec.id ? rec : r)));
    },
  });

  const debouncedMutate = useCallback(
    (generationId: string, strength: number) => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const c = new AbortController();
        abortRef.current = c;
        mutation.mutate({ generationId, strength, signal: c.signal });
      }, 300);
    }, [mutation]);

  useEffect(() => () => { abortRef.current?.abort(); if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
  return { mutate: debouncedMutate, isPending: mutation.isPending };
}

export function useLassoStrategies() {
  return useQuery({
    queryKey: ["lasso-strategies"],
    queryFn: () => api.getLassoStrategies(),
    staleTime: 60_000,
  });
}

export function useAddLassoMask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: {
      generationId: string;
      point: [number, number];
      mode: "remove" | "protect";
      strategy: string;
      tolerance: number;
      signal?: AbortSignal;
    }) =>
      api.addLassoMask(p.generationId, p.point, p.mode, p.strategy, p.tolerance, p.signal),
    onSuccess: (data) => {
      qc.setQueriesData<GenerationRecord[]>(
        { queryKey: ["generation-history"] },
        (old) =>
          old?.map((r) => (r.id === data.record.id ? data.record : r)),
      );
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteLassoMask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { generationId: string; maskId: string }) =>
      api.deleteLassoMask(p.generationId, p.maskId),
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

export function useRefineVariation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { generationId: string; variationIndex: number; prompt: string; onPartial?: (b64: string) => void }) =>
      api.refineVariation(p.generationId, p.variationIndex, p.prompt, p.onPartial),
    onSuccess: (data) => {
      qc.setQueriesData<GenerationRecord[]>(
        { queryKey: ["generation-history"] },
        (old) =>
          old?.map((r) => (r.id === data.record.id ? data.record : r)),
      );
      qc.invalidateQueries({ queryKey: ["generation-history"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
