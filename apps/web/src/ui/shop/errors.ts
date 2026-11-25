/**
 * 점집 안 오류를 캐릭터 대화로 바꾼다 (04 §9, F05~F08 예외 상황). 오류 코드는 화면에 보이지 않는다.
 */
import { fillTemplate, greetings } from "@fortune/prompts";
import type { ShopId } from "@fortune/shared-types";
import { ApiFailure } from "../../api/client";
import { CHARACTERS } from "./characters";

export interface FailView {
  /** 대화 상자에 보일 문장 */
  line: string;
  /** "다시 해 보기"를 보여 줄지 (새 requestId로 다시) */
  retry: boolean;
  /** 위기 안내 화면으로 (04a) */
  crisis?: boolean;
}

const pick = <T>(xs: readonly T[], r = Math.random()): T | undefined =>
  xs[Math.floor(r * xs.length)];

export function describeFailure(
  shop: ShopId,
  err: unknown,
  nickname: string,
  r = Math.random(),
): FailView {
  const c = CHARACTERS[shop];
  if (!(err instanceof ApiFailure)) return { line: c.fallback, retry: true };
  const msg = err.message?.trim();
  switch (err.code) {
    case "CRISIS":
      return { line: "", retry: false, crisis: true };
    case "DAILY_LIMIT": {
      // 서버 문장이 캐릭터 말투다. 없으면 미리 써 둔 문장
      const own = pick(greetings[shop].dailyLimit, r);
      return { line: msg || fillTemplate(own ?? c.fallback, nickname), retry: false };
    }
    case "LLM_UNAVAILABLE":
      return { line: msg || c.fallback, retry: true };
    case "PROFILE_REQUIRED":
      return {
        line: "먼저 내 정보를 알려 주세요. 태어난 날을 알아야 점을 볼 수 있어요.",
        retry: false,
      };
    case "UNAUTHORIZED":
      return { line: "잠시 연결이 끊겼어요. 처음 화면에서 다시 들어와 주세요.", retry: false };
    case "NETWORK":
      return { line: "인터넷 연결이 잠시 끊겼어요. 연결을 확인하고 다시 해 봐요.", retry: true };
    case "RATE_LIMITED":
      return { line: msg || "너무 빨리 눌렀어요. 숨 한 번 고르고 다시 해 봐요.", retry: true };
    case "NOT_FOUND":
      return { line: msg || "그 풀이를 찾지 못했어요.", retry: false };
    default:
      return { line: msg || c.fallback, retry: true };
  }
}
