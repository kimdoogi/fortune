/**
 * 캐릭터 꾸미기 파츠의 이름·색·기본 값 (F17, D-098, 05 §3).
 * three.js를 쓰지 않는다: 꾸미기 화면(UI)이 색 칩을 그릴 때도 이 파일만 받는다.
 */
import {
  type Accessory,
  type AgeBand,
  type AvatarStyle,
  type Gender,
  type HairColor,
  type HairStyle,
  type Outfit,
  type OutfitColor,
  type Species,
  parseStyle,
} from "@fortune/shared-types";

/** 성별·나이대 기본 팔레트 (05 §2, 08 §1) */
export interface Palette {
  /** 남성: 저고리 / 여성: 원피스 소매 안쪽 (쓰지 않음) */
  top: string;
  /** 남성: 바지 / 여성: 원피스 (D-086) */
  bottom: string;
  hair: string;
  /** 남성: 고름 / 여성: 목 리본 */
  accent: string;
  shoe: string;
  /** 여성 다리 (살색 또는 스타킹) */
  leg?: string;
}

export const PALETTE: Record<Gender, Record<AgeBand, Palette>> = {
  // 여성은 모든 나이대가 통 원피스 (D-086·D-087): bottom = 원피스, accent = 목 리본
  female: {
    "10대": {
      top: "#ff9db8",
      bottom: "#ff8fb0",
      hair: "#3a2418",
      accent: "#d9413a",
      shoe: "#d9413a",
      leg: "#ffdcc2",
    },
    "20대": {
      top: "#a58cf0",
      bottom: "#9d86ea",
      hair: "#2b1b14",
      accent: "#5a3fb9",
      shoe: "#3a2b22",
      leg: "#ffdcc2",
    },
    "30대": {
      top: "#2f6f8f",
      bottom: "#2f6a8a",
      hair: "#2b1b14",
      accent: "#e0b85a",
      shoe: "#2a2a33",
      leg: "#f0c8aa",
    },
    "40대 이상": {
      top: "#8a3f5a",
      bottom: "#8a3f5a",
      hair: "#5a4a42",
      accent: "#f2d38a",
      shoe: "#5a3a2a",
      leg: "#f0c8aa",
    },
  },
  male: {
    "10대": {
      top: "#cdeeff",
      bottom: "#3e6fb0",
      hair: "#2b1b14",
      accent: "#3e6fb0",
      shoe: "#3a2b22",
    },
    "20대": {
      top: "#e3f3dc",
      bottom: "#3f6b4f",
      hair: "#1f1410",
      accent: "#2f5a43",
      shoe: "#3a2b22",
    },
    "30대": {
      top: "#eef0f2",
      bottom: "#4a5260",
      hair: "#1f1410",
      accent: "#4a5260",
      shoe: "#2b2420",
    },
    "40대 이상": {
      top: "#efe2cc",
      bottom: "#5a4030",
      hair: "#6c5f58",
      accent: "#8a5a3b",
      shoe: "#2b2420",
    },
  },
};

/** 옷 색 묶음: 주색(바지·치마·원피스), 옅은 색(저고리·도포), 포인트(고름·리본·털모자) */
export interface Swatch {
  main: string;
  sub: string;
  accent: string;
}

export const SWATCH: Record<Exclude<OutfitColor, "auto">, Swatch> = {
  red: { main: "#d9413a", sub: "#ffd9d2", accent: "#f2c14e" },
  pink: { main: "#ff8fb0", sub: "#ffe1ea", accent: "#d9413a" },
  yellow: { main: "#f2c14e", sub: "#fff3c8", accent: "#c0533a" },
  green: { main: "#3f8a5f", sub: "#e3f3dc", accent: "#2f5a43" },
  sky: { main: "#6fb6e8", sub: "#e3f3ff", accent: "#2f5f9a" },
  navy: { main: "#2f3f73", sub: "#dfe6f5", accent: "#e0b85a" },
  purple: { main: "#8a6fe0", sub: "#ece6ff", accent: "#5a3fb9" },
  black: { main: "#2c2a30", sub: "#d9d6de", accent: "#c9a24a" },
  white: { main: "#f3efe6", sub: "#ffffff", accent: "#c0533a" },
};

export const HAIR_HEX: Record<Exclude<HairColor, "auto">, string> = {
  black: "#1f1410",
  brown: "#3a2418",
  chestnut: "#7a4a2a",
  blonde: "#e8c46a",
  red: "#b8452f",
  pink: "#f29bb5",
  blue: "#4f7fd0",
  silver: "#c9c6cf",
};

/** 사람 피부 4톤 */
export const SKIN_HEX = ["#ffdcc2", "#f3c4a0", "#d9a27c", "#a8714e"] as const;

