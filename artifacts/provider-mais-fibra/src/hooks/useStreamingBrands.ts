import { useEffect, useState } from "react";

export type StreamingBrand = {
  id: number;
  name: string;
  logoUrl: string | null;
  sortOrder: number;
};

let cache: StreamingBrand[] | null = null;
let inflight: Promise<StreamingBrand[]> | null = null;
const listeners = new Set<(brands: StreamingBrand[]) => void>();

function notify(brands: StreamingBrand[]) {
  cache = brands;
  for (const l of listeners) l(brands);
}

async function fetchBrands(): Promise<StreamingBrand[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  inflight = fetch(`${baseUrl}/api/streaming-brands`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StreamingBrand[] = await res.json();
      notify(data);
      return data;
    })
    .catch(() => {
      const empty: StreamingBrand[] = [];
      notify(empty);
      return empty;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function refreshStreamingBrands(): Promise<StreamingBrand[]> {
  cache = null;
  inflight = null;
  return fetchBrands();
}

export function useStreamingBrands() {
  const [brands, setBrands] = useState<StreamingBrand[]>(cache ?? []);

  useEffect(() => {
    let active = true;
    listeners.add(setBrands);
    if (cache) {
      setBrands(cache);
    } else {
      void fetchBrands().then((data) => {
        if (active) setBrands(data);
      });
    }
    return () => {
      active = false;
      listeners.delete(setBrands);
    };
  }, []);

  return brands;
}
