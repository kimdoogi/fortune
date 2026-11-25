/**
 * 캐릭터 꾸미기 (F17, D-098). 고를 수 있는 값과 코드 한 줄로 바꾸기.
 * 코드 = `species.hair.outfit.color.acc.hairColor.tone`. 외모 문자열 = `성별:나이대[:코드]`.
 * 서버(zod 검증·저장)와 앱(그리기·토큰 읽기)이 같은 목록을 쓴다.
 */
export const SPECIES = ["human", "cat", "dog", "rabbit", "fox", "bear"] as const;
export const HAIRS = [
  "short",
  "bob",
  "long",
  "braid",
  "bun",
  "pigtails",
  "ponytail",
  "curly",
  "topknot",
  "none",
] as const;
export const OUTFITS = ["jeogori", "chima", "dress", "hoodie", "dopo"] as const;
export const OUTFIT_COLORS = [
  "auto",
  "red",
  "pink",
  "yellow",
  "green",
  "sky",
  "navy",
  "purple",
  "black",
  "white",
] as const;
export const ACCESSORIES = [
  "none",
  "ribbon",
  "flower",
  "gat",
  "binyeo",
  "jokduri",
  "beanie",
] as const;
export const HAIR_COLORS = [
  "auto",
  "black",
  "brown",
  "chestnut",
  "blonde",
  "red",
  "pink",
  "blue",
  "silver",
] as const;
/** 피부(동물은 털) 톤 수: 0 ~ TONES-1 */
export const TONES = 4;

export type Species = (typeof SPECIES)[number];
export type HairStyle = (typeof HAIRS)[number];
export type Outfit = (typeof OUTFITS)[number];
export type OutfitColor = (typeof OUTFIT_COLORS)[number];
export type Accessory = (typeof ACCESSORIES)[number];
export type HairColor = (typeof HAIR_COLORS)[number];

export interface AvatarStyle {
  species: Species;
  hair: HairStyle;
  outfit: Outfit;
  color: OutfitColor;
  acc: Accessory;
  hairColor: HairColor;
  /** 0 ~ 3 */
  tone: number;
}

const has = <T extends string>(list: readonly T[], v: string | undefined): v is T =>
  v !== undefined && (list as readonly string[]).includes(v);

/** 꾸미기 → 코드 한 줄 */
export function encodeStyle(s: AvatarStyle): string {
  return [s.species, s.hair, s.outfit, s.color, s.acc, s.hairColor, String(s.tone)].join(".");
}

/** 코드 → 꾸미기. 칸 수가 다르거나 모르는 값이 하나라도 있으면 null (기본 모습) */
export function parseStyle(code: string | null | undefined): AvatarStyle | null {
  if (!code) return null;
  const [species, hair, outfit, color, acc, hairColor, tone, ...rest] = code.split(".");
  if (rest.length > 0) return null;
  if (
    !has(SPECIES, species) ||
    !has(HAIRS, hair) ||
    !has(OUTFITS, outfit) ||
    !has(OUTFIT_COLORS, color) ||
    !has(ACCESSORIES, acc) ||
    !has(HAIR_COLORS, hairColor) ||
    !tone ||
    !/^\d$/.test(tone) ||
    Number(tone) >= TONES
  )
    return null;
  return { species, hair, outfit, color, acc, hairColor, tone: Number(tone) };
}

/** 외모 문자열 `성별:나이대[:코드]` */
export function avatarString(gender: string, ageBand: string, style: AvatarStyle | null): string {
  return style ? `${gender}:${ageBand}:${encodeStyle(style)}` : `${gender}:${ageBand}`;
}
