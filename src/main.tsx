import { PwaProvider, registerPwa } from "./pwa";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { GlassInteractions } from "./glass-interactions";
import "./styles.css";
import "./food-ux.css";
import "./mobile-ux.css";
import "./chart-glass.css";
import "./surface-glass.css";
import "./quiet-ui.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlassInteractions />
    <PwaProvider>
      <App />
    </PwaProvider>
  </StrictMode>,
);

registerPwa();
