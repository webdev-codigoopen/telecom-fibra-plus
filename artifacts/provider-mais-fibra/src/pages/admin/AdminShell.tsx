import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Target,
  Zap,
  Building2,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  Wifi,
} from "lucide-react";
import "./admin-shell.css";

export type AdminTabId =
  | "dashboard"
  | "mapa"
  | "wpp"
  | "ctas"
  | "planos"
  | "cidades"
  | "bots"
  | "config";

type NavItem = { id: AdminTabId; label: string; icon: ReactNode };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Visão geral",
    items: [
      { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
      { id: "mapa", label: "Mapa de cliques", icon: <MapPin /> },
    ],
  },
  {
    title: "Canais",
    items: [
      { id: "wpp", label: "WhatsApp", icon: <MessageCircle /> },
      { id: "ctas", label: "CTAs", icon: <Target /> },
    ],
  },
  {
    title: "Planos",
    items: [
      { id: "planos", label: "Desempenho", icon: <Zap /> },
      { id: "cidades", label: "Cidades", icon: <Building2 /> },
    ],
  },
  {
    title: "Segurança",
    items: [{ id: "bots", label: "Robôs vs. humanos", icon: <ShieldCheck /> }],
  },
  {
    title: "Configurações",
    items: [{ id: "config", label: "Geral", icon: <Settings /> }],
  },
];

export const ADMIN_TAB_LABEL: Record<AdminTabId, string> = {
  dashboard: "Painel de performance",
  mapa: "Mapa de cliques por cidade",
  wpp: "WhatsApp",
  ctas: "Configuração de CTAs",
  planos: "Desempenho dos planos",
  cidades: "Cidades",
  bots: "Robôs vs. humanos",
  config: "Configurações",
};

export type AdminPeriod = "today" | "week" | "all" | "custom";

type Props = {
  active: AdminTabId;
  onChange: (id: AdminTabId) => void;
  period: AdminPeriod;
  onPeriodChange: (p: AdminPeriod) => void;
  onLogout: () => void;
  children: ReactNode;
  topbarExtras?: ReactNode;
};

const PERIOD_TABS: { id: AdminPeriod; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "7 dias" },
  { id: "all", label: "Tudo" },
  { id: "custom", label: "Personalizado" },
];

export default function AdminShell({
  active,
  onChange,
  period,
  onPeriodChange,
  onLogout,
  children,
  topbarExtras,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = ADMIN_TAB_LABEL[active];

  return (
    <div className={`admin-shell${drawerOpen ? " drawer-open" : ""}`}>
      <aside className="admin-sidebar" aria-label="Navegação do painel">
        <div className="admin-sidebar-logo">
          <div className="admin-logo-mark"><Wifi size={14} /></div>
          <div>
            <div className="admin-logo-text">Provider Mais Fibra</div>
            <div className="admin-logo-sub">Painel admin</div>
          </div>
        </div>
        <nav className="admin-sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="admin-nav-section">{group.title}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-nav-item${active === item.id ? " active" : ""}`}
                  onClick={() => { onChange(item.id); setDrawerOpen(false); }}
                  data-testid={`admin-nav-${item.id}`}
                  aria-current={active === item.id ? "page" : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">v1.0 · Provider Mais Fibra</div>
      </aside>

      <div className="admin-main">
        <div className="admin-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="admin-sidebar-toggle"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="Abrir menu"
            >
              <Menu size={14} />
            </button>
            <div>
              <div className="admin-page-title">{title}</div>
              <div className="admin-page-sub">
                {periodLabel(period)} · Atualizado agora
              </div>
            </div>
          </div>
          <div className="admin-topbar-right">
            <div
              role="group"
              aria-label="Período"
              style={{
                display: "flex",
                background: "var(--as-bg)",
                borderRadius: "var(--as-radius-sm)",
                padding: 2,
                gap: 2,
              }}
            >
              {PERIOD_TABS.map((p) => {
                const act = p.id === period;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPeriodChange(p.id)}
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 4,
                      cursor: "pointer",
                      border: "none",
                      background: act ? "var(--as-surface)" : "transparent",
                      color: act ? "var(--as-text)" : "var(--as-text2)",
                      fontWeight: act ? 500 : 400,
                      boxShadow: act ? "0 1px 2px rgba(0,0,0,.08)" : "none",
                    }}
                    data-testid={`admin-period-${p.id}`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {topbarExtras}
            <button
              type="button"
              onClick={onLogout}
              className="admin-btn-outline"
              data-testid="admin-logout-button"
            >
              <LogOut size={12} /> Sair
            </button>
          </div>
        </div>

        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}

function periodLabel(p: AdminPeriod): string {
  switch (p) {
    case "today": return "Hoje";
    case "week": return "Últimos 7 dias";
    case "all": return "Todo o histórico";
    case "custom": return "Período personalizado";
  }
}
