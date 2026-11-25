/**
 * app Worker HTTP API 요청·응답 (docs/09 §3, features F01~F14).
 * web과 api가 이 파일만 보고 맞춘다. 바꾸면 양쪽을 같이 고친다.
 */
import type { InterpretOutput, ProductId, ShopId } from "./index";

export type Gender = "male" | "female";
export type AgeBand = "10대" | "20대" | "30대" | "40대 이상";
export type Calendar = "solar" | "lunar";

/** 12지시 (F02: 고르면 그 시의 가운데 시각으로 계산) */
export type HourBranch =
  | "자"
  | "축"
  | "인"
  | "묘"
  | "진"
  | "사"
  | "오"
  | "미"
  | "신"
  | "유"
  | "술"
  | "해";

export type BirthTime =
  | { kind: "clock"; hour: number; minute: number }
  | { kind: "branch"; branch: HourBranch }
  | { kind: "unknown" };

// ── F14 세션 ──────────────────────────────────────────────
/** POST /api/session  (본문 { turnstileToken? }) → 쿠키 발급 + 이 응답 */
export interface SessionResponse {
  userId: string;
  hasProfile: boolean;
  todayCallsLeft: number;
}

// ── F02 프로필 ────────────────────────────────────────────
/** PUT /api/profile 본문 */
export interface ProfileInput {
  nickname: string;
  calendar: Calendar;
  /** YYYY-MM-DD (음력이면 음력 날짜) */
  birthDate: string;
  isLeapMonth: boolean;
  birthTime: BirthTime;
  gender: Gender;
  /** 개인정보 수집 동의 (F02). true가 아니면 400 */
  consent: true;
}

/** GET/PUT /api/profile 응답 */
export interface ProfileView {
  nickname: string;
  calendar: Calendar;
  birthDate: string;
  isLeapMonth: boolean;
  birthTime: BirthTime;
  gender: Gender;
  ageBand: AgeBand;
  /** 기본 아바타 8종 중 하나: `${gender}:${ageBand}` */
  avatarId: string;
  dayMaster: { stem: string; element: string; yinYang: "양" | "음" };
  /** 띠 (예: "쥐") */
  zodiac: string;
  flags: { ambiguousTime: boolean; solarTermDay: boolean };
}

// ── F04 점 목록 ───────────────────────────────────────────
/** GET /api/menu?shop= */
export interface MenuItem {
  product: ProductId;
  name: string;
  /** 오늘 이미 본 결과 (가장 최근 1건). 없으면 null */
  todayReadingId: string | null;
}
export interface MenuResponse {
  shop: ShopId;
  items: MenuItem[];
}

// ── F05~F08 점 보기 ───────────────────────────────────────
export type TarotCategory = "연애" | "재물" | "직장" | "오늘";
export type DolyeongCategory = "연애" | "재물" | "직장" | "건강" | "기타";
export type FlagColor = "빨강" | "노랑" | "파랑" | "하양" | "초록";
export type FlagGrade = "대길" | "길" | "평" | "주의";

/** POST /api/readings 본문. requestId는 클라이언트가 만든 UUID (중복 요청 방지) */
export type ReadingRequest =
  | { shop: "saju"; product: "saju_full"; requestId: string }
  | {
      shop: "tarot";
      product: "tarot_one" | "tarot_three";
      category: TarotCategory;
      requestId: string;
    }
  | { shop: "dolyeong"; product: "obanggi"; category: DolyeongCategory; requestId: string }
  | { shop: "dolyeong"; product: "sinjeom"; requestId: string }
  | { shop: "dream"; product: "dream"; checkId: string; requestId: string };

/** 사주판 (F05 출력) */
export interface SajuBoard {
  /** "갑자" 같은 두 글자. 시간 모름이면 hour는 null */
  pillars: { year: string; month: string; day: string; hour: string | null };
  hourUnknown: boolean;
  dayMaster: { stem: string; element: string; yinYang: "양" | "음" };
  elements: Record<"목" | "화" | "토" | "금" | "수", number>;
  strength: "신강" | "신약" | "중화";
  yongsin: string;
  /** 앞으로 12달 월운 등급 (D-079). 예전 풀이에는 없다 */
  months?: { year: number; month: number; grade: "good" | "normal" | "caution" }[];
}

export interface TarotCardView {
  /** 과거 / 현재 / 미래 / 오늘 */
  position: string;
  /** 메이저 아르카나 번호 0~21 */
  id: number;
  name: string;
  reversed: boolean;
}

/** 결과 화면에 같이 그릴 "당시 입력" (F10: 다시 보기에도 그대로) */
export type ReadingVisual =
  | { shop: "saju"; board: SajuBoard }
  | { shop: "tarot"; spread: "one" | "three"; category: TarotCategory; cards: TarotCardView[] }
  | {
      shop: "dolyeong";
      /** 신점(sinjeom)은 카테고리가 없다 */
      category: DolyeongCategory | null;
      /** 오방기는 뽑은 깃발, 신점은 숨은 점괘 */
      flag: { color: FlagColor; grade: FlagGrade };
      mode?: "sinjeom";
      /** 신점 쌀점: 손바닥에 잡힌 쌀알 수와 등급 (D-087). 예전 결과에는 없다 */
      rice?: { count: number; grade: FlagGrade };
    }
  | { shop: "dream"; dream: string; symbols: { id: string; name: string }[] };

