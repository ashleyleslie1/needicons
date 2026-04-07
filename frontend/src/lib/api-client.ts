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
    es.addEventListener("record", handler);
    es.addEventListener("error", handler);
    es.addEventListener("done", (e) => {
      try {
        onEvent({ type: "done", data: JSON.parse(e.data) });
      } catch {
        onEvent({ type: "done", data: {} });
      }
      es.close();
    });
    es.onerror = () => {
      es.close();
      // Notify as error so the hook can clean up and rediscover resumed jobs
      onEvent({ type: "error", data: { message: "Connection lost" } });
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
};
