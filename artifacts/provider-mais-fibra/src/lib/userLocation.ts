import { cities } from "./cities";
import {
  DEFAULT_SETTINGS,
  fetchAppSettings,
  getCachedAppSettings,
  type AppSettings,
} from "../hooks/useAppSettings";

export type UserLocation = {
  city: string;
  region: string;
  isCovered: boolean;
};

const STORAGE_KEY = "provider_mais_fibra_user_location";
const TTL_MS = 24 * 60 * 60 * 1000;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const COVERED_CITIES: ReadonlySet<string> = new Set(
  cities.map((c) => normalize(c.name)),
);

function isCoveredCity(cityName: string | null | undefined): boolean {
  if (!cityName) return false;
  return COVERED_CITIES.has(normalize(cityName));
}

function buildLocation(city: string, region: string): UserLocation {
  return {
    city: city.trim(),
    region: region.trim(),
    isCovered: isCoveredCity(city),
  };
}

type CachedRecord = { value: UserLocation; ts: number };

export function getCachedLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRecord;
    if (!parsed?.value || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function setCachedLocation(value: UserLocation): void {
  if (typeof window === "undefined") return;
  try {
    const record: CachedRecord = { value, ts: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(id);
  }
}

async function detectByIp(): Promise<UserLocation | null> {
  try {
    const res = await fetchWithTimeout("https://ipapi.co/json/", 4000);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      city?: string;
      region_code?: string;
      region?: string;
    };
    if (!data?.city) return null;
    const region = data.region_code || data.region || "";
    return buildLocation(data.city, region);
  } catch {
    return null;
  }
}

function getBrowserPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: TTL_MS },
    );
  });
}

async function detectByBrowser(): Promise<UserLocation | null> {
  const pos = await getBrowserPosition();
  if (!pos) return null;
  try {
    const { latitude, longitude } = pos.coords;
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`;
    const res = await fetchWithTimeout(url, 5000);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivisionCode?: string;
      principalSubdivision?: string;
    };
    const city = data.city || data.locality || "";
    if (!city) return null;
    const subdivisionCode = data.principalSubdivisionCode || "";
    const region =
      subdivisionCode.split("-")[1] || data.principalSubdivision || "";
    return buildLocation(city, region);
  } catch {
    return null;
  }
}

export async function loadUserLocation(): Promise<UserLocation | null> {
  const cached = getCachedLocation();
  if (cached) return cached;
  const ip = await detectByIp();
  if (ip) {
    setCachedLocation(ip);
    return ip;
  }
  const browser = await detectByBrowser();
  if (browser) {
    setCachedLocation(browser);
    return browser;
  }
  return null;
}

function applyTemplate(
  template: string,
  vars: { speed: string; city: string; region: string; place: string },
): string {
  return template
    .replace(/\{speed\}/g, vars.speed)
    .replace(/\{city\}/g, vars.city)
    .replace(/\{region\}/g, vars.region)
    .replace(/\{place\}/g, vars.place);
}

export function buildPlanWhatsappMessage(
  speed: string,
  location: UserLocation | null,
  settings: AppSettings = getCachedAppSettings(),
): string {
  if (location && location.city) {
    const place = location.region
      ? `${location.city}/${location.region}`
      : location.city;
    const template = location.isCovered
      ? settings.cta_subscribe_message
      : settings.cta_unavailable_message;
    return applyTemplate(template, {
      speed,
      city: location.city,
      region: location.region,
      place,
    });
  }
  // No location detected — fall back to the subscribe template with empty place.
  return applyTemplate(settings.cta_subscribe_message, {
    speed,
    city: "",
    region: "",
    place: "",
  })
    .replace(/\s+na cidade de\s*$/i, "")
    .replace(/,\s*$/, "")
    .trim();
}

export const WHATSAPP_PHONE = DEFAULT_SETTINGS.whatsapp_number;

export function buildPlanWhatsappHref(
  speed: string,
  location: UserLocation | null,
  extraSuffix?: string,
  settings: AppSettings = getCachedAppSettings(),
): string {
  const base = buildPlanWhatsappMessage(speed, location, settings);
  const message = extraSuffix ? `${base}\n${extraSuffix}` : base;
  return `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(message)}`;
}

export async function handlePlanWhatsappClick(
  event: { preventDefault: () => void },
  speed: string,
  extraSuffix?: string,
): Promise<void> {
  event.preventDefault();
  const whatsappWindow =
    typeof window !== "undefined" ? window.open("about:blank", "_blank") : null;
  const [location, settings] = await Promise.all([
    loadUserLocation(),
    fetchAppSettings(),
  ]);
  const href = buildPlanWhatsappHref(speed, location, extraSuffix, settings);
  if (whatsappWindow) {
    whatsappWindow.location.href = href;
  } else if (typeof window !== "undefined") {
    window.location.href = href;
  }
}

export function warmUserLocation(): void {
  if (typeof window === "undefined") return;
  if (getCachedLocation()) return;
  void loadUserLocation();
}