/** 동물 털 4색 (종족마다). 밤 장면에서 눈이 묻히지 않게 아주 어두운 색은 뺀다 */
export const FUR_HEX: Record<Exclude<Species, "human">, readonly string[]> = {
  cat: ["#f6e3c6", "#f2a65a", "#b9b4bf", "#6e6470"],
  dog: ["#e9c49a", "#fbf3e6", "#b07a4f", "#7a6252"],
  rabbit: ["#fffaf4", "#f3dccd", "#cfc3ba", "#9a8a80"],
  fox: ["#f08a3c", "#f7e6cc", "#c9622f", "#8f8c94"],
  bear: ["#b07d52", "#f6f1e8", "#6b4a35", "#e2c08e"],
};

export const SPECIES_LABEL: Record<Species, string> = {
  human: "사람",
  cat: "고양이",
  dog: "강아지",
  rabbit: "토끼",
  fox: "여우",
  bear: "곰",
};
export const HAIR_LABEL: Record<HairStyle, string> = {
  short: "짧은머리",
  bob: "단발",
  long: "긴머리",
  braid: "댕기머리",
  bun: "쪽머리",
  pigtails: "양갈래",
  ponytail: "묶은머리",
  curly: "뽀글머리",
  topknot: "상투",
  none: "없음",
};
export const OUTFIT_LABEL: Record<Outfit, string> = {
  jeogori: "저고리·바지",
  chima: "치마저고리",
  dress: "원피스",
  hoodie: "후드티",
  dopo: "도포",
};
export const COLOR_LABEL: Record<OutfitColor, string> = {
  auto: "기본",
  red: "빨강",
  pink: "분홍",
  yellow: "노랑",
  green: "초록",
  sky: "하늘",
  navy: "남색",
  purple: "보라",
  black: "검정",
  white: "흰색",
};
export const ACC_LABEL: Record<Accessory, string> = {
  none: "없음",
  ribbon: "리본",
  flower: "꽃",
  gat: "갓",
  binyeo: "비녀",
  jokduri: "족두리",
  beanie: "털모자",
};
export const HAIR_COLOR_LABEL: Record<HairColor, string> = {
  auto: "기본",
  black: "검정",
  brown: "갈색",
  chestnut: "밤색",
  blonde: "금발",
  red: "빨강",
  pink: "분홍",
  blue: "파랑",
  silver: "은발",
};

/**
 * 꾸미기를 안 한 사람의 모습 (F17 기본 모습 표). 이 값으로 그리면 꾸미기 전과 똑같다.
 * 꾸미기 화면도 이 값에서 시작한다
 */
export function defaultStyle(gender: Gender, ageBand: AgeBand): AvatarStyle {
  const female = gender === "female";
  const hair: HairStyle = female
    ? ageBand === "10대"
      ? "braid"
      : ageBand === "20대"
        ? "long"
        : "bun"
    : "short";
  const acc: Accessory = female
    ? ageBand === "40대 이상"
      ? "binyeo"
      : "none"
    : ageBand === "30대" || ageBand === "40대 이상"
      ? "gat"
      : "none";
  return {
    species: "human",
    hair,
    outfit: female ? "dress" : "jeogori",
    color: "auto",
    acc,
    hairColor: "auto",
    tone: 0,
  };
}

/** 그릴 색 (꾸미기 + 성별·나이대 팔레트) */
export interface Colors {
  main: string;
  sub: string;
  accent: string;
  hair: string;
  /** 얼굴·손 (동물은 털) */
  skin: string;
  shoe: string;
  /** 원피스 아래 다리 */
  leg: string;
}

export function colorsOf(s: AvatarStyle, gender: Gender, ageBand: AgeBand): Colors {
  const pal = PALETTE[gender][ageBand];
  const sw: Swatch =
    s.color === "auto" ? { main: pal.bottom, sub: pal.top, accent: pal.accent } : SWATCH[s.color];
  const tone = Math.max(0, Math.min(3, Math.floor(s.tone)));
  const skin =
    s.species === "human" ? (SKIN_HEX[tone] ?? SKIN_HEX[0]) : (FUR_HEX[s.species][tone] ?? "#fff");
  return {
    ...sw,
    hair: s.hairColor === "auto" ? pal.hair : HAIR_HEX[s.hairColor],
    skin,
    shoe: s.color === "auto" ? pal.shoe : "#3a2b22",
    // 기본 색·기본 피부의 원피스는 나이대 스타킹 색 그대로 (꾸미기 전과 같게)
    leg: s.color === "auto" && s.species === "human" && tone === 0 ? (pal.leg ?? skin) : skin,
  };
}

/** 외모 문자열 `성별:나이대[:코드]` → 캐릭터 외모. 모르면 20대 여성 기본 모습 (F16·F17) */
export function parseAvatar(avatar: string): {
  gender: Gender;
  ageBand: AgeBand;
  style: AvatarStyle | null;
} {
  const [g, a, code] = avatar.split(":");
  const AGES: AgeBand[] = ["10대", "20대", "30대", "40대 이상"];
  return {
    gender: g === "male" ? "male" : "female",
    ageBand: AGES.find((x) => x === a) ?? "20대",
    style: parseStyle(code),
  };
}
