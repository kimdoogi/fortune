/**
 * app Worker API 클라이언트 (docs/09 §3). 쿠키(HttpOnly)로 인증하므로 토큰을 다루지 않는다.
 * 실패하면 ApiFailure를 던진다. message는 서버가 준 사용자용 문장이다.
 */
import type {
  ApiError,
  CheckRequest,
  CheckResponse,
  DailyResponse,
  ErrorCode,
  FollowupRequest,
  FollowupResponse,
  GunghapInviteCreated,
  GunghapInviteView,
  MenuResponse,
  PairDreamResponse,
  PairReadingRequest,
  ProductId,
  ProfileInput,
  ProfileView,
  ReadingList,
  ReadingRequest,
  ReadingResult,
  SessionResponse,
  ShopId,
  StyleInput,
} from "@fortune/shared-types";

export class ApiFailure extends Error {
  constructor(
    readonly code: ErrorCode | "NETWORK",
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure("NETWORK", "인터넷 연결을 확인해 주세요", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err = (data as ApiError | null)?.error;
    throw new ApiFailure(
      err?.code ?? "NETWORK",
      err?.message ?? "잠시 후 다시 시도해 주세요",
      res.status,
    );
  }
  return data as T;
}

/** 브라우저 UUID (중복 요청 방지용 requestId) */
export const newRequestId = () => crypto.randomUUID();

export const api = {
  /** F14: 쿠키가 있으면 그 계정, 없으면 새 계정 */
  session: (turnstileToken?: string) =>
    call<SessionResponse>("POST", "/api/session", { turnstileToken }),
  /** F14: 내 정보 삭제 (되돌릴 수 없음) */
  deleteMe: () => call<void>("DELETE", "/api/session"),
  getProfile: () => call<ProfileView>("GET", "/api/profile"),
  putProfile: (input: ProfileInput) => call<ProfileView>("PUT", "/api/profile", input),
  /** F17: 캐릭터 꾸미기만 바꾼다 (null이면 기본 모습) */
  putStyle: (input: StyleInput) => call<ProfileView>("PUT", "/api/profile/style", input),
  menu: (shop: ShopId) => call<MenuResponse>("GET", `/api/menu?shop=${shop}`),
  check: (req: CheckRequest) => call<CheckResponse>("POST", "/api/readings/check", req),
  read: (req: ReadingRequest) => call<ReadingResult>("POST", "/api/readings", req),
  list: (cursor?: string | null) =>
    call<ReadingList>(
      "GET",
      `/api/readings${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  get: (id: string) => call<ReadingResult>("GET", `/api/readings/${encodeURIComponent(id)}`),
  remove: (id: string) => call<void>("DELETE", `/api/readings/${encodeURIComponent(id)}`),
  daily: () => call<DailyResponse>("GET", "/api/daily"),
  /** F15: 풀이에 이어 묻기 (한 풀이에 3번) */
  followup: (id: string, req: FollowupRequest) =>
    call<FollowupResponse>("POST", `/api/readings/${encodeURIComponent(id)}/followups`, req),
  // ── 같이 보기 (F16) ──
  createInvite: () => call<GunghapInviteCreated>("POST", "/api/pair/invites", { consent: true }),
  invite: (code: string) =>
    call<GunghapInviteView>("GET", `/api/pair/invites/${encodeURIComponent(code)}`),
  joinInvite: (code: string) =>
    call<GunghapInviteView>("POST", `/api/pair/invites/${encodeURIComponent(code)}/join`, {
      consent: true,
    }),
  /** 궁합·관계 타로·둘의 신점: 관계를 고르면 풀이 */
  pairReading: (code: string, req: PairReadingRequest) =>
    call<ReadingResult>("POST", `/api/pair/${encodeURIComponent(code)}/readings`, req),
  /** 두 사람 꿈풀이: 내 꿈 내기 */
  pairDream: (code: string, text: string) =>
    call<PairDreamResponse>("POST", `/api/pair/${encodeURIComponent(code)}/dream`, { text }),
  pairResult: (code: string, product: ProductId) =>
    call<ReadingResult>(
      "GET",
      `/api/pair/${encodeURIComponent(code)}/result?product=${encodeURIComponent(product)}`,
    ),
  wsToken: (room: string) =>
    call<{ token: string; channel: string; userId: string }>(
      "GET",
      `/api/ws-token?room=${encodeURIComponent(room)}`,
    ),
};
