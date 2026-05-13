import { and, desc, eq, gte } from "drizzle-orm";
import { db, adminLoginAttemptsTable } from "@workspace/db";

export const FAIL_THRESHOLD = 5;
export const FAIL_WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 30 * 60 * 1000;

export async function recordLoginAttempt(
  email: string,
  ip: string,
  success: boolean,
  reason?: string,
): Promise<void> {
  try {
    await db.insert(adminLoginAttemptsTable).values({
      email: email.trim().toLowerCase(),
      ip,
      success,
      reason: reason ?? null,
    });
  } catch {
    /* swallow — do not break login on log failure */
  }
}

// Returns ms remaining until unlock, or 0 if not locked.
//
// Logic: we look at attempts for this email in the last LOCK_MS window
// (long enough to cover the full lockout). If the last successful login
// happened after the most recent group of failures, there's no lockout.
// Otherwise count the failures in the last FAIL_WINDOW_MS — if >=
// FAIL_THRESHOLD, lock for LOCK_MS starting from the most recent failure.
export async function getLockoutMs(email: string): Promise<number> {
  const since = new Date(Date.now() - LOCK_MS);
  const rows = await db
    .select()
    .from(adminLoginAttemptsTable)
    .where(
      and(
        eq(adminLoginAttemptsTable.email, email.trim().toLowerCase()),
        gte(adminLoginAttemptsTable.createdAt, since),
      ),
    )
    .orderBy(desc(adminLoginAttemptsTable.createdAt))
    .limit(50);

  if (rows.length === 0) return 0;

  // Find the most recent success — failures before it don't count.
  const lastSuccessIndex = rows.findIndex((r) => r.success);
  const recentFailures = lastSuccessIndex === -1 ? rows : rows.slice(0, lastSuccessIndex);

  const windowStart = Date.now() - FAIL_WINDOW_MS;
  const failuresInWindow = recentFailures.filter(
    (r) => !r.success && r.createdAt.getTime() >= windowStart,
  );

  if (failuresInWindow.length < FAIL_THRESHOLD) return 0;

  const mostRecent = failuresInWindow[0]!.createdAt.getTime();
  const unlockAt = mostRecent + LOCK_MS;
  const remaining = unlockAt - Date.now();
  return remaining > 0 ? remaining : 0;
}
