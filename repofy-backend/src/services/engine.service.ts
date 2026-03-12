import { env } from "../config/env";

export async function callEngine<T>(
  path: string,
  body: object,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${env.engineUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": env.engineInternalKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Engine ${path} failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<T>;
}
