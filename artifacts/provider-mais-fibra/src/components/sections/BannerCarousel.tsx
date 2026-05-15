import { useEffect, useState } from "react";

type Banner = {
  id: number;
  name: string;
  description: string | null;
  desktopImageUrl: string;
  mobileImageUrl: string;
  linkUrl: string | null;
};

const ROTATE_MS = 6000;
const FADE_MS = 700;

function resolveUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
  if (!base) return url;
  if (url === base || url.startsWith(`${base}/`)) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

export default function BannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const base = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    fetch(`${base}/api/banners`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Banner[]) => {
        if (!cancelled && Array.isArray(data)) setBanners(data);
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (paused || banners.length < 2) return;
    const t = window.setInterval(() => {
      setActive((i) => (i + 1) % banners.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [paused, banners.length]);

  if (banners.length === 0) return null;

  return (
    <section
      data-testid="banner-carousel"
      aria-label="Banners promocionais"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        width: "100%",
        backgroundColor: "#020B2E",
        position: "relative",
        display: "block",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", width: "100%" }}>
        {banners.map((b, i) => {
          const isActive = i === active;
          const isFirst = i === 0;
          const content = (
            <picture
              style={{
                display: "block",
                width: "100%",
                height: isFirst ? "auto" : "100%",
              }}
            >
              <source media="(max-width: 768px)" srcSet={resolveUrl(b.mobileImageUrl)} />
              <img
                src={resolveUrl(b.desktopImageUrl)}
                alt={b.description ?? b.name}
                style={{
                  display: "block",
                  width: "100%",
                  height: isFirst ? "auto" : "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                }}
                loading={isFirst ? "eager" : "lazy"}
              />
            </picture>
          );
          const layerStyle: React.CSSProperties = isFirst
            ? {
                position: "relative",
                width: "100%",
                opacity: isActive ? 1 : 0,
                transition: `opacity ${FADE_MS}ms ease-in-out`,
                pointerEvents: isActive ? "auto" : "none",
              }
            : {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: isActive ? 1 : 0,
                transition: `opacity ${FADE_MS}ms ease-in-out`,
                pointerEvents: isActive ? "auto" : "none",
              };
          return (
            <div
              key={b.id}
              data-testid={`banner-slide-${b.id}`}
              aria-hidden={!isActive}
              style={layerStyle}
            >
              {b.linkUrl ? (
                <a
                  href={b.linkUrl}
                  target={/^https?:\/\//i.test(b.linkUrl) ? "_blank" : undefined}
                  rel={/^https?:\/\//i.test(b.linkUrl) ? "noopener noreferrer" : undefined}
                  style={{ display: "block", width: "100%", height: isFirst ? "auto" : "100%" }}
                  tabIndex={isActive ? 0 : -1}
                >
                  {content}
                </a>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>

      {banners.length > 1 && (
        <div
          role="tablist"
          aria-label="Selecionar banner"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 12,
            display: "flex",
            justifyContent: "center",
            gap: 8,
            zIndex: 2,
          }}
        >
          {banners.map((b, i) => {
            const isActive = i === active;
            return (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Ir para banner ${i + 1}: ${b.name}`}
                onClick={() => setActive(i)}
                data-testid={`banner-dot-${i}`}
                style={{
                  width: isActive ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  background: isActive ? "#fff" : "rgba(255,255,255,.5)",
                  transition: "width .25s, background .25s",
                  padding: 0,
                }}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
