/** API·LLM 입출력 타입. web·api·reading이 같이 쓴다 (docs/13 §3) */

export type ShopId = "saju" | "tarot" | "dolyeong" | "dream";
export type ProductId = "daily" | "saju_full" | "tarot_one" | "tarot_three" | "obanggi" | "dream";

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
  user: { nickname: string; gender: "male" | "female"; ageBand: string };
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

/** reading Worker RPC (docs/15 §6) */
export interface ReadingService {
  interpret(input: InterpretInput): Promise<InterpretOutput>;
}

/** 멀티플레이 메시지 (docs/15 §4) */
export type ClientMessage =
  | { t: "move"; x: number; z: number }
  | { t: "emote"; id: string }
  | { t: "chat"; id: string }
  | { t: "enter_shop"; shop: ShopId }
  | { t: "exit_shop"; shop: ShopId };

export interface PlayerState {
  id: string;
  nickname: string;
  avatar: string;
  x: number;
  z: number;
  inside: boolean;
}

export type ServerMessage =
  | { t: "snapshot"; you: string; players: PlayerState[] }
  | { t: "joined"; player: PlayerState }
  | { t: "left"; id: string }
  | { t: "moved"; id: string; x: number; z: number }
  | { t: "emoted"; id: string; emote: string }
  | { t: "chatted"; id: string; line: string }
  | { t: "hidden"; id: string }
  | { t: "shown"; id: string };
export { type WsTokenPayload, signWsToken, verifyWsToken } from "./wsToken";
