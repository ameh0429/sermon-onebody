import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [],
      manifest: {
        name: "OneBody — Grow in the Word",
        short_name: "OneBody",
        description: "Sermons, daily study, and a little growth every day.",
        theme_color: "#3e285b",
        background_color: "#faf8fb",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "https://res.cloudinary.com/dxpopimi3/image/upload/c_pad,w_192,h_192,b_transparent/v1793571514/onebody-logo-removebg-preview_k4vg3x.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "https://res.cloudinary.com/dxpopimi3/image/upload/c_pad,w_512,h_512,b_white/v1793571514/onebody-logo-removebg-preview_k4vg3x.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/docs(?:\/|\.|$)/],
        // Authenticated API responses and media are deliberately not cached.
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});
