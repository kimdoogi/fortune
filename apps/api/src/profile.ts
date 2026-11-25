/** 프로필 (F02, docs/09 §2·§4). 생년월일·출생 시각은 AES-GCM으로 암호화해 저장한다 */
import {
  BRANCHES,
  type PillarsResult,
  SajuError,
  computePillars,
  manAge,
  stemInfo,
} from "@fortune/fortune-engine";
import { findBanned } from "@fortune/prompts";
import {
  ACCESSORIES,
  type AgeBand,
  type AvatarStyle,
  type BirthTime,
  HAIRS,
  HAIR_COLORS,
  OUTFITS,
  OUTFIT_COLORS,
  SPECIES,
  type StyleInput,
  TONES,
  avatarString,
  encodeStyle,
  parseStyle,
} from "@fortune/shared-types";
import type {
  Calendar,
  Gender,
  HourBranch,
  ProfileInput,
  ProfileView,
} from "@fortune/shared-types";
import { z } from "zod";
import { PII_KEY_VERSION, decryptPii, encryptPii } from "./crypto";
import type { Env } from "./env";
import { HttpError, json, readBody } from "./http";
import type { User } from "./session";
import { nowIso, todayKst } from "./time";

const HOUR_BRANCHES = BRANCHES as readonly HourBranch[];

/** 12지시 → 그 시의 가운데 시각 (F02: 자시 00:30, 축시 02:30 … 해시 22:30) */
export function branchMiddleTime(branch: HourBranch): string {
  const i = HOUR_BRANCHES.indexOf(branch);
  if (i < 0) throw new Error(`unknown branch ${branch}`);
  return `${String(i * 2).padStart(2, "0")}:30`;
}

/** BirthTime → 엔진 입력 "HH:MM" (모름이면 null) */
export function birthTimeToClock(t: BirthTime): string | null {
  if (t.kind === "unknown") return null;
  if (t.kind === "branch") return branchMiddleTime(t.branch);
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

/** 나이대 (F02, D-017). 만 14세 미만은 null (이용 불가) */
export function ageBandOf(age: number): AgeBand | null {
  if (age < 14) return null;
  if (age < 20) return "10대";
  if (age < 30) return "20대";
  if (age < 40) return "30대";
  return "40대 이상";
}

/** 연지 → 띠 */
export const ZODIAC: Record<string, string> = {
  자: "쥐",
  축: "소",
  인: "호랑이",
  묘: "토끼",
  진: "용",
  사: "뱀",
  오: "말",
  미: "양",
  신: "원숭이",
  유: "닭",
  술: "개",
  해: "돼지",
};

const nickname = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => {
    const n = [...s].length;
    return n >= 2 && n <= 10;
  });

export const ProfileSchema = z.object({
  nickname,
  calendar: z.enum(["solar", "lunar"]),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isLeapMonth: z.boolean(),
  birthTime: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("clock"),
      hour: z.number().int().min(0).max(23),
      minute: z.number().int().min(0).max(59),
    }),
    z.object({
      kind: z.literal("branch"),
      branch: z.enum(HOUR_BRANCHES as [HourBranch, ...HourBranch[]]),
    }),
    z.object({ kind: z.literal("unknown") }),
  ]),
  gender: z.enum(["male", "female"]),
  consent: z.literal(true),
});

/** 캐릭터 꾸미기 (F17, D-098): 목록에 있는 값만 받는다 */
export const StyleSchema = z.object({
  species: z.enum(SPECIES),
  hair: z.enum(HAIRS),
  outfit: z.enum(OUTFITS),
  color: z.enum(OUTFIT_COLORS),
  acc: z.enum(ACCESSORIES),
  hairColor: z.enum(HAIR_COLORS),
  tone: z
    .number()
    .int()
    .min(0)
    .max(TONES - 1),
});
export const StyleInputSchema = z.object({ style: StyleSchema.nullable() });

/** 암호화해서 함께 저장하는 부분 */
export interface BirthData {
  birthDate: string;
  isLeapMonth: boolean;
  birthTime: BirthTime;
}

