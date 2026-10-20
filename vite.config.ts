import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// base './' + HashRouter → GitHub Pages 어느 저장소 경로에서도 동작
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // 링크 미리보기(og:image)는 절대 주소가 필요 → 배포 주소 (끝에 / 포함)
  let site = env.VITE_SITE_URL || "https://goodwon89.github.io/leadership-reading/";
  if (!site.endsWith("/")) site += "/";
  return {
    base: "./",
    plugins: [
      react(),
      { name: "site-url", transformIndexHtml: (html: string) => html.replace(/__SITE_URL__/g, site) },
      ...(mode === "single" ? [viteSingleFile()] : []),
    ],
    build: { outDir: mode === "single" ? "dist-single" : mode === "artifact" ? "dist-artifact" : "dist", chunkSizeWarningLimit: 1500 },
  };
});
