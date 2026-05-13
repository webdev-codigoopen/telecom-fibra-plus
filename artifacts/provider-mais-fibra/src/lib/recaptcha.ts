// Shared reCAPTCHA v3 helpers for the web client (Contact form, Admin login).

const scriptPromises = new Map<string, Promise<void>>();

function whenReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { grecaptcha?: { ready: (cb: () => void) => void } };
    if (w.grecaptcha) w.grecaptcha.ready(() => resolve());
    else reject(new Error("grecaptcha missing"));
  });
}

export function loadRecaptcha(siteKey: string): Promise<void> {
  const cached = scriptPromises.get(siteKey);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("no document"));
      return;
    }
    const selector = `script[data-recaptcha="v3"][data-key="${siteKey}"]`;
    const existing = document.querySelector<HTMLScriptElement>(selector);
    if (existing) {
      whenReady().then(resolve).catch(() => {
        existing.addEventListener(
          "load",
          () => whenReady().then(resolve).catch(reject),
          { once: true },
        );
      });
      return;
    }
    const s = document.createElement("script");
    s.dataset["recaptcha"] = "v3";
    s.dataset["key"] = siteKey;
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    s.async = true;
    s.defer = true;
    s.onload = () => whenReady().then(resolve).catch(reject);
    s.onerror = () => {
      scriptPromises.delete(siteKey);
      reject(new Error("script load failed"));
    };
    document.head.appendChild(s);
  });
  scriptPromises.set(siteKey, p);
  return p;
}

export async function getRecaptchaToken(siteKey: string, action: string): Promise<string> {
  await loadRecaptcha(siteKey);
  const w = window as unknown as {
    grecaptcha?: { execute: (key: string, opts: { action: string }) => Promise<string> };
  };
  if (!w.grecaptcha) throw new Error("recaptcha not ready");
  return w.grecaptcha.execute(siteKey, { action });
}
