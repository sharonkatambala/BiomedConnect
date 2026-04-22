import { defineConfig } from "vite";

export default defineConfig({
  preview: {
    open: true
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    open: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true
      }
    }
  },
  build: {
    target: "es2020",
    cssMinify: true,
    minify: "esbuild",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@supabase")) {
            return "supabase";
          }
        }
      }
    }
  }
});
