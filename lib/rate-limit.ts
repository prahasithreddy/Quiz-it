type AllowResult = { success: boolean; limit: number; remaining: number; reset: number };

// Simple in-memory sliding window fallback (not suitable for multi-instance)
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

export async function allowRequest(key: string, limit = 20, windowMs = 60_000): Promise<AllowResult> {
  const now = Date.now();
  const entry = inMemoryStore.get(key);
  if (!entry || entry.resetAt <= now) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, limit, remaining: limit - 1, reset: now + windowMs };
  }
  if (entry.count >= limit) {
    return { success: false, limit, remaining: 0, reset: entry.resetAt };
  }
  entry.count += 1;
  return { success: true, limit, remaining: limit - entry.count, reset: entry.resetAt };
}


