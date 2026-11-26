/** API·LLM 입출력 타입. web·api·reading이 같이 쓴다 (docs/13 §3) */

export type ShopId = "saju" | "tarot" | "dolyeong" | "dream";
/** 같이 보기에서 둘이 갈 수 있는 곳: 점집, 당산나무(F18), 지도 */
export type PairPlace = ShopId | "tree" | "map";
export type ProductId =
  | "daily"
  | "saju_full"
  | "tarot_one"
  | "tarot_three"
  /** 오방기 뽑기. 점 목록에서 뺐다 (D-073), 예전 결과만 */
  | "obanggi"
  /** 아기도령 신점 대화 (F07, D-073) */
  | "sinjeom"
  /** 같이 보기 (F16): 궁합 D-089, 관계 타로·둘의 신점·두 사람 꿈풀이 D-090 */
  | "gunghap"
  | "tarot_pair"
  | "sinjeom_pair"
  | "dream_pair"
  | "dream";

/** 오류 응답 (docs/09 §3) */
export type ErrorCode =
  | "UNAUTHORIZED"
  | "PROFILE_REQUIRED"
  | "INVALID_INPUT"
  | "INVALID_DATE"
  | "OUT_OF_RANGE"
  | "NO_SUCH_LEAP_MONTH"
  | "NONEXISTENT_TIME"
  | "UNDER_14"
  | "ACCOUNT_LIMIT"
  | "DAILY_LIMIT"
  | "RATE_LIMITED"
  | "BLOCKED_CONTENT"
  | "CRISIS"
  | "LLM_UNAVAILABLE"
  | "NOT_FOUND";

export interface ApiError {
  error: { code: ErrorCode; message: string };
}

/** LLM 해석 입력 (docs/04 §3). chart·cards 등 점집별 필드는 M2에서 채운다 */
export interface InterpretInput {
  shop: ShopId;
  product: ProductId;
  today: string;
  user: {
    nickname: string;
    gender: "male" | "female";
    ageBand: string;
    /** 반말 호칭 (받침에 맞춘 아/야, 예: "하나야", "민준아"). 코드가 만든다 */
    vocative?: string;
  };
  facts: string[];
  question: string | null;
  [shopSpecific: string]: unknown;
}

/** LLM 해석 출력 (docs/04 §5) */
export interface InterpretOutput {
  greeting: string;
  summary: string;
  sections: Record<string, string>;
  advice: string;
  luckyColor?: string;
}

/** 해석 결과. 실패하면 점집 말투의 대체 문장(docs/04a)을 돌려주고 저장하지 않는다 (docs/04 §9) */
export type InterpretResult =
  | { ok: true; output: InterpretOutput; promptVersion: string }
  | {
      ok: false;
      reason: "refusal" | "timeout" | "api_error" | "invalid_output" | "banned" | "truncated";
      fallback: string;
      promptVersion: string;
    };

/** 분류 호출 (docs/04 §6). 꿈해몽은 symbolIds 안에서만 고른다 */
export interface ClassifyInput {
  kind: "dream" | "question";
  text: string;
  /** 꿈 사전 상징 ID 목록 (kind = dream일 때) */
  symbolIds?: string[];
}

export type ClassifyRisk =
  | "none"
  | "self_harm"
  | "medical"
  | "legal"
  | "investment"
  | "sexual"
  | "violence"
  | "other";

export type ClassifyResult =
  | {
      ok: true;
      category: "연애" | "재물" | "직장" | "건강" | "가족" | "기타";
      risk: ClassifyRisk;
      symbols: string[];
    }
  | { ok: false; reason: "refusal" | "timeout" | "api_error" | "invalid_output" };

/**
 * 이어 묻기 입력 (F15, docs/04 §13). 캐시가 타도록 저장된 JSON 문자열을 그대로 넘긴다
 * (다시 직렬화하면 키 순서가 바뀔 수 있다).
 */
