/**
 * 당산나무 소원 (F18, D-099, docs/09 §3). LLM을 부르지 않는다.
 * - 소원: 하루 한 번, 1~40자, 오방색 천. 글 검사는 코드(길이·개인정보·금칙어·위기 낱말)
 * - 돌 올리기: 하루 한 번, 그날 합계만 보여 준다
 * - 나무에 걸 천: 최근 14일 최신 150장(색만) + 내 소원
 * - 돌아보기: 30일 지난 내 소원에 "어떻게 됐어요?"
 * - 같이 보기: 같이 묶으면 상대도 그 소원을 보고, 방에 `wished`로 알린다
 */
import { findBanned } from "@fortune/prompts";
import {
  WISH_COLORS,
  WISH_MAX,
  WISH_REVIEW_DAYS,
  type WishBoard,
  type WishColor,
  type WishResponse,
  type WishView,
} from "@fortune/shared-types";
import { z } from "zod";
import type { Env } from "./env";
import { hasPii } from "./filters";
import { inviteForMember, notifyRoom } from "./gunghap/invites";
import { HttpError, json, readBody } from "./http";
import { CRISIS_TEXT } from "./personas";
import { loadProfile, requireProfile } from "./profile";
import type { User } from "./session";
import { nowIso, todayKst } from "./time";

const CLOTH_DAYS = 14;
const CLOTH_MAX = 150;

/** 위기 낱말: 저장하지 않고 위기 안내 (04a). LLM 분류 없이 코드로만 거른다 */
const CRISIS_RE = /죽고\s*싶|죽어\s*버리|자살|자해|사라지고\s*싶|살기\s*싫|목숨을\s*끊/;

/** 나무의 덕담: 색마다 미리 써 둔 문장 (LLM 아님) */
export const BLESSINGS: Record<WishColor, readonly string[]> = {
  빨강: [
    "붉은 천이 바람에 날리네요. 마음이 닿을 사람에게 먼저 한마디 건네 보세요.",
    "인연은 오가는 말에서 자라요. 이번 주에 반가운 얼굴을 한 번 떠올려 보세요.",
    "붉은 실처럼 이어질 마음이라면, 조급해하지 않아도 닿아요.",
  ],
  노랑: [
    "노란 천이 햇살처럼 빛나요. 들어오는 복을 담을 그릇부터 비워 두세요.",
    "복은 문을 열어 둔 집에 들어와요. 미뤄 둔 일 하나를 오늘 끝내 보세요.",
    "노란 천에 바람이 머무네요. 작은 기쁨부터 차곡차곡 세어 보세요.",
  ],
  파랑: [
    "파란 천이 높이 걸렸어요. 시작하려던 일, 첫걸음은 생각보다 가벼워요.",
    "새로 여는 길에는 바람이 먼저 불어요. 이번 주에 한 걸음만 내디뎌 보세요.",
    "파란 하늘 같은 소원이네요. 오늘 할 일 하나를 적어 두면 길이 보여요.",
  ],
  하양: [
    "하얀 천이 고요히 흔들려요. 오늘 밤엔 조금 일찍 쉬어 가세요.",
    "평안은 작은 쉼에서 와요. 따뜻한 물 한 잔으로 하루를 닫아 보세요.",
    "하얀 천처럼 마음이 맑아지길. 몸이 보내는 말에 귀 기울여 주세요.",
  ],
  초록: [
    "초록 천이 새잎처럼 돋았어요. 배우는 일은 매일 조금씩이 제일 빨라요.",
    "자라는 것은 소리 없이 자라요. 오늘 하나만 새로 알아 두세요.",
    "초록빛 소원이 뿌리를 내렸어요. 꾸준함이 가장 큰 거름이에요.",
  ],
};

const REJECT: Record<Exclude<Extract<WishResponse, { ok: false }>["reason"], "CRISIS">, string> = {
  EMPTY: "소원을 한 줄 적어 주세요.",
  TOO_LONG: `소원은 ${WISH_MAX}자 안으로 적어 주세요.`,
  PII: "전화번호 같은 개인정보는 빼고 적어 주세요.",
  BANNED: "그 표현은 빼고 다시 적어 주세요.",
  DONE: "오늘 소원은 이미 묶었어요. 내일 또 와요.",
};

