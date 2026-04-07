// Enums
export type JobStatus = "pending" | "running" | "completed" | "failed";
export type MaskShape = "none" | "circle" | "rounded_rect" | "squircle" | "square";
export type StrokePosition = "inner" | "outer" | "center";
export type FillType = "none" | "solid" | "gradient";

// Config models
export interface BackgroundRemovalConfig {
  enabled: boolean;
  model: string;
  alpha_matting: boolean;
  alpha_matting_foreground_threshold: number;
  alpha_matting_background_threshold: number;
}

export interface EdgeCleanupConfig {
  enabled: boolean;
  feather_radius: number;
  defringe: boolean;
}

export interface WeightNormalizationConfig {
  enabled: boolean;
  target_fill: number;
}

export interface ColorConfig {
  overlay_color: string | null;
  brightness: number;
  contrast: number;
  saturation: number;
  batch_normalize: boolean;
}

export interface StrokeConfig {
  enabled: boolean;
  width: number;
  color: string;
  position: StrokePosition;
}

export interface MaskConfig {
  shape: MaskShape;
  corner_radius: number;
}

export interface FillConfig {
  type: FillType;
  color: string;
  gradient_stops: string[] | null;
  gradient_angle: number;
}

export interface ShadowConfig {
  enabled: boolean;
  offset_x: number;
  offset_y: number;
  blur_radius: number;
  color: string;
  opacity: number;
}

export interface PaddingConfig {
  percent: number | null;
  pixels: number | null;
}

export interface OutputConfig {
  sizes: number[];
  formats: string[];
  sharpen_below: number;
}

// Domain models
export interface ProcessingProfile {
  id: string;
  name: string;
  style_prompt: string;
  background_removal: BackgroundRemovalConfig;
  edge_cleanup: EdgeCleanupConfig;
  weight_normalization: WeightNormalizationConfig;
  color: ColorConfig;
  stroke: StrokeConfig;
  mask: MaskConfig;
  fill: FillConfig;
  shadow: ShadowConfig;
  padding: PaddingConfig;
  output: OutputConfig;
}

export interface Job {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  result: string | null;
  error: string | null;
}

// API Request/Response types
export type Edition = "oss" | "commercial";

export interface SettingsResponse {
  edition: Edition;
  provider: {
    api_key: string;
    default_model: string;
    api_key_set: boolean;
  };
  processing?: {
    active_backend: string;
  };
}

export interface GpuProvider {
  id: string;
  name: string;
  available: boolean;
}

export interface GpuResponse {
  active_provider: string;
  available_providers: GpuProvider[];
  detail: string;
  preference: string;
}

export interface RunPodConfig {
  enabled: boolean;
  api_key: string;
  api_key_set: boolean;
  endpoint_id: string;
}

export interface RunPodTestResult {
  status: "connected" | "error";
  health?: Record<string, unknown>;
  error?: string;
}

export interface ProcessingLogEntry {
  timestamp: string;
  operation: string;
  backend: string;
  duration_ms: number;
  detail: string;
}

// --- New UX Redesign Types ---

export type IconStyle = "solid" | "outline" | "colorful" | "color" | "flat" | "sticker";
export type QualityMode = "hq" | "normal";

export interface PostProcessingSettings {
  stroke: StrokeConfig;
  mask: MaskConfig;
  fill: FillConfig;
  shadow: ShadowConfig;
  padding: PaddingConfig;
}

export interface SavedIcon {
  id: string;
  name: string;
  prompt: string;
  source_path: string;
  preview_path: string;
  style: IconStyle;
  created_at: string;
}

export interface GenerationVariation {
  index: number;
  source_path: string;
  preview_path: string;
  picked: boolean;
}

export interface LassoMask {
  id: string;
  polygon: [number, number][];
  mode: "remove" | "protect";
  strategy: string;
}

export interface GenerationRecord {
  id: string;
  project_id: string;
  name: string;
  prompt: string;
  style: IconStyle;
  quality: QualityMode;
  model: string;
  api_quality: string;
  mood: string;
  ai_enhance: boolean;
  variations: GenerationVariation[];
  original_count: number;
  bg_removal_level: number;
  bg_removal_request_id: string;
  created_at: string;
  color_brightness: number;
  color_contrast: number;
  color_saturation: number;
  edge_feather: number;
  upscale_factor: number;
  denoise_strength: number;
  lasso_masks: LassoMask[];
}

export interface Project {
  id: string;
  name: string;
  post_processing: PostProcessingSettings;
  style_preference: IconStyle;
  quality_preference: QualityMode;
  icons: SavedIcon[];
}

export interface GenerateIconsRequest {
  prompts: Array<{ name: string; prompt: string }>;
  style: IconStyle;
  quality: QualityMode;
  api_quality: string;
  mood: string;
  ai_enhance: boolean;
  project_id: string;
}

export interface ExportProjectRequest {
  sizes: number[];
  formats: string[];
}

export interface ExportJobStatus {
  status: "running" | "completed" | "failed";
  completed: number;
  total: number;
  current_icon: string;
  error: string | null;
}

export interface ModelCapabilities {
  label: string;
  description: string;
  supports_n: boolean;
  max_n: number;
  supports_transparent_bg: boolean;
  sizes: string[];
  qualities: string[];
  economy_mode: string;
  precision_mode: string;
  legacy: boolean;
}
