/**
 * 앱 전체 상태: 세션(F14), 프로필(F02), 남은 점 횟수, 알림.
 * 화면은 여기 signal만 읽고, 오류는 handleError로 모아 친절한 문장으로 바꾼다.
 */
import type { ProfileView, SessionResponse } from "@fortune/shared-types";
import { signal } from "@preact/signals";
import { ApiFailure, api } from "../../api/client";

/** boot: 세션 확인 중 / onboarding: 프로필 없음(F02) / ready: 지도부터 / failed: 세션 실패 */
export type Phase = "boot" | "onboarding" | "ready" | "failed";

export const phase = signal<Phase>("boot");
export const session = signal<SessionResponse | null>(null);
export const profile = signal<ProfileView | null>(null);
/** 오늘 남은 점 (하루 30회, D-057). 모르면 null */
export const callsLeft = signal<number | null>(null);
export const bootError = signal<string>("");
/** 처음 만든 계정인지 (F14: "브라우저 데이터를 지우면 기록이 사라져요" 안내) */
export const firstVisit = signal(false);

export interface Toast {
  id: number;
  text: string;
}
export const toasts = signal<Toast[]>([]);
let toastId = 0;

export function toast(text: string) {
  const id = ++toastId;
  toasts.value = [...toasts.value, { id, text }];
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, 3200);
}

/** 오류 코드 → 사용자 문장. 코드 이름은 화면에 내보내지 않는다 (docs/features 공통 규칙) */
const FRIENDLY: Partial<Record<ApiFailure["code"], string>> = {
  NETWORK: "인터넷 연결을 확인해 주세요",
  RATE_LIMITED: "조금 천천히 해 주세요. 잠시 뒤에 다시 눌러 주세요",
  DAILY_LIMIT: "오늘은 점을 충분히 봤어요. 내일 다시 와 주세요",
  ACCOUNT_LIMIT: "오늘은 새로 시작할 수 없어요. 내일 다시 와 주세요",
  NOT_FOUND: "찾을 수 없는 기록이에요",
  LLM_UNAVAILABLE: "점술가가 잠시 자리를 비웠어요. 조금 뒤에 다시 와 주세요",
};

export function friendly(e: unknown): string {
  if (e instanceof ApiFailure) {
    // 서버 문장은 사용자용이다 (api/client). 비어 있거나 한글이 아니면 기본 문장으로
    if (/[가-힣]/.test(e.message)) return e.message;
    return FRIENDLY[e.code] ?? "잠시 후 다시 시도해 주세요";
  }
  return "잠시 후 다시 시도해 주세요";
}

/** 세션·프로필 오류만 처리한다 (화면 안에 오류를 따로 보여 줄 때). 처리했으면 true */
export function handleAuth(e: unknown): boolean {
  if (e instanceof ApiFailure && (e.code === "UNAUTHORIZED" || e.code === "PROFILE_REQUIRED")) {
    return handleError(e);
  }
  return false;
}

/**
 * 공통 오류 처리. UNAUTHORIZED → 세션을 다시 만든다, PROFILE_REQUIRED → 프로필 입력으로.
 * 그 밖은 알림만 띄운다. 처리했으면 true.
 */
export function handleError(e: unknown): boolean {
  if (e instanceof ApiFailure) {
    if (e.code === "UNAUTHORIZED") {
      void boot();
      return true;
    }
    if (e.code === "PROFILE_REQUIRED") {
      profile.value = null;
      phase.value = "onboarding";
      return true;
    }
  }
  toast(friendly(e));
  return false;
}

/** F14 세션 → 프로필 있으면 지도, 없으면 F02 */
export async function boot() {
  phase.value = "boot";
  bootError.value = "";
  try {
    const s = await api.session();
    session.value = s;
    callsLeft.value = s.todayCallsLeft;
    if (!s.hasProfile) {
      firstVisit.value = true;
      profile.value = null;
      phase.value = "onboarding";
      return;
    }
    profile.value = await api.getProfile();
    phase.value = "ready";
  } catch (e) {
    if (e instanceof ApiFailure && e.code === "PROFILE_REQUIRED") {
      phase.value = "onboarding";
      return;
    }
    bootError.value = friendly(e);
    phase.value = "failed";
  }
}

/** 프로필의 외모 (avatarId = `${gender}:${ageBand}`) */
export function lookOf(p: ProfileView) {
  const [g, a] = p.avatarId.split(":");
  const gender = g === "male" || g === "female" ? g : p.gender;
  const ageBand = a === "10대" || a === "20대" || a === "30대" || a === "40대 이상" ? a : p.ageBand;
  return { gender, ageBand } as const;
}
