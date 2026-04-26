import type {
  ProcessingProfile,
  SettingsResponse,
  GpuResponse,
  RunPodConfig,
  RunPodTestResult,
  ProcessingLogEntry,
  Project,
  GenerateIconsRequest,
  GenerationRecord,
  ExportProjectRequest,
  ExportJobStatus,
  ModelCapabilities,
  QueueStatus,
  SavedIcon,
} from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `/api${path}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) message = body.detail;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Profiles
  listProfiles(): Promise<ProcessingProfile[]> {
    return request<ProcessingProfile[]>("/profiles");
  },

  createProfile(data: Partial<ProcessingProfile>): Promise<ProcessingProfile> {
    return request<ProcessingProfile>("/profiles", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateProfile(
    id: string,
    data: Partial<ProcessingProfile>,
  ): Promise<ProcessingProfile> {
    return request<ProcessingProfile>(`/profiles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Settings
  getSettings(): Promise<SettingsResponse> {
    return request<SettingsResponse>("/settings");
  },

  updateProviderSettings(
    data: Partial<SettingsResponse["provider"]>,
  ): Promise<SettingsResponse> {
    return request<SettingsResponse>("/settings/provider", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  updateStabilitySettings(
    data: { api_key?: string },
  ): Promise<{ status: string }> {
    return request<{ status: string }>("/settings/stability", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  updateOpenRouterSettings(
    data: { api_key?: string },
  ): Promise<{ status: string }> {
    return request<{ status: string }>("/settings/openrouter", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  getGpuStatus(): Promise<GpuResponse> {
    return request<GpuResponse>("/settings/gpu");
  },

  getModelCapabilities(): Promise<Record<string, ModelCapabilities>> {
    return request<Record<string, ModelCapabilities>>("/settings/models");
  },

  updateGpuProvider(provider: string): Promise<{ status: string }> {
    return request<{ status: string }>("/settings/gpu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
  },

  getRunPodConfig(): Promise<RunPodConfig> {
    return request<RunPodConfig>("/settings/runpod");
  },

  updateRunPodConfig(data: Partial<{ enabled: boolean; api_key: string; endpoint_id: string }>): Promise<{ status: string }> {
    return request<{ status: string }>("/settings/runpod", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  testRunPodConnection(): Promise<RunPodTestResult> {
    return request<RunPodTestResult>("/settings/runpod/test", {
      method: "POST",
    });
  },

  getProcessingLog(): Promise<{ entries: ProcessingLogEntry[] }> {
    return request<{ entries: ProcessingLogEntry[] }>("/settings/processing-log");
  },

  clearProcessingLog(): Promise<{ status: string }> {
    return request<{ status: string }>("/settings/processing-log", {
      method: "DELETE",
    });
  },

  // Projects
  listProjects(): Promise<Project[]> {
    return request<Project[]>("/projects");
  },

  createProject(name: string): Promise<Project> {
    return request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  getProject(id: string): Promise<Project> {
    return request<Project>(`/projects/${id}`);
  },

  updateProject(id: string, data: Record<string, unknown>): Promise<Project> {
    return request<Project>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteProject(id: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/projects/${id}`, {
      method: "DELETE",
    });
  },

  removeIconFromProject(projectId: string, iconId: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/projects/${projectId}/icons/${iconId}`, {
      method: "DELETE",
    });
  },

  getGenerationHistory(projectId: string): Promise<GenerationRecord[]> {
    return request<GenerationRecord[]>(`/projects/${projectId}/history`);
  },

  // Generation v2 (background job)
  async startGeneration(data: GenerateIconsRequest): Promise<{ job_id: string; total: number }> {
    return request<{ job_id: string; total: number }>("/generate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getActiveJobs(): Promise<Array<{ job_id: string; project_id: string; status: string }>> {
    return request<Array<{ job_id: string; project_id: string; status: string }>>("/generate/active");
  },

  subscribeToJob(
    jobId: string,
    onEvent: (event: { type: string; data: unknown }) => void,
  ): () => void {
    const es = new EventSource(`/api/generate/jobs/${jobId}/stream`);
    const handler = (e: MessageEvent) => {
      try {
        onEvent({ type: e.type, data: JSON.parse(e.data) });
      } catch { /* ignore */ }
    };
    es.addEventListener("progress", handler);
    es.addEventListener("partial_image", handler);
    es.addEventListener("record", handler);
    es.addEventListener("queue_update", handler);
    es.addEventListener("item_failed", handler);
    es.addEventListener("error", handler);
    es.addEventListener("done", (e) => {
      try {
        onEvent({ type: "done", data: JSON.parse(e.data) });
      } catch {
        onEvent({ type: "done", data: {} });
      }
      es.close();
    });
    // onerror also fires for server-sent named "error" events, AND fires
    // transiently while the browser auto-reconnects. Only treat it as a real
    // disconnect when readyState has actually settled to CLOSED — otherwise
    // we'd tear down the user's progress state on every transient blip.
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        onEvent({ type: "error", data: { message: "Connection lost" } });
      }
    };
    return () => es.close();
  },

  pickVariation(generationId: string, variationIndex: number): Promise<GenerationRecord> {
    return request<GenerationRecord>(`/generations/${generationId}/pick/${variationIndex}`, {
      method: "POST",
    });
  },

  unpickVariation(generationId: string): Promise<GenerationRecord> {
    return request<GenerationRecord>(`/generations/${generationId}/unpick`, {
      method: "POST",
    });
  },

  deleteGeneration(generationId: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/generations/${generationId}`, {
      method: "DELETE",
    });
  },

  removeBackground(
    generationId: string,
    level: number,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<GenerationRecord> {
    return request<GenerationRecord>(`/generations/${generationId}/remove-bg`, {
      method: "POST",
      body: JSON.stringify({ level, request_id: requestId }),
      signal,
    });
  },

  colorAdjust(
    generationId: string,
    brightness: number,
    contrast: number,
    saturation: number,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<GenerationRecord> {
    return request<GenerationRecord>(`/generations/${generationId}/color-adjust`, {
      method: "POST",
      body: JSON.stringify({ brightness, contrast, saturation, request_id: requestId }),
      signal,
    });
  },

  edgeCleanup(
    generationId: string,
    feather: number,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<GenerationRecord> {
    return request<GenerationRecord>(`/generations/${generationId}/edge-cleanup`, {
      method: "POST",
      body: JSON.stringify({ feather, request_id: requestId }),
      signal,
    });
  },

  upscaleGeneration(
    generationId: string,
    factor: number,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<GenerationRecord> {
    return request<GenerationRecord>(`/generations/${generationId}/upscale`, {
      method: "POST",
      body: JSON.stringify({ factor, request_id: requestId }),
      signal,
    });
  },

  denoiseGeneration(
    generationId: string,
    strength: number,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<GenerationRecord> {
    return request<GenerationRecord>(`/generations/${generationId}/denoise`, {
      method: "POST",
      body: JSON.stringify({ strength, request_id: requestId }),
      signal,
    });
  },

  getLassoStrategies(): Promise<{ strategies: string[] }> {
    return request<{ strategies: string[] }>("/generation-tools/strategies");
  },

  addLassoMask(
    generationId: string,
    point: [number, number],
    mode: "remove" | "protect",
    strategy: string,
    tolerance: number,
    signal?: AbortSignal,
  ): Promise<{ mask_id: string; record: GenerationRecord }> {
    return request<{ mask_id: string; record: GenerationRecord }>(
      `/generations/${generationId}/lasso-mask`,
      {
        method: "POST",
        body: JSON.stringify({ point, mode, strategy, tolerance }),
        signal,
      },
    );
  },

  deleteLassoMask(
    generationId: string,
    maskId: string,
  ): Promise<GenerationRecord> {
    return request<GenerationRecord>(
      `/generations/${generationId}/lasso-mask/${maskId}`,
      { method: "DELETE" },
    );
  },

  addVariation(
    generationId: string,
    onPartial?: (imageB64: string) => void,
  ): Promise<{ record: GenerationRecord; new_index: number }> {
    return new Promise((resolve, reject) => {
      fetch(`/api/generations/${generationId}/add-variation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).then((res) => {
        if (!res.ok) {
          res.json().then((b) => reject(new ApiError(res.status, b.detail || "Recreate failed")))
            .catch(() => reject(new ApiError(res.status, "Recreate failed")));
          return;
        }
        const reader = res.body?.getReader();
        if (!reader) { reject(new Error("No stream")); return; }
        const decoder = new TextDecoder();
        let buffer = "";

        function pump(): void {
          reader!.read().then(({ done, value }) => {
            if (done) { reject(new Error("Stream ended without done event")); return; }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            let eventType = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) eventType = line.slice(7);
              else if (line.startsWith("data: ")) {
                const data = JSON.parse(line.slice(6));
                if (eventType === "partial" && onPartial) {
                  onPartial(data.image);
                } else if (eventType === "done") {
                  resolve({ record: data.record, new_index: data.new_index });
                  return;
                } else if (eventType === "error") {
                  reject(new ApiError(500, data.detail));
                  return;
                }
              }
            }
            pump();
          });
        }
        pump();
      }).catch(reject);
    });
  },

  refineVariation(
    generationId: string,
    variationIndex: number,
    prompt: string,
    onPartial?: (imageB64: string) => void,
  ): Promise<{ record: GenerationRecord }> {
    return new Promise((resolve, reject) => {
      fetch(`/api/generations/${generationId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variation_index: variationIndex, prompt }),
      }).then((res) => {
        if (!res.ok) {
          res.json().then((b) => reject(new ApiError(res.status, b.detail || "Refine failed")))
            .catch(() => reject(new ApiError(res.status, "Refine failed")));
          return;
        }
        const reader = res.body?.getReader();
        if (!reader) { reject(new Error("No stream")); return; }
        const decoder = new TextDecoder();
        let buffer = "";

        function pump(): void {
          reader!.read().then(({ done, value }) => {
            if (done) { reject(new Error("Stream ended without done event")); return; }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            let eventType = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) eventType = line.slice(7);
              else if (line.startsWith("data: ")) {
                const data = JSON.parse(line.slice(6));
                if (eventType === "partial" && onPartial) {
                  onPartial(data.image);
                } else if (eventType === "done") {
                  resolve({ record: data.record });
                  return;
                } else if (eventType === "error") {
                  reject(new ApiError(500, data.detail));
                  return;
                }
              }
            }
            pump();
          });
        }
        pump();
      }).catch(reject);
    });
  },

  // Project Export (async job-based)
  async startExport(projectId: string, data: ExportProjectRequest): Promise<{ job_id: string; total: number }> {
    return request<{ job_id: string; total: number }>(`/projects/${projectId}/export`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getExportStatus(projectId: string, jobId: string): Promise<ExportJobStatus> {
    return request<ExportJobStatus>(`/projects/${projectId}/export/${jobId}/status`);
  },

  async downloadExport(projectId: string, jobId: string): Promise<Blob> {
    const url = `/api/projects/${projectId}/export/${jobId}/download`;
    const res = await fetch(url);
    if (!res.ok) throw new ApiError(res.status, "Download failed");
    return res.blob();
  },

  refreshPreviews(projectId: string): Promise<{ status: string; job_id: string; total: number }> {
    return request<{ status: string; job_id: string; total: number }>(`/projects/${projectId}/refresh-previews`, {
      method: "POST",
    });
  },

  getRefreshStatus(projectId: string, jobId: string): Promise<{ status: string; completed: number; total: number }> {
    return request<{ status: string; completed: number; total: number }>(`/projects/${projectId}/refresh-previews/${jobId}`);
  },

  // Generation Queue
  getQueueStatus(jobId: string): Promise<QueueStatus> {
    return request<QueueStatus>(`/generate/queue/${jobId}`);
  },

  retryQueueItem(itemId: string): Promise<{ status: string; job_id: string; item_id: string }> {
    return request<{ status: string; job_id: string; item_id: string }>(`/generate/queue/${itemId}/retry`, {
      method: "POST",
    });
  },

  previewDeleteDuplicates(projectId: string): Promise<{ dry_run: true; would_delete: number; duplicate_names: number; preview: Array<{ name: string; total: number; keeping: number; deleting: number; has_picks: boolean }> }> {
    return request("/generations/delete-duplicates", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, dry_run: true }),
    });
  },

  autoFitIcon(projectId: string, iconId: string, rotate?: number): Promise<{ crop_x: number; crop_y: number; crop_zoom: number; crop_rotate: number }> {
    return request(`/projects/${projectId}/icons/${iconId}/auto-fit`, {
      method: "POST",
      body: rotate !== undefined ? JSON.stringify({ rotate }) : undefined,
    });
  },

  updateIconCrop(projectId: string, iconId: string, crop: { crop_x: number; crop_y: number; crop_zoom: number; crop_rotate: number }): Promise<SavedIcon> {
    return request<SavedIcon>(`/projects/${projectId}/icons/${iconId}/crop`, {
      method: "PUT",
      body: JSON.stringify(crop),
    });
  },

  deleteGroupDuplicates(projectId: string, name: string, mode: "keep_picked" | "keep_newest_only"): Promise<{ deleted: number; kept: number }> {
    return request("/generations/delete-group-duplicates", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, name, mode }),
    });
  },

  deleteDuplicates(projectId: string, excludeNames?: string[]): Promise<{ deleted: number; kept: number; preview: Array<{ name: string; total: number; keeping: number; deleting: number }> }> {
    return request("/generations/delete-duplicates", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, exclude_names: excludeNames }),
    });
  },

  retryAllFailed(jobId: string): Promise<{ status: string; job_id: string; count: number }> {
    return request<{ status: string; job_id: string; count: number }>(`/generate/queue/${jobId}/retry-all`, {
      method: "POST",
    });
  },
};
