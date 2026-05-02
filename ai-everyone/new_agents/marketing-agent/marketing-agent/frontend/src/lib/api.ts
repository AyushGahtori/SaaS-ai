/**
 * API client - typed interface to the FastAPI backend.
 */
import axios from "axios";
import type {
  Session,
  UploadResponse,
  HealthResponse,
  ProvidersResponse,
  SSEEvent,
  Message,
} from "@/types";

export const DEFAULT_API_PORT = 8010;
export const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || `http://localhost:${DEFAULT_API_PORT}`).replace(/\/+$/, "");

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { "Content-Type": "application/json" },
});

function isHealthResponse(value: unknown): value is HealthResponse {
  if (!value || typeof value !== "object") return false;

  const data = value as Record<string, unknown>;

  return (
    typeof data.status === "string" &&
    typeof data.provider === "string" &&
    typeof data.model === "string" &&
    typeof data.redis === "boolean" &&
    typeof data.mongodb === "boolean"
  );
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof Error && !axios.isAxiosError(error)) {
    return error.message;
  }

  if (!axios.isAxiosError(error)) {
    return `Cannot reach the Marketing AI Agent backend at ${API_BASE}.`;
  }

  if (error.response?.status === 404) {
    return `The service at ${API_BASE} responded, but it is not the Marketing AI Agent API. Start this backend on port ${DEFAULT_API_PORT} or update NEXT_PUBLIC_API_URL.`;
  }

  if (error.response) {
    return `Backend request failed (${error.response.status}). Check that the Marketing AI Agent backend is running at ${API_BASE}.`;
  }

  return `Cannot reach the Marketing AI Agent backend at ${API_BASE}.`;
}

function toApiError(error: unknown): Error {
  if (error instanceof Error && !axios.isAxiosError(error)) {
    return error;
  }

  return new Error(getApiErrorMessage(error));
}

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error))
);

export async function createSession(name?: string, productName?: string): Promise<Session> {
  const { data } = await api.post("/sessions", { name, product_name: productName });
  return data;
}

export async function listSessions(): Promise<Session[]> {
  const { data } = await api.get("/sessions");
  return data;
}

export async function updateSession(
  sessionId: string,
  updates: { name?: string; product_name?: string }
): Promise<void> {
  await api.patch(`/sessions/${sessionId}`, updates);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await api.delete(`/sessions/${sessionId}`);
}

export async function getChatHistory(
  sessionId: string,
  limit = 50
): Promise<{ messages: Message[] }> {
  const { data } = await api.get(`/chat/history/${sessionId}`, { params: { limit } });
  return data;
}

export async function getSessionContent(sessionId: string) {
  const { data } = await api.get(`/sessions/${sessionId}/content`);
  return data;
}

export async function uploadImage(
  file: File,
  sessionId: string
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("session_id", sessionId);

  try {
    const { data } = await axios.post(`${API_BASE}/api/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export function getImageUrl(imageId: string): string {
  return `${API_BASE}/uploads/${imageId}`;
}

export function createChatStream(
  sessionId: string,
  message: string,
  imageId?: string,
  onEvent?: (_event: SSEEvent) => void,
  onError?: (_error: Error) => void
): EventSource {
  const params = new URLSearchParams({
    message,
    ...(imageId && { image_id: imageId }),
  });

  const url = `${API_BASE}/api/chat/stream/${sessionId}?${params}`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    try {
      const event: SSEEvent = JSON.parse(e.data);
      onEvent?.(event);
    } catch {
      // Ignore parse errors from non-JSON stream frames.
    }
  };

  es.onerror = () => {
    onError?.(
      new Error(
        `Unable to receive a response from the chat stream at ${API_BASE}.`
      )
    );
  };

  return es;
}

export async function listProviders(): Promise<ProvidersResponse> {
  const { data } = await api.get("/config/providers");
  return data as ProvidersResponse;
}

export async function switchProvider(provider: string): Promise<ProvidersResponse> {
  const { data } = await api.post("/config/provider", { provider });
  return data as ProvidersResponse;
}

export async function checkHealth(): Promise<HealthResponse> {
  try {
    const { data } = await axios.get(`${API_BASE}/health`);

    if (!isHealthResponse(data)) {
      throw new Error(
        `The service at ${API_BASE} responded, but it is not the Marketing AI Agent backend. Start this backend on port ${DEFAULT_API_PORT} or update NEXT_PUBLIC_API_URL.`
      );
    }

    return data;
  } catch (error) {
    throw toApiError(error);
  }
}
