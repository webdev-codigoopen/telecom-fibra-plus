import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "./index.css";
import { warmUserLocation } from "./lib/userLocation";

warmUserLocation();

createRoot(document.getElementById("root")!).render(<App />);
