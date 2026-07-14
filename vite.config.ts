/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 로컬 개발용 API 프록시 타깃.
// - 기본: `vercel dev` 가 띄운 서버리스 함수(포트 3000)
// - 또는 배포된 URL (예: VITE_API_PROXY=https://<프로젝트>.vercel.app)
// 이렇게 하면 프론트는 `npm run dev`(Vite, SPA 라우팅 네이티브 처리)로 띄우고
// /api 요청만 함수 런타임으로 전달되어, vercel dev + Vite rewrite 충돌을 피한다.
const apiProxyTarget = process.env.VITE_API_PROXY || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
