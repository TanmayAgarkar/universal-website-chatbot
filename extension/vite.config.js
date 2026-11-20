
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: "oxc",

    lib: {
      entry: "src/content/contentScript.jsx",
      name: "WebMindContent",
      formats: ["iife"],
      fileName: () => "content.js"
    }
  }
});
