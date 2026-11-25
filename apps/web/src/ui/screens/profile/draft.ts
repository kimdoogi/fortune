/**
 * F02 입력값과 화면 쪽 검증. 최종 검증은 서버(fortune-engine)가 다시 한다.
 * 저장 중 네트워크 오류가 나도 입력값을 잃지 않게 기기에 임시 보관한다 (F02 예외).
 */
import type {
  BirthTime,
  Calendar,
  Gender,
  HourBranch,
  ProfileInput,
  ProfileView,
} from "@fortune/shared-types";
import { todayKst } from "../../app/format";

export interface Draft {
  nickname: string;
  calendar: Calendar;
  year: string;
  month: string;
  day: string;
  isLeapMonth: boolean;
  timeKind: BirthTime["kind"];
  ampm: "am" | "pm";
  hour12: string;
  minute: string;
  branch: HourBranch | null;
  gender: Gender | null;
}

export const EMPTY: Draft = {
  nickname: "",
  calendar: "solar",
  year: "",
  month: "",
  day: "",
  isLeapMonth: false,
  timeKind: "clock",
  ampm: "am",
  hour12: "",
  minute: "",
  branch: null,
  gender: null,
};

/** 12지시와 시간대 (F02: 고르면 그 시의 가운데 시각으로 계산. 자시 → 00:30) */
export const BRANCHES: { b: HourBranch; animal: string; range: string }[] = [
  { b: "자", animal: "쥐", range: "23:30~01:30" },
  { b: "축", animal: "소", range: "01:30~03:30" },
  { b: "인", animal: "범", range: "03:30~05:30" },
  { b: "묘", animal: "토끼", range: "05:30~07:30" },
  { b: "진", animal: "용", range: "07:30~09:30" },
  { b: "사", animal: "뱀", range: "09:30~11:30" },
  { b: "오", animal: "말", range: "11:30~13:30" },
  { b: "미", animal: "양", range: "13:30~15:30" },
  { b: "신", animal: "원숭이", range: "15:30~17:30" },
  { b: "유", animal: "닭", range: "17:30~19:30" },
  { b: "술", animal: "개", range: "19:30~21:30" },
  { b: "해", animal: "돼지", range: "21:30~23:30" },
];

const KEY = "fortune.profileDraft.v1";

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // 저장소를 못 써도 입력은 계속한다
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}

/** 고칠 때: 저장된 프로필로 채운다 */
export function fromProfile(p: ProfileView): Draft {
  const [y = "", m = "", d = ""] = p.birthDate.split("-");
  const t = p.birthTime;
  const h = t.kind === "clock" ? t.hour : 0;
  return {
    nickname: p.nickname,
    calendar: p.calendar,
    year: y,
    month: String(Number(m)),
    day: String(Number(d)),
    isLeapMonth: p.isLeapMonth,
    timeKind: t.kind,
    ampm: h < 12 ? "am" : "pm",
    hour12: t.kind === "clock" ? String(h % 12 === 0 ? 12 : h % 12) : "",
    minute: t.kind === "clock" ? String(t.minute) : "",
    branch: t.kind === "branch" ? t.branch : null,
    gender: p.gender,
  };
}

/** 글자 수 (한글·이모지 한 글자를 1로) */
export const charCount = (s: string) => [...s.trim()].length;

export function nicknameError(s: string): string {
  const n = charCount(s);
  if (n === 0) return "닉네임을 적어 주세요";
  if (n < 2) return "두 글자 이상으로 적어 주세요";
  if (n > 10) return "열 글자까지 쓸 수 있어요";
  if (/[<>{}\\]/.test(s)) return "쓸 수 없는 기호가 있어요";
  return "";
}

const int = (s: string) => (/^\d+$/.test(s) ? Number(s) : Number.NaN);

