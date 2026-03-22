import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import "@/i18n";
import { App } from "./app/App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
