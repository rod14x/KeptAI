import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./context/ThemeContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* reducedMotion="user": si el sistema pide menos movimiento, motion omite transforms y deja solo opacidad. */}
    <MotionConfig reducedMotion="user">
      <ThemeProvider><App /></ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
