import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative so the build works from any URL
// subpath (needed for the GitHub Pages deploy at /<repo>/<game>/).
export default defineConfig({
  plugins: [react()],
  base: "./",
});
