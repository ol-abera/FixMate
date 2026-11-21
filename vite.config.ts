import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import checker from "vite-plugin-checker";

import dns from "node:dns";

dns.setDefaultResultOrder("verbatim");

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    checker({
      typescript: true,
    }),
  ],
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
  },
  preview: {
    port: 3000,
    host: true,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks so app deploys don't bust the framework cache.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
