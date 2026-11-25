/**
 * 결과 고정 seed와 서버 난수 (docs/03 공통 결과 고정 규칙, F05~F08).
 * 난수는 sha256(userId + seed_key)로 시작하는 결정적 PRNG라 같은 조건이면 같은 카드·깃발이 나온다.
 */
import type { FlagColor, TarotCategory } from "@fortune/shared-types";
import { sha256, sha256Hex } from "./crypto";

// ── seed_key (readings.seed_key) ─────────────────────────
/** v2: 월별 운세를 넣으며 예전 저장본 대신 새로 푼다 (D-079) */
export const sajuSeedKey = (profileVersion: number, year: number) =>
  `saju:v2:${profileVersion}:${year}`;
export const tarotSeedKey = (date: string, product: string, category: TarotCategory) =>
  `tarot:${date}:${product}:${category}`;
export const obanggiSeedKey = (date: string, category: string) => `obanggi:${date}:${category}`;
/** 아기도령 신점: 하루 한 번 (F07) */
export const sinjeomSeedKey = (date: string) => `sinjeom:${date}`;

/** 꿈 내용 정규화: 앞뒤 공백 제거, 문장부호·기호 제거, 공백 하나로 (docs/03 꿈해몽) */
export function normalizeDream(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function dreamSeedKey(date: string, text: string): Promise<string> {
  return `dream:${date}:${await sha256Hex(normalizeDream(text))}`;
}

// ── PRNG ─────────────────────────────────────────────────
export type Rng = () => number;

/** sfc32: 128비트 상태. [0, 1) 실수를 돌려준다 */
export function sfc32(bytes: Uint8Array): Rng {
  if (bytes.length < 16) throw new Error("seed needs 16 bytes");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let a = dv.getUint32(0);
  let b = dv.getUint32(4);
  let c = dv.getUint32(8);
  let d = dv.getUint32(12);
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  // 시작 상태를 충분히 섞는다
  for (let i = 0; i < 12; i++) next();
  return next;
}

/** 사용자 + seed_key로 만든 PRNG (서버에서만, docs/03) */
export async function rngFor(userId: string, seedKey: string): Promise<Rng> {
  return sfc32(await sha256(`${userId}\n${seedKey}`));
}

// ── 타로 (F06, D-053) ────────────────────────────────────
export const MAJOR_ARCANA = 22;
export const REVERSED_RATE = 0.25;
export const TAROT_POSITIONS = { one: ["오늘"], three: ["과거", "현재", "미래"] } as const;

export interface DrawnCard {
  position: string;
  id: number;
  reversed: boolean;
}

/** 22장을 섞고 위에서부터 뽑는다. 섞기 → 정·역방향 순으로 난수를 쓴다 */
export function drawTarot(rng: Rng, spread: "one" | "three"): DrawnCard[] {
  const deck = Array.from({ length: MAJOR_ARCANA }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j] as number, deck[i] as number];
  }
  return TAROT_POSITIONS[spread].map((position, k) => ({
    position,
    id: deck[k] as number,
    reversed: rng() < REVERSED_RATE,
  }));
}

// ── 오방기 (F07, D-031) ──────────────────────────────────
/** 순서를 바꾸면 이미 정해진 결과가 바뀐다. 고정한다 */
export const FLAG_COLORS: readonly FlagColor[] = ["빨강", "노랑", "파랑", "하양", "초록"];

export function pickFlag(rng: Rng): FlagColor {
  return FLAG_COLORS[Math.floor(rng() * FLAG_COLORS.length)] as FlagColor;
}
