/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Las pruebas de navegación renderizan la app completa: la primera carga en frío (CI, caché vacía) supera los 5 s
  // por defecto sin que haya un fallo real.
  test: { testTimeout: 20_000 },
});
