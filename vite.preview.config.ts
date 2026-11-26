// Builds a single self-contained HTML file of both apps in demo mode (for sharing a browser preview).
import { defineConfig, mergeConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import base from "./vite.config.ts";

export default defineConfig((env) =>
  mergeConfig(base({ ...env, mode: "preview" }), {
    plugins: [viteSingleFile()],
    build: { outDir: "dist-preview", assetsInlineLimit: 100_000_000 },
  }),
);