interface WishRow {
  id: string;
  user_id: string;
  with_user_id: string | null;
  with_nickname: string | null;
  by_nickname: string;
  text: string;
  color: WishColor;
  day: string;
  created_at: string;
  outcome: "yes" | "no" | null;
}

/** 보는 사람 기준: 내가 묶었으면 byNickname 없음, 같이 묶은 상대가 묶었으면 그 사람 이름 */
function toView(r: WishRow, viewer: string): WishView {
  const mine = r.user_id === viewer;
  return {
    id: r.id,
    text: r.text,
    color: r.color,
    day: r.day,
    createdAt: r.created_at,
    withNickname: mine ? r.with_nickname : null,
    byNickname: mine ? null : r.by_nickname,
    outcome: r.outcome,
  };
}

const COLS =
  "id, user_id, with_user_id, with_nickname, by_nickname, text, color, day, created_at, outcome";

export async function buildBoard(env: Env, userId: string): Promise<WishBoard> {
  const today = todayKst();
  const since = new Date(Date.now() - CLOTH_DAYS * 86_400_000).toISOString();
  const reviewBefore = new Date(Date.now() - WISH_REVIEW_DAYS * 86_400_000).toISOString();
  const [mine, cloths, counts, stoned, due] = await Promise.all([
    env.DB.prepare(
      `SELECT ${COLS} FROM wishes WHERE user_id = ?1 OR with_user_id = ?1 ORDER BY created_at DESC LIMIT 60`,
    )
      .bind(userId)
      .all<WishRow>(),
    env.DB.prepare(
      `SELECT color, user_id = ?1 OR with_user_id = ?1 AS mine, outcome = 'yes' AS gold FROM wishes
       WHERE created_at >= ?2 ORDER BY created_at DESC LIMIT ?3`,
    )
      .bind(userId, since, CLOTH_MAX)
      .all<{ color: WishColor; mine: number; gold: number | null }>(),
    env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM wishes WHERE day = ?1) AS wishes,
              (SELECT COUNT(*) FROM wish_stones WHERE day = ?1) AS stones`,
    )
      .bind(today)
      .first<{ wishes: number; stones: number }>(),
    env.DB.prepare("SELECT 1 AS x FROM wish_stones WHERE user_id = ? AND day = ?")
      .bind(userId, today)
      .first<{ x: number }>(),
    env.DB.prepare(
      `SELECT ${COLS} FROM wishes WHERE user_id = ? AND outcome IS NULL AND created_at <= ?
       ORDER BY created_at LIMIT 1`,
    )
      .bind(userId, reviewBefore)
      .first<WishRow>(),
  ]);
  const myRows = mine.results;
  const recent = cloths.results.map((c) => ({
    color: c.color,
    mine: !!c.mine,
    gold: !!c.gold,
  }));
  // 14일보다 오래된 내 천(특히 이뤄진 금빛 천)도 나무에 남긴다
  const older = myRows
    .filter((r) => r.created_at < since)
    .map((r) => ({ color: r.color, mine: true, gold: r.outcome === "yes" }));
  const todayRow = myRows.find((r) => r.user_id === userId && r.day === today) ?? null;
  return {
    today: { wish: todayRow ? toView(todayRow, userId) : null, stoned: !!stoned },
    stonesToday: counts?.stones ?? 0,
    wishesToday: counts?.wishes ?? 0,
    cloths: [...recent, ...older].slice(0, CLOTH_MAX + 30),
    mine: myRows.map((r) => toView(r, userId)),
    due: due ? toView(due, userId) : null,
  };
}

/** GET /api/wishes */
export async function getWishes(env: Env, user: User): Promise<Response> {
  await requireProfile(env, user.id);
  return json(await buildBoard(env, user.id));
}

const WishBody = z.object({
  text: z.string().max(500),
  color: z.enum(WISH_COLORS as [WishColor, ...WishColor[]]),
  requestId: z.string().min(8).max(64),
  pairCode: z
    .string()
    .regex(/^[a-z0-9]{10}$/)
    .optional(),
});

/** 글 검사 (코드만). 통과하면 null */
export function checkWish(text: string): Extract<WishResponse, { ok: false }>["reason"] | null {
  const t = text.trim();
  if (!t) return "EMPTY";
  if ([...t].length > WISH_MAX) return "TOO_LONG";
  if (CRISIS_RE.test(t.replace(/\s+/g, " "))) return "CRISIS";
  if (hasPii(t)) return "PII";
  if (findBanned(t).length) return "BANNED";
  return null;
}

/** POST /api/wishes */
export async function createWish(req: Request, env: Env, user: User): Promise<Response> {
  const body = await readBody(req, WishBody);
  const profile = await requireProfile(env, user.id);
  const text = body.text.trim().replace(/\s+/g, " ");
  const bad = checkWish(text);
  if (bad) {
    const out: WishResponse = {
      ok: false,
      reason: bad,
      message: bad === "CRISIS" ? CRISIS_TEXT : REJECT[bad],
    };
    return json(out);
  }
  // 같이 보기: 방의 상대와 같이 묶는다. 방이 끝났으면 혼자 묶기
  let withId: string | null = null;
  let withNick: string | null = null;
  if (body.pairCode) {
    try {
      const inv = await inviteForMember(env, body.pairCode, user.id);
      withId = inv.role === "host" ? inv.guest_id : inv.host_id;
      withNick = withId ? ((await loadProfile(env, withId))?.nickname ?? null) : null;
    } catch {
      withId = null;
    }
  }
  const today = todayKst();
  const row: WishRow = {
    id: crypto.randomUUID(),
    user_id: user.id,
    with_user_id: withId,
    with_nickname: withNick,
    by_nickname: profile.nickname,
    text,
    color: body.color,
    day: today,
    created_at: nowIso(),
    outcome: null,
  };
  const res = await env.DB.prepare(
    `INSERT INTO wishes (id, user_id, with_user_id, with_nickname, by_nickname, text, color, day, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, day) DO NOTHING`,
  )
    .bind(
      row.id,
      row.user_id,
      row.with_user_id,
      row.with_nickname,
      row.by_nickname,
      row.text,
      row.color,
      row.day,
      row.created_at,
    )
    .run();
  if (res.meta.changes === 0) {
    const out: WishResponse = { ok: false, reason: "DONE", message: REJECT.DONE };
    return json(out);
  }
  if (body.pairCode && withId) {
    // 상대 화면의 나무에도 바로 천이 걸린다 (상대 기준 보기)
    await notifyRoom(env, body.pairCode, { t: "wished", id: user.id, wish: toView(row, withId) });
  }
  const lines = BLESSINGS[row.color];
  const blessing = lines[Math.floor(Math.random() * lines.length)] as string;
  const out: WishResponse = {
    ok: true,
    wish: toView(row, user.id),
    blessing,
    board: await buildBoard(env, user.id),
  };
  return json(out);
}

/** POST /api/wishes/stone: 하루 한 번 */
export async function addStone(env: Env, user: User): Promise<Response> {
  await requireProfile(env, user.id);
  const today = todayKst();
  const res = await env.DB.prepare(
    "INSERT INTO wish_stones (user_id, day) VALUES (?, ?) ON CONFLICT (user_id, day) DO NOTHING",
  )
    .bind(user.id, today)
    .run();
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM wish_stones WHERE day = ?")
    .bind(today)
    .first<{ n: number }>();
  return json({ added: res.meta.changes > 0, stonesToday: n?.n ?? 0 });
}

const OutcomeBody = z.object({ outcome: z.enum(["yes", "no"]) });

/** POST /api/wishes/:id/outcome: 내가 묶은 소원만 */
export async function setOutcome(
  id: string,
  req: Request,
  env: Env,
  user: User,
): Promise<Response> {
  const body = await readBody(req, OutcomeBody);
  const res = await env.DB.prepare(
    "UPDATE wishes SET outcome = ?, outcome_at = ? WHERE id = ? AND user_id = ?",
  )
    .bind(body.outcome, nowIso(), id, user.id)
    .run();
  if (res.meta.changes === 0) throw new HttpError("NOT_FOUND", "없거나 볼 수 없는 소원이에요");
  return json(await buildBoard(env, user.id));
}
