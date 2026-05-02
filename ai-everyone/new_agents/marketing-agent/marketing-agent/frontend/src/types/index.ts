// ── Chat & Session Types ──────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system";

export type ContentType =
  | "description"
  | "poster"
  | "social_post"
  | "hashtags"
  | "campaign"
  | "ad_copy"
  | "clarification";

export type Platform =
  | "instagram"
  | "linkedin"
  | "twitter"
  | "facebook"
  | "pinterest"
  | "tiktok";

export type AgentPhase =
  | "thinking"
  | "planning"
  | "acting"
  | "observing"
  | "reflecting"
  | "responding";

// ── Message ───────────────────────────────────────────────────────────────────

export interface AttachedImage {
  id: string;
  previewUrl: string;
  filename: string;
}

export interface GeneratedContent {
  type: ContentType;
  content: string;
  platform?: Platform;
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  imageId?: string;
  imageUrl?: string;
  generatedContent?: GeneratedContent[];
  timestamp: Date;
  isStreaming?: boolean;
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface Session {
  session_id: string;
  name: string;
  product_name?: string;
  created_at: string;
  message_count: number;
}

// ── SSE Event Types ───────────────────────────────────────────────────────────

export type SSEEvent =
  | { type: "token"; content: string }
  | { type: "phase"; phase: AgentPhase; description: string }
  | { type: "tool_call"; tool: string; args: Record<string, string> }
  | { type: "tool_result"; tool: string; preview: string; success: boolean }
  | { type: "content"; content_type: ContentType; content: string; platform?: Platform }
  | { type: "error"; message: string }
  | { type: "done" };

// ── API Responses ─────────────────────────────────────────────────────────────

export interface UploadResponse {
  image_id: string;
  filename: string;
  content_type: string;
  size: number;
  preview_url: string;
}

export interface HealthResponse {
  status: string;
  provider: string;
  model: string;
  redis: boolean;
  mongodb: boolean;
}

// ── Providers ────────────────────────────────────────────────────────────────

export interface ProviderInfo {
  name: string;
  configured: boolean;
  model: string;
}

export interface ProvidersResponse {
  active: string;
  providers: ProviderInfo[];
}

// ── UI State ──────────────────────────────────────────────────────────────────

export interface AgentActivity {
  phase: AgentPhase;
  description: string;
  toolCalls: Array<{ tool: string; args: Record<string, string>; success?: boolean }>;
}
