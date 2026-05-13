import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { warmUserLocation } from "./lib/userLocation";

warmUserLocation();

createRoot(document.getElementById("root")!).render(<App />);
