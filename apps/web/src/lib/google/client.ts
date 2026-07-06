import { getValidGoogleAccessToken } from "@/lib/google/tokens";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextBackoffMs(attempt: number) {
  const base = 500 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 120);
  return Math.min(base + jitter, 12_000);
}

export async function fetchGoogleJson<T>(
  userId: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const accessToken = await getValidGoogleAccessToken(userId);

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status === 401 && attempt < maxAttempts - 1) {
      await sleep(nextBackoffMs(attempt));
      continue;
    }

    if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts - 1) {
      await sleep(nextBackoffMs(attempt));
      continue;
    }

    const errorText = await response.text();
    throw new Error(`Google API request failed (${response.status}): ${errorText}`);
  }

  throw new Error("Google API request failed after retries.");
}
