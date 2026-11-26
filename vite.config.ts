import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const host = process.env.TAURI_DEV_HOST;
/** One version for the app, the installer and the footer: package.json (keep src-tauri/tauri.conf.json and Cargo.toml in step). */
const version: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

/** Production: src/api/mock(.ts) and its data resolve to an empty module (the code path is off anyway, see DEMO_ALLOWED). */
function noDemo(): Plugin {
  const EMPTY = "\0helpdesk-no-demo";
  return {
    name: "helpdesk-no-demo",
    enforce: "pre",
    resolveId(id) {
      return /(^|[\\/])(api[\\/])?mock$/.test(id) || id === "@/api/mock" ? EMPTY : null;
    },
    load(id) {
      return id === EMPTY ? "export {};" : null;
    },
  };
}

// mode "web" / "web-demo" = the staff web app (dist-web); the default mode is the Tauri (employee) app.
export default defineConfig(({ mode, command }) => {
  const web = mode.startsWith("web");
  // Demo data only for `vite` (dev), web-demo and the preview build: production builds don't ship it.
  const demo = command === "serve" || mode === "web-demo" || mode === "preview";
  return {
  plugins: [react(), tailwindcss(), ...(demo ? [] : [noDemo()])],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  clearScreen: false,
  server: {
    port: web ? 1430 : 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
    // npm run dev:web → /api goes to your FastAPI (same origin, no CORS). Other port: HELPDESK_API=http://host:port
    proxy: web ? { "/api": { target: process.env.HELPDESK_API ?? "http://localhost:8000", changeOrigin: true } } : undefined,
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    outDir: web ? "dist-web" : "dist",
    target: "es2022",
    minify: !process.env.TAURI_ENV_DEBUG ? "oxc" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  };
});
