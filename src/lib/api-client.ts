// Lightweight API client for the Godavari One frontend.

const BASE = "/api/v1";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export interface HotelBookingRequest {
  listingId: string;
  roomId?: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
  guests: number;
  specialRequest?: string | null;
}

export interface CeremonyBookingRequest {
  purohitId: string;
  ceremonyType: string;
  bookingDate: string;
  startTime: string;
  durationMinutes?: number;
  visitorName?: string | null;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  participantsCount?: number | null;
  participantCount?: number | null;
  locationType?: "GHAT" | "HOME_HOTEL" | "TEMPLE";
  locationAddress?: string | null;
  ceremonyLocation?: string | null;
  customaryRequirements?: string | null;
  visitorNotes?: string | null;
  deceasedRelationship?: string | null;
  gotra?: string | null;
  serviceFee?: number | null;
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  // FormData must NOT set Content-Type; the browser sets the boundary
  if (!(opts.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, { ...opts, headers, credentials: "same-origin" });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data && typeof (data as any).error === "string")
      ? (data as any).error
      : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, (data as any)?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
