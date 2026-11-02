import type { Envelope } from "./types";
const sessionKey = "onebody.session";
function readSession() {
  try {
    return sessionStorage.getItem(sessionKey);
  } catch {
    return null;
  }
}
let token: string | null = readSession();
let onExpired = () => {};
export const session = {
  set(value: string | null) {
    token = value;
    try {
      if (value) sessionStorage.setItem(sessionKey, value);
      else sessionStorage.removeItem(sessionKey);
    } catch {
      /* Login still works in memory when browser storage is blocked. */
    }
  },
  hasToken() {
    return !!token;
  },
  onExpired(callback: () => void) {
    onExpired = callback;
  },
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<Envelope<T>> {
  let response: Response;
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const requestToken = token;
  if (requestToken) headers.set("Authorization", `Bearer ${requestToken}`);
  try {
    response = await fetch(
      `${(import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "")}${path}`,
      { ...init, headers },
    );
  } catch {
    throw new ApiError(
      "Could not connect. Check your connection and try again.",
      0,
    );
  }
  if (response.status === 204)
    return { status: "success", data: undefined as T };
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && requestToken && token === requestToken)
      onExpired();
    const detail = payload?.errors
      ?.map(
        (e: { path?: string; message: string }) =>
          `${e.path ? `${e.path}: ` : ""}${e.message}`,
      )
      .join(". ");
    throw new ApiError(
      detail ||
        payload?.message ||
        (response.status === 429
          ? "Too many attempts. Please try again later."
          : "Something went wrong. Please try again."),
      response.status,
    );
  }
  if (!payload || !("data" in payload))
    throw new ApiError(
      "The server returned an unexpected response.",
      response.status,
    );
  return payload;
}
export const send = (method: string, body: unknown) => ({
  method,
  body: JSON.stringify(body),
});
export function safeMediaUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
