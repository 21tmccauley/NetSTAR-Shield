import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AlertWindow } from "./components/AlertWindow.jsx";
import "./index.css"; // Use your existing styles

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AlertWindow />
    </StrictMode>
  );
}
