const ENGINE_URL =
  process.env.NEXT_PUBLIC_ENGINE_URL ?? "http://localhost:4000";

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let message = text;
    try {
      const json = JSON.parse(text) as { error?: string; code?: string; message?: string };
      const body = json.error ?? json.message ?? text;
      message = json.code ? `${body} [${json.code}]` : body;
    } catch {
      // not JSON — use raw text
    }
    throw new Error(`${res.status}: ${message}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiGet<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiGet<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${ENGINE_URL}${path}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Engine API error ${res.status}: ${text}`);
  }
}

export function engineUrl(path: string): string {
  return `${ENGINE_URL}${path}`;
}
