// ---------------------------------------------------------------------------
// adminFetch — wrapper around fetch() that auto-injects the CSRF token for
// admin mutating requests.
//
// The backend (csrf-csrf double-submit) requires `X-CSRF-Token` on every
// authenticated mutation, regardless of transport (cookie OR header bearer).
// This helper:
//   1. Lazily fetches /api/auth/csrf on first mutation and caches the token.
//   2. Adds `X-CSRF-Token` to every POST/PUT/PATCH/DELETE.
//   3. Adds `credentials: "include"` so the cookie is sent + the response
//      Set-Cookie is honored.
//   4. Falls through unchanged for read-only verbs (no token needed).
//
// On a 403 with "Invalid or missing CSRF token" we drop the cache and retry
// once, so a long-lived admin tab survives a token rotation.
// ---------------------------------------------------------------------------

const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

let cachedToken: string | null = null;
let inFlight: Promise<string> | null = null;

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/csrf`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch CSRF token: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { csrfToken?: string };
  if (!body.csrfToken) throw new Error("CSRF token missing from response");
  return body.csrfToken;
}

async function getCsrfToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (!inFlight) {
    inFlight = fetchCsrfToken()
      .then((t) => {
        cachedToken = t;
        return t;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function clearCsrfCache(): void {
  cachedToken = null;
}

const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"]);

async function doFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  csrfToken: string | null,
): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}

export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (READ_ONLY.has(method)) {
    return doFetch(input, init, null);
  }
  const token = await getCsrfToken();
  let res = await doFetch(input, init, token);
  if (res.status === 403) {
    // Token may have rotated. Drop cache and retry once.
    cachedToken = null;
    const fresh = await getCsrfToken();
    res = await doFetch(input, init, fresh);
  }
  return res;
}