/** 날짜 칸 검증. 없는 날짜는 입력 칸에서 바로 막는다 (F02) */
export function birthError(d: Draft): { message: string; under14?: boolean } {
  const y = int(d.year);
  const m = int(d.month);
  const day = int(d.day);
  if (!d.year || !d.month || !d.day) return { message: "태어난 해, 달, 날을 모두 적어 주세요" };
  const now = todayKst();
  if (Number.isNaN(y) || d.year.length !== 4)
    return { message: "태어난 해를 네 자리로 적어 주세요" };
  if (y < 1920) return { message: "1920년 1월 1일 이후로 태어난 날만 볼 수 있어요" };
  if (y > now.y) return { message: "아직 오지 않은 해예요" };
  if (Number.isNaN(m) || m < 1 || m > 12) return { message: "달은 1월부터 12월까지예요" };
  if (d.calendar === "solar") {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (Number.isNaN(day) || day < 1 || day > last)
      return { message: `${m}월은 ${last}일까지 있어요` };
    if (y === now.y && (m > now.m || (m === now.m && day > now.d)))
      return { message: "아직 오지 않은 날이에요" };
    // 만 나이 (D-016: 만 14세 미만은 저장하지 않는다)
    let age = now.y - y;
    if (now.m < m || (now.m === m && now.d < day)) age--;
    if (age < 14) return { message: "만 14세 이상부터 이용할 수 있어요", under14: true };
  } else if (Number.isNaN(day) || day < 1 || day > 30) {
    // 음력 작은달(29일)은 서버가 확인한다
    return { message: "음력 날짜는 30일까지예요" };
  }
  return { message: "" };
}

export function timeError(d: Draft): string {
  if (d.timeKind === "branch") return d.branch ? "" : "태어난 시를 골라 주세요";
  if (d.timeKind === "unknown") return "";
  const h = int(d.hour12);
  const mi = d.minute === "" ? 0 : int(d.minute);
  if (Number.isNaN(h) || h < 1 || h > 12) return "시는 1시부터 12시까지 적어 주세요";
  if (Number.isNaN(mi) || mi < 0 || mi > 59) return "분은 0분부터 59분까지예요";
  return "";
}

export function toInput(d: Draft): ProfileInput {
  const pad = (s: string) => s.padStart(2, "0");
  let birthTime: BirthTime;
  if (d.timeKind === "branch" && d.branch) birthTime = { kind: "branch", branch: d.branch };
  else if (d.timeKind === "clock") {
    const h12 = Number(d.hour12) % 12;
    birthTime = {
      kind: "clock",
      hour: d.ampm === "pm" ? h12 + 12 : h12,
      minute: d.minute === "" ? 0 : Number(d.minute),
    };
  } else birthTime = { kind: "unknown" };
  return {
    nickname: d.nickname.trim(),
    calendar: d.calendar,
    birthDate: `${d.year}-${pad(String(Number(d.month)))}-${pad(String(Number(d.day)))}`,
    isLeapMonth: d.calendar === "lunar" && d.isLeapMonth,
    birthTime,
    gender: d.gender ?? "female",
    consent: true,
  };
}

/** 프로필 요약 문장 (내 캐릭터 화면) */
export function describeBirth(p: ProfileView): string {
  const [y, m, d] = p.birthDate.split("-").map(Number);
  const cal = p.calendar === "solar" ? "양력" : p.isLeapMonth ? "음력(윤달)" : "음력";
  return `${cal} ${y}년 ${m}월 ${d}일`;
}

export function describeTime(p: ProfileView): string {
  const t = p.birthTime;
  if (t.kind === "unknown") return "모름";
  if (t.kind === "branch") {
    const b = BRANCHES.find((x) => x.b === t.branch);
    return `${t.branch}시 (${b?.range ?? ""})`;
  }
  const ampm = t.hour < 12 ? "오전" : "오후";
  const h = t.hour % 12 === 0 ? 12 : t.hour % 12;
  return `${ampm} ${h}시 ${t.minute}분`;
}
