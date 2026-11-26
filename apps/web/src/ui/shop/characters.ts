/**
 * 점집 캐릭터 (04a). 이름·대체 문장은 04a 표 그대로, 연출 대사는 미리 써 둔 문장 (LLM 아님, F04).
 */
import type { ShopId } from "@fortune/shared-types";

export interface Character {
  /** 대화 상자 이름표 */
  name: string;
  /** 위쪽 현판 */
  shopName: string;
  /** LLM 실패 대체 문장 (04a) — 서버 문장이 없을 때만 쓴다 */
  fallback: string;
  /** 결과를 기다리는 동안 */
  loading: string;
  /** 결과를 닫고 점 목록으로 돌아왔을 때 */
  again: string;
}

export const CHARACTERS: Record<ShopId, Character> = {
  saju: {
    name: "청운 선생",
    shopName: "사주집",
    fallback: "오늘은 별자리가 구름에 가려 사주가 잘 읽히지 않는구려. 잠시 뒤에 다시 오시오.",
    loading: "흠… 그대가 태어난 날의 여덟 글자를 펼쳐 보는 중이오.",
    again: "또 궁금한 것이 있거든 편히 말씀하시오.",
  },
  tarot: {
    name: "달님 언니",
    shopName: "타로집",
    fallback: "어머, 카드가 오늘은 수줍어하네요. 조금 있다가 다시 펼쳐 볼까요?",
    loading: "카드가 이야기를 고르고 있어요. 잠깐만요…",
    again: "또 궁금한 게 생기면 언제든 카드를 펼쳐 봐요.",
  },
  dolyeong: {
    name: "아기도령",
    shopName: "아기도령",
    fallback: "으앙, 방울 소리가 안 들려! 이따 다시 와!",
    loading: "딸랑딸랑… 할아버지한테 물어보는 중이야!",
    again: "또 뽑고 싶으면 말해! 딸랑!",
  },
  dream: {
    name: "몽실 할매",
    shopName: "꿈해몽",
    fallback: "아이고, 할매가 깜빡 졸았구먼. 이따 다시 얘기해 줘.",
    loading: "차 우러나는 동안 할매가 꿈을 곰곰이 짚어 볼게.",
    again: "또 꿈 꾸면 할매한테 와서 얘기해.",
  },
  // 족집게집 (F19, D-100): 하게체
  jokjipge: {
    name: "족집게 도사",
    shopName: "족집게집",
    fallback: "허허, 돋보기에 김이 서려 잘 안 보이네. 조금 있다 다시 오게.",
    loading: "가만있어 보게… 돋보기로 자네 기운을 하나씩 집어 보는 중이네.",
    again: "더 궁금한 게 있거든 편히 말하게.",
  },
};

/** 점 목록 항목 아래 한 줄 설명 */
export const PRODUCT_BLURB: Record<string, string> = {
  sinjeom: "아기도령이 먼저 맞혀 보는 신점",
  daily: "오늘 하루의 흐름과 작은 행동 하나",
  saju_full: "타고난 여덟 글자와 올해의 흐름",
  gunghap: "두 사람 사주로 보는 궁합",
  tarot_pair: "두 사람의 마음과 앞날을 카드 세 장으로",
  sinjeom_pair: "쌀을 던져 두 사람 사이를 물어봐요",
  dream_pair: "각자 꾼 꿈을 이어서 풀어요",
  tarot_one: "오늘 나에게 오는 카드 한 장",
  tarot_three: "과거 · 현재 · 미래를 잇는 이야기",
  obanggi: "다섯 색 깃발 중 하나를 뽑아요",
  dream: "간밤의 꿈을 할매에게 들려줘요",
  nature: "타고난 기질로 콕 집어 맞히는 내 성격",
};
