import { useEffect, useState } from "react";

export type AppSettings = {
  whatsapp_number: string;
  cta_subscribe_message: string;
  cta_unavailable_message: string;
  interest_notification_email: string;
  interest_notification_enabled: string;
  recaptcha_enabled: string;
  recaptcha_site_key: string;
  recaptcha_secret_key: string;
  recaptcha_min_score: string;
  ga4_measurement_id: string;
  gtm_container_id: string;
  google_ads_conversion_id: string;
  google_ads_conversion_label: string;
  meta_pixel_id: string;
  meta_capi_token: string;
  meta_capi_test_event_code: string;
  gmb_profile_url: string;
  google_places_api_key: string;
  google_places_id: string;
  reviews_min_rating: string;
  reviews_show_count: string;
  smtp_host: string;
  smtp_port: string;
  smtp_secure: string;
  smtp_user: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  whatsapp_number: "5577998444757",
  cta_subscribe_message:
    "Quero assinar o plano {speed} mega da Provider Mais Fibra na cidade de {place}",
  cta_unavailable_message:
    "Queria saber quando a Provider Mais Fibra vai estar disponível na minha cidade, {place}",
  interest_notification_email: "",
  interest_notification_enabled: "false",
  recaptcha_enabled: "false",
  recaptcha_site_key: "",
  recaptcha_secret_key: "",
  recaptcha_min_score: "0.5",
  ga4_measurement_id: "",
  gtm_container_id: "",
  google_ads_conversion_id: "",
  google_ads_conversion_label: "",
  meta_pixel_id: "",
  meta_capi_token: "",
  meta_capi_test_event_code: "",
  gmb_profile_url: "",
  google_places_api_key: "",
  google_places_id: "",
  reviews_min_rating: "4",
  reviews_show_count: "6",
  smtp_host: "",
  smtp_port: "",
  smtp_secure: "auto",
  smtp_user: "",
  smtp_password: "",
  smtp_from_email: "",
  smtp_from_name: "",
};

let cache: AppSettings | null = null;
let inflight: Promise<AppSettings> | null = null;
const listeners = new Set<(s: AppSettings) => void>();

function notify(value: AppSettings) {
  cache = value;
  for (const l of listeners) l(value);
}

function baseUrl(): string {
  return import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
}

export async function fetchAppSettings(): Promise<AppSettings> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch(`${baseUrl()}/api/settings`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Partial<AppSettings>;
      const merged: AppSettings = { ...DEFAULT_SETTINGS, ...data };
      notify(merged);
      return merged;
    })
    .catch(() => {
      notify(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function refreshAppSettings(): Promise<AppSettings> {
  cache = null;
  inflight = null;
  return fetchAppSettings();
}

export function getCachedAppSettings(): AppSettings {
  return cache ?? DEFAULT_SETTINGS;
}

export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(
    cache ?? DEFAULT_SETTINGS,
  );
  useEffect(() => {
    let active = true;
    listeners.add(setSettings);
    if (cache) {
      setSettings(cache);
    } else {
      void fetchAppSettings().then((s) => {
        if (active) setSettings(s);
      });
    }
    return () => {
      active = false;
      listeners.delete(setSettings);
    };
  }, []);
  return settings;
}
