import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { HelmetProvider } from "react-helmet-async";
import { MotionConfig } from "framer-motion";
import Home from "@/pages/Home";
import MarketingTags from "@/components/MarketingTags";

const NotFound = lazy(() => import("@/pages/not-found"));
const QuemSomos = lazy(() => import("@/pages/QuemSomos"));
const Contato = lazy(() => import("@/pages/Contato"));
const OndeEstamos = lazy(() => import("@/pages/OndeEstamos"));
const DemandaCidades = lazy(() => import("@/pages/DemandaCidades"));
const PoliticaPrivacidade = lazy(() => import("@/pages/PoliticaPrivacidade"));
const TermosDeUso = lazy(() => import("@/pages/TermosDeUso"));
const Admin = lazy(() => import("@/pages/Admin"));
const IndiqueUmAmigo = lazy(() => import("@/pages/IndiqueUmAmigo"));

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F5F6FA",
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <span style={{ color: "#122AD5", fontWeight: 600 }}>Carregando…</span>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/quem-somos" component={QuemSomos} />
      <Route path="/contato" component={Contato} />
      <Route path="/indique-um-amigo" component={IndiqueUmAmigo} />
      <Route path="/onde-estamos" component={OndeEstamos} />
      <Route path="/demanda" component={DemandaCidades} />
      <Route path="/politica-de-privacidade" component={PoliticaPrivacidade} />
      <Route path="/termos-de-uso" component={TermosDeUso} />
      <Route path="/admin" component={Admin} />
      <Route path="/4acess" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Skip animations during initial load (keeps first paint fast and smooth);
  // enable them after `window.load` so scroll effects work as usual after.
  const [animationsReady, setAnimationsReady] = useState(false);
  useEffect(() => {
    if (document.readyState === "complete") {
      setAnimationsReady(true);
      return;
    }
    const onLoad = () => setAnimationsReady(true);
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return (
    <HelmetProvider>
      <MotionConfig reducedMotion={animationsReady ? "never" : "always"}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:text-[#122AD5] focus:rounded focus:shadow-lg focus:outline-2 focus:outline-[#122AD5]"
        >
          Pular para o conteúdo principal
        </a>
        <MarketingTags />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Suspense fallback={<RouteFallback />}>
            <Router />
          </Suspense>
        </WouterRouter>
      </MotionConfig>
    </HelmetProvider>
  );
}

export default App;
