import { Switch, Route, Router as WouterRouter } from "wouter";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import QuemSomos from "@/pages/QuemSomos";
import Contato from "@/pages/Contato";
import OndeEstamos from "@/pages/OndeEstamos";
import Cidade from "@/pages/Cidade";
import Admin from "@/pages/Admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/quem-somos" component={QuemSomos} />
      <Route path="/contato" component={Contato} />
      <Route path="/onde-estamos" component={OndeEstamos} />
      <Route path="/cidade/:slug" component={Cidade} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

export default App;
