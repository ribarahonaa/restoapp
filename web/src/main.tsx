import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import "./i18n/index.js";
import "./tailwind.css";
import "leaflet/dist/leaflet.css";
import { AuthProvider } from "./auth/AuthContext.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
