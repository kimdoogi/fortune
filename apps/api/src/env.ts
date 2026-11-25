import type { ReadingService } from "@fortune/shared-types";

/** app Worker 바인딩 (apps/api/wrangler.jsonc, docs/15 §2) */
export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  KV: KVNamespace;
  /** reading Worker RPC (docs/15 §6) */
  READING: Fetcher & ReadingService;
  VILLAGE: DurableObjectNamespace;
  WS_TOKEN_KEY: string;
  /** 생년월일 암호화 키. base64 32바이트 (docs/15 §8) */
  PII_KEY: string;
  /** 없으면 Turnstile 검사를 건너뛴다 (F14, 위젯을 아직 만들지 않음) */
  TURNSTILE_SECRET?: string;
}
