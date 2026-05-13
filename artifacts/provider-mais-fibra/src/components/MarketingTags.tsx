import { useEffect, useRef } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";

// Loads Google Analytics 4, Google Tag Manager, Google Ads conversion tag, and
// Meta (Facebook) Pixel scripts once their IDs are configured in the admin
// panel. Each script is only injected once per id; if the id changes we won't
// double-inject. This component renders nothing.
//
// Conversions API (server-side) lives on the backend; here we only handle
// client-side tags.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

const injected = new Set<string>();

function inject(id: string, fn: () => void): void {
  if (injected.has(id)) return;
  injected.add(id);
  try {
    fn();
  } catch {
    injected.delete(id);
  }
}

function loadScript(src: string, attrs: Record<string, string> = {}): HTMLScriptElement {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
  return s;
}

export default function MarketingTags() {
  const settings = useAppSettings();
  const ga4 = settings.ga4_measurement_id.trim();
  const gtm = settings.gtm_container_id.trim();
  const ads = settings.google_ads_conversion_id.trim();
  const pixel = settings.meta_pixel_id.trim();
  const lastApplied = useRef<{ ga4?: string; gtm?: string; ads?: string; pixel?: string }>({});

  useEffect(() => {
    if (gtm && lastApplied.current.gtm !== gtm) {
      lastApplied.current.gtm = gtm;
      inject(`gtm:${gtm}`, () => {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
        loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtm)}`);
      });
    }
  }, [gtm]);

  useEffect(() => {
    if (ga4 && lastApplied.current.ga4 !== ga4) {
      lastApplied.current.ga4 = ga4;
      inject(`ga4:${ga4}`, () => {
        loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`);
        window.dataLayer = window.dataLayer || [];
        const gtag = function (...args: unknown[]) {
          (window.dataLayer as unknown[]).push(args);
        } as Window["gtag"];
        window.gtag = gtag;
        gtag!("js", new Date());
        gtag!("config", ga4, { anonymize_ip: true });
      });
    }
  }, [ga4]);

  useEffect(() => {
    if (ads && lastApplied.current.ads !== ads) {
      lastApplied.current.ads = ads;
      inject(`ads:${ads}`, () => {
        // gtag.js may already be loaded by GA4 — reuse if so.
        if (!window.gtag) {
          loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ads)}`);
          window.dataLayer = window.dataLayer || [];
          const gtag = function (...args: unknown[]) {
            (window.dataLayer as unknown[]).push(args);
          } as Window["gtag"];
          window.gtag = gtag;
          gtag!("js", new Date());
        }
        window.gtag!("config", ads);
      });
    }
  }, [ads]);

  useEffect(() => {
    if (pixel && lastApplied.current.pixel !== pixel) {
      lastApplied.current.pixel = pixel;
      inject(`pixel:${pixel}`, () => {
        // Standard Meta Pixel snippet, slightly typed.
        const w = window as Window & { fbq?: ((...args: unknown[]) => void) & Record<string, unknown> };
        if (w.fbq) {
          (w.fbq as (...args: unknown[]) => void)("init", pixel);
          (w.fbq as (...args: unknown[]) => void)("track", "PageView");
          return;
        }
        const queue: unknown[][] = [];
        const fbq = function (...args: unknown[]) {
          // @ts-expect-error dynamic shim
          if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
          else queue.push(args);
        } as ((...args: unknown[]) => void) & Record<string, unknown>;
        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = "2.0";
        fbq.queue = queue;
        w.fbq = fbq;
        w._fbq = w._fbq ?? fbq;
        loadScript("https://connect.facebook.net/en_US/fbevents.js");
        fbq("init", pixel);
        fbq("track", "PageView");
      });
    }
  }, [pixel]);

  // GTM <noscript> iframe fallback — appended once.
  useEffect(() => {
    if (!gtm) return;
    const id = `gtm-noscript:${gtm}`;
    if (injected.has(id)) return;
    injected.add(id);
    const ns = document.createElement("noscript");
    ns.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(
      gtm,
    )}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.insertBefore(ns, document.body.firstChild);
  }, [gtm]);

  return null;
}
