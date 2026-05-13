import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { HelmetProvider } from "react-helmet-async";
import Home from "@/pages/Home";

const NotFound = lazy(() => import("@/pages/not-found"));
const QuemSomos = lazy(() => import("@/pages/QuemSomos"));
const Contato = lazy(() => import("@/pages/Contato"));
const OndeEstamos = lazy(() => import("@/pages/OndeEstamos"));
const DemandaCidades = lazy(() => import("@/pages/DemandaCidades"));
const Admin = lazy(() => import("@/pages/Admin"));

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
      <Route path="/onde-estamos" component={OndeEstamos} />
      <Route path="/demanda" component={DemandaCidades} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <HelmetProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Suspense fallback={<RouteFallback />}>
          <Router />
        </Suspense>
      </WouterRouter>
    </HelmetProvider>
  );
}

export default App;
