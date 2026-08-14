import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Standard (non-Lovable) TanStack Start config, targeting plain Node so it
// runs on Render (or any Node host) instead of Cloudflare Workers.
export default defineConfig(async ({ command }) => {
  const plugins = [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
    viteReact(),
  ];

  // nitro only runs at build time; it packages the SSR server output.
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(
      nitro({
        preset: "node-server",
      }),
    );
  }

  return {
    plugins,
    server: {
      host: true,
    },
  };
});