export interface Profile extends BirthData {
  nickname: string;
  calendar: Calendar;
  gender: Gender;
  profileVersion: number;
  /** 캐릭터 꾸미기 (F17). 없거나 모르는 코드면 null = 기본 모습 */
  style: AvatarStyle | null;
}

/** 엔진 오류 → 안내 문구 (F02 예외 상황) */
function sajuErrorToHttp(
  e: SajuError,
  input: { birthDate: string; isLeapMonth: boolean },
): HttpError {
  switch (e.code) {
    case "INVALID_DATE":
      return new HttpError("INVALID_DATE", "없는 날짜예요. 생년월일을 다시 확인해 주세요");
    case "OUT_OF_RANGE":
      return new HttpError("OUT_OF_RANGE", "1920년 1월 1일 이후에 태어난 날짜만 볼 수 있어요");
    case "NO_SUCH_LEAP_MONTH": {
      const [y, m] = input.birthDate.split("-").map(Number);
      return new HttpError("NO_SUCH_LEAP_MONTH", `${y}년에는 윤${m}월이 없어요`);
    }
    case "NONEXISTENT_TIME":
      return new HttpError(
        "NONEXISTENT_TIME",
        "그 시각은 서머타임으로 건너뛴 시간이에요. 다시 확인해 주세요",
      );
    default:
      return new HttpError("INVALID_INPUT", "생년월일이나 시간을 다시 확인해 주세요");
  }
}

/** 사주 원국 계산. 잘못된 생년월일이면 HttpError */
export function natalOf(b: BirthData & { calendar: Calendar }): PillarsResult {
  try {
    return computePillars({
      calendar: b.calendar,
      date: b.birthDate,
      time: birthTimeToClock(b.birthTime),
      isLeapMonth: b.calendar === "lunar" ? b.isLeapMonth : false,
    });
  } catch (e) {
    if (e instanceof SajuError) throw sajuErrorToHttp(e, b);
    throw e;
  }
}

/** 오늘 기준 만 나이로 나이대. 14세 미만이면 UNDER_14 */
export function ageBandAt(natal: PillarsResult, today = todayKst()): AgeBand {
  if (natal.solarDate > today) {
    throw new HttpError("INVALID_DATE", "오늘 이후 날짜는 고를 수 없어요");
  }
  const band = ageBandOf(manAge(natal.solarDate, today));
  if (!band) throw new HttpError("UNDER_14", "만 14세 이상부터 이용할 수 있어요");
  return band;
}

export function profileView(p: Profile, natal: PillarsResult, ageBand: AgeBand): ProfileView {
  const dm = natal.pillars.day.charAt(0);
  const info = stemInfo(dm);
  return {
    nickname: p.nickname,
    calendar: p.calendar,
    birthDate: p.birthDate,
    isLeapMonth: p.isLeapMonth,
    birthTime: p.birthTime,
    gender: p.gender,
    ageBand,
    avatarId: avatarString(p.gender, ageBand, p.style),
    style: p.style,
    dayMaster: { stem: dm, element: info.element, yinYang: info.yinYang },
    zodiac: ZODIAC[natal.pillars.year.charAt(1)] ?? "",
    flags: natal.flags,
  };
}

interface ProfileRow {
  nickname: string;
  calendar: Calendar;
  birth_enc: string;
  key_version: number;
  gender: Gender;
  profile_version: number;
  style: string | null;
}

export async function loadProfile(env: Env, userId: string): Promise<Profile | null> {
  const row = await env.DB.prepare(
    "SELECT nickname, calendar, birth_enc, key_version, gender, profile_version, style FROM profiles WHERE user_id = ?",
  )
    .bind(userId)
    .first<ProfileRow>();
  if (!row) return null;
  // key_version이 1뿐이라 지금은 PII_KEY 하나로 푼다. 키를 바꿀 때 버전별 키를 고른다
  const birth = JSON.parse(await decryptPii(env.PII_KEY, row.birth_enc)) as BirthData;
  return {
    nickname: row.nickname,
    calendar: row.calendar,
    gender: row.gender,
    profileVersion: row.profile_version,
    style: parseStyle(row.style),
    ...birth,
  };
}

