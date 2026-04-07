import { http, HttpResponse } from "msw";
import type { SettingsResponse, GpuResponse } from "@/lib/types";

const mockSettings: SettingsResponse = {
  provider: {
    api_key: "sk-••••kF3w",
    default_model: "gpt-4o",
    api_key_set: true,
  },
};

const mockGpu: GpuResponse = {
  backend: "cpu",
  available: false,
  detail: "No GPU detected",
};

export const handlers = [
  http.get("/api/settings", () => {
    return HttpResponse.json(mockSettings);
  }),

  http.get("/api/settings/gpu", () => {
    return HttpResponse.json(mockGpu);
  }),

  http.get("/api/profiles", () => {
    return HttpResponse.json([]);
  }),
];
