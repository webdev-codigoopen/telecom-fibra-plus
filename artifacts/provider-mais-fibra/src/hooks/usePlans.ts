import { useState, useEffect } from "react";
import { type Plan, plans as staticPlans } from "../lib/plans";

export type ApiPlan = {
  id: number;
  speed: string;
  wifi: string;
  price: string;
  inclusions: string[];
  featured: boolean;
  badge: string | null;
  bonus: string | null;
  sortOrder: number;
  imageUrl: string | null;
};

function apiPlanToPlan(p: ApiPlan): Plan {
  return {
    speed: p.speed,
    wifi: p.wifi,
    price: p.price,
    inclusions: p.inclusions,
    featured: p.featured,
    badge: p.badge ?? undefined,
    bonus: p.bonus ?? undefined,
    imageUrl: p.imageUrl ?? undefined,
  };
}

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>(staticPlans);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    fetch(`${baseUrl}/api/plans`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ApiPlan[] = await res.json();
        if (data.length > 0) {
          setPlans(data.map(apiPlanToPlan));
        }
      })
      .catch((err) => {
        setError(String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  return { plans, loading, error };
}