export interface FollowupInput {
  shop: ShopId;
  /** 신점(sinjeom)은 아기도령 대화 지시를 쓴다 (F07) */
  product: ProductId;
  /** 원래 풀이 입력 (readings.input_json 그대로) */
  originalInput: string;
  /** 원래 풀이 출력 (readings.output_json 그대로) */
  originalOutput: string;
  /** 앞선 문답. answerJson은 저장된 출력 문자열 그대로. asker는 같이 본 풀이에서 물은 사람 (D-091) */
  history: { question: string; answerJson: string; asker?: string }[];
  question: string;
  /** 같이 본 풀이(F16)에서 이번에 묻는 사람 닉네임 (D-091) */
  asker?: string;
}

export type FollowupResult =
  | {
      ok: true;
      risk: ClassifyRisk;
      /** 위험·차단(self_harm, sexual, violence, other)이면 빈 문자열 */
      answer: string;
      /** 다음 이어 묻기에 그대로 다시 보낼 출력 문자열 */
      answerJson: string;
      promptVersion: string;
    }
  | {
      ok: false;
      reason: "refusal" | "timeout" | "api_error" | "invalid_output" | "banned" | "truncated";
      fallback: string;
      promptVersion: string;
    };

/** reading Worker RPC (docs/15 §6) */
export interface ReadingService {
  interpret(input: InterpretInput): Promise<InterpretResult>;
  classify(input: ClassifyInput): Promise<ClassifyResult>;
  followup(input: FollowupInput): Promise<FollowupResult>;
}

/** 멀티플레이 메시지 (docs/15 §4) */
export type ClientMessage =
  | { t: "move"; x: number; z: number }
  | { t: "emote"; id: string }
  | { t: "chat"; id: string }
  | { t: "enter_shop"; shop: ShopId }
  | { t: "exit_shop"; shop: ShopId }
  /** 같이 보기 둘만의 방 (F16): 같이 들어가기, 방장의 장소 이동(점집 또는 지도) */
  | { t: "go_inside" }
  | { t: "pick"; relation: string }
  | { t: "travel"; place: PairPlace };

export interface PlayerState {
  id: string;
  nickname: string;
  /** "성별:나이대[:꾸미기 코드]" (예: "female:20대", F17). 상대 캐릭터를 그린다 */
  avatar: string;
  x: number;
  z: number;
  inside: boolean;
}

export type ServerMessage =
  | {
      t: "snapshot";
      you: string;
      players: PlayerState[];
      /** 같이 보기: 방장이 마지막으로 간 곳 (D-090) */
      place?: PairPlace;
    }
  | { t: "joined"; player: PlayerState }
  | { t: "left"; id: string }
  | { t: "moved"; id: string; x: number; z: number }
  | { t: "emoted"; id: string; emote: string }
  | { t: "chatted"; id: string; line: string }
  | { t: "hidden"; id: string }
  | { t: "shown"; id: string }
  /** 같이 보기 둘만의 방 (F16) */
  | { t: "went_inside"; id: string }
  | { t: "traveled"; place: PairPlace }
  | { t: "picked"; id: string; relation: string; product?: ProductId }
  | { t: "submitted"; id: string; product: ProductId }
  | { t: "result_ready"; product?: ProductId }
  | { t: "result_failed"; message: string; product?: ProductId }
  /** 같이 본 풀이의 이어 묻기 (D-091): 묻는 중 / 답이 나왔다(ok) 또는 실패 */
  | { t: "asking"; id: string; product: ProductId }
  | { t: "asked"; id: string; product: ProductId; ok: boolean }
  /** 당산나무 (F18): 같이 묶은 소원이 걸렸다 */
  | { t: "wished"; id: string; wish: WishView };
export { type WsTokenPayload, signWsToken, verifyWsToken } from "./wsToken";
export * from "./api";
export * from "./avatar";
export * from "./wish";
import type { WishView } from "./wish";
