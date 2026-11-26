/// <reference types="vite/client" />

/** package.json version, set by vite.config.ts. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_TARGET?: "desktop" | "web" | "preview";
  readonly VITE_DEMO?: string;
  readonly VITE_API_URL?: string;
}
