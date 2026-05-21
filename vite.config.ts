// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";

const isVercel = process.env.VERCEL === "1";
const nitroSsrRenderer = fileURLToPath(
  new URL("./node_modules/nitro/dist/runtime/internal/vite/ssr-renderer.mjs", import.meta.url),
);

export default defineConfig({
  cloudflare: isVercel ? false : undefined,
  plugins: isVercel
    ? [nitro({ preset: "vercel", renderer: { handler: nitroSsrRenderer } })]
    : [],
});