/** POST /api/readings, GET /api/readings/:id 응답 */
export interface ReadingResult {
  id: string;
  shop: ShopId;
  product: ProductId;
  /** ISO 시각 */
  createdAt: string;
  visual: ReadingVisual;
  output: InterpretOutput;
  /** true면 저장본을 다시 연 것 (LLM 호출 없음) */
  reused: boolean;
  /** 결과 아래에 코드가 붙이는 고지 (docs/04 §7) */
  disclaimer: string;
  todayCallsLeft: number;
  /** 이어 묻기 문답 (F15), 오래된 것부터 */
  followups: FollowupView[];
  /** 이 풀이에 더 물을 수 있는 횟수 (최대 3) */
  followupsLeft: number;
}

// ── F15 이어 묻기 ─────────────────────────────────────────
export interface FollowupView {
  id: string;
  question: string;
  answer: string;
  /** ISO 시각 */
  createdAt: string;
}

/** POST /api/readings/:id/followups 본문 */
export interface FollowupRequest {
  question: string;
  requestId: string;
}

/**
 * POST /api/readings/:id/followups 응답.
 * 위험 글이면 422 CRISIS(위기 안내), 차단이면 422 BLOCKED_CONTENT(점술가 말투 문장)로 온다
 */
export interface FollowupResponse {
  followup: FollowupView;
  followupsLeft: number;
  todayCallsLeft: number;
}

// ── F08 꿈 검사 ───────────────────────────────────────────
/** POST /api/readings/check 본문 */
export interface CheckRequest {
  shop: "dream";
  text: string;
}

export type CheckBlockReason =
  | "EMPTY"
  | "TOO_LONG"
  | "PII"
  | "BANNED"
  | "BLOCKED"
  | "NO_SYMBOLS"
  /** self_harm: 점을 보지 않고 위기 안내 화면 (docs/04a) */
  | "CRISIS";

export type CheckResponse =
  | { ok: true; checkId: string; symbols: { id: string; name: string }[]; todayCallsLeft: number }
  /** message는 몽실 할매 말투 안내 문장 */
  | { ok: false; reason: CheckBlockReason; message: string; todayCallsLeft: number };

// ── F10 점 기록 ───────────────────────────────────────────
/** GET /api/readings?cursor= (20개씩) */
export interface ReadingListItem {
  id: string;
  shop: ShopId;
  product: ProductId;
  createdAt: string;
  summary: string;
}
export interface ReadingList {
  items: ReadingListItem[];
  nextCursor: string | null;
}
/** DELETE /api/readings/:id → 204 */

// ── F13 오늘의 운세 ───────────────────────────────────────
/** GET /api/daily */
export interface DailyResponse {
  /** YYYY-MM-DD (한국 시간) */
  date: string;
  /** 오늘 일진 (예: "병오") */
  iljin: string;
  /** 사용자의 일간 (예: "갑") */
  dayMaster: string;
  /** 운세 점수 40~99와 등급, 행운의 숫자 (코드 계산, D-080) */
  score: number;
  scoreLabel: "아주 좋음" | "좋음" | "보통" | "조심";
  luckyNumbers: number[];
  result: InterpretOutput;
  disclaimer: string;
}

/** 상품 이름 (점 목록·기록 화면 공통) */
export const PRODUCT_NAMES: Record<ProductId, string> = {
  daily: "오늘의 운세",
  saju_full: "사주 정밀",
  tarot_one: "오늘의 한 장",
  tarot_three: "세 장 스프레드",
  obanggi: "오방기",
  sinjeom: "신점",
  dream: "꿈해몽",
};

/** 점집별로 볼 수 있는 점 (F04 표) */
export const SHOP_PRODUCTS: Record<ShopId, ProductId[]> = {
  saju: ["daily", "saju_full"],
  tarot: ["tarot_one", "tarot_three"],
  dolyeong: ["sinjeom"],
  dream: ["dream"],
};

/** 섹션 제목 (코드가 붙인다, docs/04 §5) */
export const SECTION_TITLES: Record<string, string> = {
  overall: "총평",
  tip: "오늘의 한 가지",
  // 사주 섹션 제목은 쉬운 말로 (D-083)
  personality: "어떤 사람인지",
  elements: "타고난 기운",
  yongsin: "나를 돕는 기운",
  daewoon: "10년 흐름",
  thisYear: "올해",
  months: "월별 운세",
  love: "연애",
  money: "돈",
  work: "일",
  card: "카드",
  message: "메시지",
  past: "과거",
  present: "현재",
  future: "미래",
  advice: "조언",
  flag: "깃발",
  gongsu: "아기도령의 공수",
  symbols: "꿈 속 상징",
  meaning: "꿈의 뜻",
};

export const DISCLAIMER =
  "재미로 보는 풀이예요. 중요한 결정은 스스로, 필요하면 전문가와 함께 내려 주세요.";
