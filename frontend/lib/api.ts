const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

// ── Auth token ─────────────────────────────────────────────────────────────
// Stored in module memory (not localStorage). Set by AuthContext on login/logout.
let _authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  _authToken = token;
}

// ── Rate limit error ───────────────────────────────────────────────────────

export class RateLimitError extends Error {
  retryAfter?: number;
  constructor(retryAfter?: number) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

// ── Network / connectivity error ───────────────────────────────────────────

export class NetworkError extends Error {
  constructor() {
    super("Network error — no response received");
    this.name = "NetworkError";
  }
}

/**
 * Returns the right user-visible error message for a caught API error.
 * Use as the last argument to `toast.error(apiErrorMessage(err, "Fallback text"))`.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof NetworkError) return "Something went wrong. Check your connection.";
  return fallback;
}

// ── Core request helper ────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (_authToken) {
    headers["Authorization"] = `Bearer ${_authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    // fetch() itself threw — typically a network connectivity failure
    throw new NetworkError();
  }

  if (res.status === 401) {
    // Token expired or invalid — redirect to login
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get("Retry-After");
    const parsed = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
    throw new RateLimitError(Number.isFinite(parsed) ? parsed : undefined);
  }

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  return res.json();
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const loginApi = (email: string, password: string) =>
  request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const registerApi = (email: string, password: string) =>
  request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const getMeApi = () => request<AuthUser>("/auth/me");
export const forgotPassword = (email: string) =>
  request<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
export const resetPassword = (token: string, newPassword: string) =>
  request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });

// ── Campaigns ──────────────────────────────────────────────────────────────
export const getCampaigns = () => request<Campaign[]>("/campaigns");
export const getCampaign = (id: number) => request<Campaign>(`/campaigns/${id}`);
export const createCampaign = (data: CreateCampaignRequest) =>
  request<Campaign>("/campaigns", { method: "POST", body: JSON.stringify(data) });
export const updateCampaign = (id: number, data: UpdateCampaignRequest) =>
  request<Campaign>(`/campaigns/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteCampaign = (id: number) =>
  request<void>(`/campaigns/${id}`, { method: "DELETE" });

// ── NPCs ───────────────────────────────────────────────────────────────────
export const getNpcs = (campaignId: number) =>
  request<Npc[]>(`/campaigns/${campaignId}/npcs`);
export const createNpc = (campaignId: number, data: CreateNpcRequest) =>
  request<Npc>(`/campaigns/${campaignId}/npcs`, { method: "POST", body: JSON.stringify(data) });
export const generateNpc = (campaignId: number, hints?: string) =>
  request<Npc>(`/campaigns/${campaignId}/npcs/generate`, {
    method: "POST",
    body: JSON.stringify({ hints: hints ?? "" }),
  });
export const updateNpc = (campaignId: number, npcId: number, data: UpdateNpcRequest) =>
  request<Npc>(`/campaigns/${campaignId}/npcs/${npcId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
export const deleteNpc = (campaignId: number, npcId: number) =>
  request<void>(`/campaigns/${campaignId}/npcs/${npcId}`, { method: "DELETE" });

// ── Sessions ───────────────────────────────────────────────────────────────
export const getSessions = (campaignId: number) =>
  request<Session[]>(`/campaigns/${campaignId}/sessions`);
export const createSession = (campaignId: number, data?: CreateSessionRequest) =>
  request<Session>(`/campaigns/${campaignId}/sessions`, {
    method: "POST",
    body: JSON.stringify(data ?? {}),
  });
export const updateSession = (campaignId: number, sessionId: number, data: UpdateSessionRequest) =>
  request<Session>(`/campaigns/${campaignId}/sessions/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
export const deleteSession = (campaignId: number, sessionId: number) =>
  request<void>(`/campaigns/${campaignId}/sessions/${sessionId}`, { method: "DELETE" });
export const processSessionNotes = (campaignId: number, sessionId: number) =>
  request<Session>(`/campaigns/${campaignId}/sessions/${sessionId}/process`, { method: "POST" });
export const getRecap = (campaignId: number) =>
  request<{ recap: string; draftId: number | null }>(`/campaigns/${campaignId}/sessions/recap`);
export const saveSessionRecap = (campaignId: number, sessionId: number, recap: string) =>
  request<Session>(`/campaigns/${campaignId}/sessions/${sessionId}/recap`, {
    method: "PUT",
    body: JSON.stringify({ recap }),
  });
export const clearSessionRecap = (campaignId: number, sessionId: number) =>
  request<Session>(`/campaigns/${campaignId}/sessions/${sessionId}/recap`, { method: "DELETE" });
export const clearSessionNotes = (campaignId: number, sessionId: number) =>
  request<Session>(`/campaigns/${campaignId}/sessions/${sessionId}/notes`, { method: "DELETE" });
export const clearSessionSummary = (campaignId: number, sessionId: number) =>
  request<Session>(`/campaigns/${campaignId}/sessions/${sessionId}/summary`, { method: "DELETE" });

// ── Recap Drafts ───────────────────────────────────────────────────────────
export const getRecapDrafts = (campaignId: number) =>
  request<RecapDraft[]>(`/campaigns/${campaignId}/recap-drafts`);
export const deleteRecapDraft = (campaignId: number, draftId: number) =>
  request<void>(`/campaigns/${campaignId}/recap-drafts/${draftId}`, { method: "DELETE" });
export const attachRecapDraft = (campaignId: number, draftId: number, sessionId: number) =>
  request<Session>(`/campaigns/${campaignId}/recap-drafts/${draftId}/attach`, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });

// ── Types ──────────────────────────────────────────────────────────────────

// Request shapes — mirror the backend DTOs for compile-time safety.

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  setting?: string;
}

export interface UpdateCampaignRequest {
  name: string;
  description?: string;
  setting?: string;
  notes?: string;
}

export interface CreateNpcRequest {
  name: string;
  race?: string;
  role?: string;
  description?: string;
  personality?: string;
  quirk?: string;
  secret?: string;
  relationshipToParty?: string;
  notes?: string;
  isAlive: boolean;
}

export type UpdateNpcRequest = CreateNpcRequest;

export interface CreateSessionRequest {
  playedOn?: string;
}

export interface UpdateSessionRequest {
  rawNotes?: string;
  summary?: string;
  playedOn?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface Campaign {
  id: number;
  name: string;
  description?: string;
  setting?: string;
  notes?: string;
  createdAt: string;
  userId?: string;
  npcs?: Npc[];
  sessions?: Session[];
}

export interface Npc {
  id: number;
  campaignId: number;
  name: string;
  race?: string;
  role?: string;
  description?: string;
  personality?: string;
  quirk?: string;
  secret?: string;
  relationshipToParty?: string;
  notes?: string;
  isAlive: boolean;
  createdAt: string;
}

export interface Session {
  id: number;
  campaignId: number;
  sessionNumber: number;
  playedOn: string;
  rawNotes?: string;
  summary?: string;
  storyBeats?: string;
  newNpcsFound?: string;
  savedRecap?: string;
}

export interface RecapDraft {
  id: number;
  campaignId: number;
  text: string;
  createdAt: string;
}