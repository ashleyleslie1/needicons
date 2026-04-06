import { http, HttpResponse } from "msw";
import type { Pack, SettingsResponse, GpuResponse } from "@/lib/types";

const mockPack: Pack = {
  id: "abc123def456",
  name: "Test Pack",
  description: "A test pack",
  style_prompt: "flat minimalist",
  profile_id: null,
  requirements: [],
};

const mockSettings: SettingsResponse = {
  provider: {
    api_key: "sk-\u2022\u2022\u2022\u2022kF3w",
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
  http.get("/api/packs", () => {
    return HttpResponse.json([mockPack]);
  }),

  http.get("/api/packs/:id", ({ params }) => {
    const { id } = params;
    if (id === mockPack.id) {
      return HttpResponse.json(mockPack);
    }
    return HttpResponse.json({ detail: "Not found" }, { status: 404 });
  }),

  http.post("/api/packs", async ({ request }) => {
    const body = (await request.json()) as { name: string; description?: string; style_prompt?: string };
    const newPack: Pack = {
      id: "new123",
      name: body.name,
      description: body.description ?? "",
      style_prompt: body.style_prompt ?? "",
      profile_id: null,
      requirements: [],
    };
    return HttpResponse.json(newPack, { status: 201 });
  }),

  http.delete("/api/packs/:id", () => {
    return HttpResponse.json({ status: "deleted" });
  }),

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
