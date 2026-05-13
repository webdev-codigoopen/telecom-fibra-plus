import { db, appSettingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

export type RecaptchaConfig = {
  enabled: boolean;
  secret: string;
  minScore: number;
};

export async function loadRecaptchaConfig(): Promise<RecaptchaConfig> {
  try {
    const rows = await db
      .select({ key: appSettingsTable.key, value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(
        inArray(appSettingsTable.key, [
          "recaptcha_enabled",
          "recaptcha_secret_key",
          "recaptcha_min_score",
        ]),
      );
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const score = parseFloat(map.get("recaptcha_min_score") ?? "0.5");
    return {
      enabled: (map.get("recaptcha_enabled") ?? "false") === "true",
      secret: (map.get("recaptcha_secret_key") ?? "").trim(),
      minScore: Number.isFinite(score) ? Math.min(0.9, Math.max(0.1, score)) : 0.5,
    };
  } catch {
    return { enabled: false, secret: "", minScore: 0.5 };
  }
}

export type RecaptchaResult =
  | { ok: true; score: number }
  | { ok: false; reason: string };

export async function verifyRecaptcha(
  token: string,
  secret: string,
  expectedAction: string,
  minScore: number,
  remoteIp?: string,
): Promise<RecaptchaResult> {
  if (!token) return { ok: false, reason: "missing_token" };
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.set("remoteip", remoteIp);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) return { ok: false, reason: "verify_http_error" };
    const data = (await res.json()) as {
      success?: boolean;
      score?: number;
      action?: string;
      "error-codes"?: string[];
    };
    if (!data.success) return { ok: false, reason: "verify_failed" };
    if (data.action && data.action !== expectedAction)
      return { ok: false, reason: "action_mismatch" };
    const score = typeof data.score === "number" ? data.score : 0;
    if (score < minScore) return { ok: false, reason: "low_score" };
    return { ok: true, score };
  } catch {
    return { ok: false, reason: "verify_exception" };
  }
}
