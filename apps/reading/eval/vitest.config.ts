import { defineConfig } from "vitest/config";

// 평가는 돈이 드는 호출이라 기본 `pnpm test`에 넣지 않는다. 키가 없으면 샘플 구성 검사만 돈다 (docs/04 §12)
export default defineConfig({ test: { include: ["eval/**/*.test.ts"] } });
