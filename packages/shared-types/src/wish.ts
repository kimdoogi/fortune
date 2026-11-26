/** 당산나무 소원 (F18, D-099) */
import type { FlagColor } from "./api";

/** 천 색 = 오방색 (깃발 색과 같다) */
export type WishColor = FlagColor;

export const WISH_COLORS: readonly WishColor[] = ["빨강", "노랑", "파랑", "하양", "초록"];

/** 색마다 뜻 */
export const WISH_COLOR_MEANING: Record<WishColor, string> = {
  빨강: "사랑·인연",
  노랑: "돈·복",
  파랑: "일·시작",
  하양: "건강·평안",
  초록: "배움·성장",
};

/** 천 색 (화면·3D 공통) */
export const WISH_COLOR_HEX: Record<WishColor, string> = {
  빨강: "#e0473a",
  노랑: "#f2c94c",
  파랑: "#3f7fd9",
  하양: "#f4f1ea",
  초록: "#4caf6a",
};

export const WISH_MAX = 40;
/** 묶은 지 이만큼 지나면 돌아보기를 묻는다 */
export const WISH_REVIEW_DAYS = 30;

export interface WishView {
  id: string;
  text: string;
  color: WishColor;
  /** 한국 날짜 */
  day: string;
  createdAt: string;
  /** 같이 묶은 사람 닉네임 (같이 보기) */
  withNickname: string | null;
  /** 묶은 사람 닉네임 (내가 묶었으면 null) */
  byNickname: string | null;
  outcome: "yes" | "no" | null;
}

/** 나무에 걸 천 하나 (글은 없다) */
export interface WishCloth {
  color: WishColor;
  mine: boolean;
  gold: boolean;
}

/** GET /api/wishes */
export interface WishBoard {
  today: { wish: WishView | null; stoned: boolean };
  /** 오늘 모든 사람이 올린 돌 수 */
  stonesToday: number;
  /** 오늘 걸린 소원 수 */
  wishesToday: number;
  cloths: WishCloth[];
  mine: WishView[];
  /** 30일이 지나 돌아볼 소원 (가장 오래된 것 하나) */
  due: WishView | null;
}

/** POST /api/wishes */
export interface WishRequest {
  text: string;
  color: WishColor;
  requestId: string;
  /** 같이 보기 방에서 같이 묶기 */
  pairCode?: string;
}

export type WishResponse =
  | { ok: true; wish: WishView; blessing: string; board: WishBoard }
  | {
      ok: false;
      reason: "EMPTY" | "TOO_LONG" | "PII" | "BANNED" | "CRISIS" | "DONE";
      message: string;
    };
