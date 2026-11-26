/** 코드가 직접 보여주는 캐릭터 문장 (docs/04a 대체 템플릿·위기 안내, F05~F08) */
import type { CheckBlockReason, ShopId } from "@fortune/shared-types";

/** LLM 실패 대체 문장 (docs/04a 대체 템플릿) */
export const FALLBACK: Record<ShopId, string> = {
  saju: "오늘은 별자리가 구름에 가려 사주가 잘 읽히지 않는구려. 잠시 뒤에 다시 오시오.",
  tarot: "어머, 카드가 오늘은 수줍어하네요. 조금 있다가 다시 펼쳐 볼까요?",
  dolyeong: "으앙, 방울 소리가 안 들려! 이따 다시 와!",
  dream: "아이고, 할매가 깜빡 졸았구먼. 이따 다시 얘기해 줘.",
  jokjipge: "허허, 돋보기에 김이 서려 잘 안 보이네. 조금 있다 다시 오게.",
};

/** 하루 30회 상한 안내 (docs/04 §10). 사주는 F05, 타로는 F06 문장 */
export const DAILY_LIMIT_TEXT: Record<ShopId, string> = {
  saju: "오늘은 점을 많이 봤소. 내일 다시 오시오.",
  tarot: "오늘은 카드가 쉬고 싶대요. 내일 또 봐요.",
  dolyeong: "오늘은 방울이 지쳤어! 내일 또 와!",
  dream: "아이고, 오늘은 꿈 얘기를 많이 들었구먼. 내일 또 와.",
  jokjipge: "오늘은 돋보기가 뜨거워졌네. 내일 다시 오게.",
};

/** 위기 안내 (docs/04a 위기 안내). LLM을 거치지 않는다 */
export const CRISIS_TEXT = [
  "지금 많이 힘드신 것 같아요. 혼자 견디지 않으셔도 괜찮아요.",
  "자살예방상담전화 109 (24시간, 무료)에 전화하면 이야기를 들어 줄 사람이 있어요.",
  "위급한 상황이라면 112 또는 119에 바로 연락해 주세요.",
].join("\n");

/** 꿈 검사 안내 (F08, 몽실 할매 말투) */
export const DREAM_CHECK_TEXT: Record<CheckBlockReason, string> = {
  EMPTY: "아가, 꿈 얘기를 한 줄이라도 써 줘.",
  TOO_LONG: "아이고, 꿈 얘기가 너무 길구먼. 300자 안으로 줄여서 들려줘.",
  PII: "아가, 전화번호 같은 건 빼고 써 줘.",
  BANNED: "그런 말은 빼고 꿈 얘기만 들려줘.",
  BLOCKED: "그 얘기는 할매가 풀어 줄 수가 없구먼. 다른 꿈 얘기를 들려줘.",
  NO_SYMBOLS: "아가, 꿈을 조금 더 자세히 얘기해 줘.",
  CRISIS: CRISIS_TEXT,
};

/** 꿈 검사 결과가 없거나 10분이 지났을 때 (F08) */
export const DREAM_CHECK_EXPIRED = "아가, 꿈 얘기를 들은 지 좀 됐구먼. 다시 한 번 들려줘.";

/** 같은 requestId가 아직 처리 중일 때 */
export const IN_FLIGHT_TEXT = "앞선 요청을 처리하고 있어요. 잠시만 기다려 주세요.";
