import type {
  Pack,
  Candidate,
  Requirement,
  ProcessingProfile,
  Job,
  CreatePackRequest,
  GenerationMode,
  ExportRequest,
  SettingsResponse,
  GpuResponse,
  Project,
  GenerateIconsRequest,
  GenerationRecord,
  ExportProjectRequest,
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
  // Packs
  listPacks(): Promise<Pack[]> {
    return request<Pack[]>("/packs");
  },

  getPack(id: string): Promise<Pack> {
    return request<Pack>(`/packs/${id}`);
  },

  createPack(data: CreatePackRequest): Promise<Pack> {
    return request<Pack>("/packs", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updatePack(id: string, data: Partial<CreatePackRequest>): Promise<Pack> {
    return request<Pack>(`/packs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deletePack(id: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/packs/${id}`, {
      method: "DELETE",
    });
  },

  // Requirements
  addRequirements(
    packId: string,
    requirements: Array<{ name: string; description?: string }>,
  ): Promise<Requirement[]> {
    return request<Requirement[]>(`/packs/${packId}/requirements`, {
      method: "POST",
      body: JSON.stringify(requirements),
    });
  },

  deleteRequirement(id: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/requirements/${id}`, {
      method: "DELETE",
    });
  },

  // Generation
  generate(requirementId: string, mode: GenerationMode): Promise<Job> {
    return request<Job>(`/requirements/${requirementId}/generate`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
  },

  // Candidates
  listCandidates(requirementId: string): Promise<Candidate[]> {
    return request<Candidate[]>(`/requirements/${requirementId}/candidates`);
  },

  pickCandidate(id: string): Promise<Candidate> {
    return request<Candidate>(`/candidates/${id}/pick`, {
      method: "POST",
    });
  },

  deleteCandidate(id: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/candidates/${id}`, {
      method: "DELETE",
    });
  },

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

  // Export
  exportPack(packId: string, data: ExportRequest): Promise<Job> {
    return request<Job>(`/packs/${packId}/export`, {
      method: "POST",
      body: JSON.stringify(data),
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

  // Generation v2
  generateIcons(data: GenerateIconsRequest): Promise<GenerationRecord[]> {
    return request<GenerationRecord[]>("/generate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  pickVariation(generationId: string, variationIndex: number): Promise<GenerationRecord> {
    return request<GenerationRecord>(`/generations/${generationId}/pick/${variationIndex}`, {
      method: "POST",
    });
  },

  // Project Export (returns blob, not JSON)
  async exportProject(projectId: string, data: ExportProjectRequest): Promise<Blob> {
    const url = `/api/projects/${projectId}/export`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new ApiError(res.status, "Export failed");
    return res.blob();
  },
};
