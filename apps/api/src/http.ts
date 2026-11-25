/** 응답·오류 형식 (docs/09 §3) */
import type { ApiError, ErrorCode } from "@fortune/shared-types";
import type { z } from "zod";

/** docs/09 §3 표의 HTTP 상태 */
export const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  PROFILE_REQUIRED: 409,
  INVALID_INPUT: 400,
  INVALID_DATE: 400,
  OUT_OF_RANGE: 400,
  NO_SUCH_LEAP_MONTH: 400,
  NONEXISTENT_TIME: 400,
  UNDER_14: 403,
  ACCOUNT_LIMIT: 429,
  DAILY_LIMIT: 429,
  RATE_LIMITED: 429,
  BLOCKED_CONTENT: 422,
  CRISIS: 422,
  LLM_UNAVAILABLE: 503,
  NOT_FOUND: 404,
};

/** 모듈 안에서 던지면 라우터가 오류 응답으로 바꾼다 */
export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number = STATUS[code],
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json; charset=utf-8");
  h.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function fail(code: ErrorCode, message: string, status = STATUS[code]): Response {
  return json({ error: { code, message } } satisfies ApiError, status);
}

export function noContent(headers?: HeadersInit): Response {
  return new Response(null, { status: 204, headers });
}

/** 본문 JSON을 읽고 zod로 검사한다. 실패하면 INVALID_INPUT (docs/09 §3) */
export async function readBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const raw = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError("INVALID_INPUT", "입력 형식이 올바르지 않아요");
  return parsed.data;
}