/** 점 보기 경로: 프로필이 없으면 PROFILE_REQUIRED (docs/09 §3) */
export async function requireProfile(env: Env, userId: string): Promise<Profile> {
  const p = await loadProfile(env, userId);
  if (!p) throw new HttpError("PROFILE_REQUIRED", "먼저 프로필을 만들어 주세요");
  return p;
}

/** GET /api/profile */
export async function getProfile(env: Env, user: User): Promise<Response> {
  const p = await requireProfile(env, user.id);
  const natal = natalOf(p);
  return json(profileView(p, natal, ageBandAt(natal)));
}

/** PUT /api/profile: 검증 → 원국 계산으로 날짜 확인 → 만 14세 확인 → 암호화 저장 */
export async function putProfile(req: Request, env: Env, user: User): Promise<Response> {
  const input: ProfileInput = await readBody(req, ProfileSchema);
  if (findBanned(input.nickname).length > 0) {
    throw new HttpError("INVALID_INPUT", "그 닉네임은 쓸 수 없어요. 다른 닉네임을 골라 주세요");
  }
  if (input.calendar === "solar" && input.birthDate < "1920-01-01") {
    throw new HttpError("OUT_OF_RANGE", "1920년 1월 1일 이후에 태어난 날짜만 볼 수 있어요");
  }
  const birth: BirthData = {
    birthDate: input.birthDate,
    isLeapMonth: input.calendar === "lunar" ? input.isLeapMonth : false,
    birthTime: input.birthTime,
  };
  const natal = natalOf({ ...birth, calendar: input.calendar });
  const ageBand = ageBandAt(natal); // 14세 미만이면 여기서 끝나고 저장하지 않는다

  const enc = await encryptPii(env.PII_KEY, JSON.stringify(birth));
  const row = await env.DB.prepare(
    `INSERT INTO profiles (user_id, nickname, calendar, birth_enc, key_version, gender, age_band, profile_version, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8)
     ON CONFLICT (user_id) DO UPDATE SET
       nickname = excluded.nickname, calendar = excluded.calendar, birth_enc = excluded.birth_enc,
       key_version = excluded.key_version, gender = excluded.gender, age_band = excluded.age_band,
       profile_version = profiles.profile_version + 1, updated_at = excluded.updated_at
     RETURNING profile_version, style`,
  )
    .bind(
      user.id,
      input.nickname,
      input.calendar,
      enc,
      PII_KEY_VERSION,
      input.gender,
      ageBand,
      nowIso(),
    )
    .first<{ profile_version: number; style: string | null }>();
  const profile: Profile = {
    ...birth,
    nickname: input.nickname,
    calendar: input.calendar,
    gender: input.gender,
    profileVersion: row?.profile_version ?? 1,
    // 프로필을 고쳐도 꾸미기는 그대로 둔다 (F17)
    style: parseStyle(row?.style),
  };
  return json(profileView(profile, natal, ageBand));
}

/**
 * PUT /api/profile/style (F17, D-098): 꾸미기만 바꾼다. profile_version은 그대로 (사주 seed가 바뀌지 않게).
 * null이면 지우고 기본 모습으로
 */
export async function putStyle(req: Request, env: Env, user: User): Promise<Response> {
  const input: StyleInput = await readBody(req, StyleInputSchema);
  const p = await requireProfile(env, user.id);
  const code = input.style ? encodeStyle(input.style) : null;
  await env.DB.prepare("UPDATE profiles SET style = ?1, updated_at = ?2 WHERE user_id = ?3")
    .bind(code, nowIso(), user.id)
    .run();
  const natal = natalOf(p);
  return json(profileView({ ...p, style: parseStyle(code) }, natal, ageBandAt(natal)));
}
