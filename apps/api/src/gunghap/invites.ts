/**
 * 궁합 초대·참여·풀이 (F16, D-089, docs/09 §3).
 * 초대한 사람(host)이 링크를 만들고, 손님(guest)이 동의하고 들어오면 둘만의 방(`pair:<code>`)에서 같이 걷고,
 * 누구든 관계를 고르면 풀이 하나를 만들어 두 사람 기록에 한 줄씩 저장하고 방에 알린다.
 */
import { gunghap } from "@fortune/fortune-engine";
import { followupMax } from "@fortune/prompts/llm";
import {
  DISCLAIMER,
  GUNGHAP_RELATIONS,
  type GunghapInviteCreated,
  type GunghapInviteView,
  type InterpretInput,
  type InterpretResult,
  type ReadingResult,
  type ServerMessage,
} from "@fortune/shared-types";
import { z } from "zod";
import type { Env } from "../env";
import { buildGunghap } from "../facts/gunghap";
import { HttpError, fail, json, readBody } from "../http";
import { FALLBACK, IN_FLIGHT_TEXT } from "../personas";
import { ZODIAC, ageBandAt, loadProfile, natalOf, requireProfile } from "../profile";
import {
  claimRequest,
  completeRequest,
  findBySeed,
  insertReading,
  releaseRequest,
  resultWithFollowups,
} from "../readings/store";
import type { User } from "../session";
import { nowIso, todayKst } from "../time";
import { callsLeft, reserveCall } from "../usage";

const OPEN_MS = 30 * 60_000;
const JOINED_MS = 3 * 3_600_000;
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const CODE_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/;

export const INVITE_TEXT = {
  expired: "초대가 끝났소. 친구에게 새 링크를 받아 주시오.",
  full: "이미 다른 분이 같이 보고 있소.",
  self: "내가 만든 초대에는 손님으로 들어갈 수 없소.",
  notMember: "이 궁합 방에 들어온 사람만 볼 수 있소.",
  waiting: "아직 같이 볼 분이 들어오지 않았소.",
} as const;

export const gunghapSeedKey = (code: string) => `gunghap:${code}`;

interface InviteRow {
  code: string;
  host_id: string;
  guest_id: string | null;
  status: "open" | "joined" | "done";
  relation: string | null;
  created_at: string;
  expires_at: string;
}

export function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function loadInvite(env: Env, code: string): Promise<InviteRow> {
  if (!CODE_RE.test(code)) throw new HttpError("NOT_FOUND", INVITE_TEXT.expired);
  const row = await env.DB.prepare("SELECT * FROM gunghap_invites WHERE code = ?")
    .bind(code)
    .first<InviteRow>();
  if (!row || Date.parse(row.expires_at) < Date.now())
    throw new HttpError("NOT_FOUND", INVITE_TEXT.expired);
  return row;
}

/** 초대한 사람 또는 손님만. 아니면 403 대신 NOT_FOUND로 숨긴다 */
export async function inviteForMember(
  env: Env,
  code: string,
  userId: string,
): Promise<InviteRow & { role: "host" | "guest" }> {
  const row = await loadInvite(env, code);
  if (row.host_id === userId) return { ...row, role: "host" };
  if (row.guest_id === userId) return { ...row, role: "guest" };
  throw new HttpError("NOT_FOUND", INVITE_TEXT.notMember);
}

const ConsentBody = z.object({ consent: z.literal(true) });

/** POST /api/gunghap/invites */
export async function createInvite(req: Request, env: Env, user: User): Promise<Response> {
  await readBody(req, ConsentBody);
  await requireProfile(env, user.id);
  const code = newInviteCode();
  const now = Date.now();
  const expiresAt = new Date(now + OPEN_MS).toISOString();
  await env.DB.prepare(
    "INSERT INTO gunghap_invites (code, host_id, status, created_at, expires_at) VALUES (?, ?, 'open', ?, ?)",
  )
    .bind(code, user.id, new Date(now).toISOString(), expiresAt)
    .run();
  const origin = new URL(req.url).origin;
  const out: GunghapInviteCreated = { code, url: `${origin}/?g=${code}`, expiresAt };
  return json(out);
}

async function nicknameOf(env: Env, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  return (await loadProfile(env, userId))?.nickname ?? "손님";
}

/** GET /api/gunghap/invites/:code */
export async function viewInvite(code: string, env: Env, user: User): Promise<Response> {
  const row = await loadInvite(env, code);
  const role = row.host_id === user.id ? "host" : row.guest_id === user.id ? "guest" : "none";
  const out: GunghapInviteView = {
    code,
    hostNickname: (await nicknameOf(env, row.host_id)) ?? "손님",
    guestNickname: await nicknameOf(env, row.guest_id),
    status: row.status,
    role,
    full: role === "none" && row.guest_id !== null,
    relation: (row.relation as GunghapInviteView["relation"]) ?? null,
  };
  return json(out);
}

/** POST /api/gunghap/invites/:code/join */
export async function joinInvite(
  code: string,
  req: Request,
  env: Env,
  user: User,
): Promise<Response> {
  await readBody(req, ConsentBody);
  await requireProfile(env, user.id);
  const row = await loadInvite(env, code);
  if (row.host_id === user.id) throw new HttpError("INVALID_INPUT", INVITE_TEXT.self);
  if (row.guest_id && row.guest_id !== user.id)
    throw new HttpError("INVALID_INPUT", INVITE_TEXT.full);
  if (!row.guest_id) {
    // 동시에 두 사람이 누르면 먼저 쓴 쪽만 들어간다
    const res = await env.DB.prepare(
      "UPDATE gunghap_invites SET guest_id = ?, status = 'joined', expires_at = ? WHERE code = ? AND guest_id IS NULL",
    )
      .bind(user.id, new Date(Date.now() + JOINED_MS).toISOString(), code)
      .run();
    if (res.meta.changes === 0) throw new HttpError("INVALID_INPUT", INVITE_TEXT.full);
  }
  return viewInvite(code, env, user);
}

/** 방에 알림 (DO RPC, docs/15 §4) */
async function notifyRoom(env: Env, code: string, msg: ServerMessage) {
  try {
    const stub = env.VILLAGE.get(env.VILLAGE.idFromName(`pair:${code}`)) as unknown as {
      notify(m: ServerMessage): Promise<void>;
    };
    await stub.notify(msg);
  } catch (e) {
    console.error("pair notify failed", String(e));
  }
}

const ReadingBody = z.object({
  relation: z.enum(GUNGHAP_RELATIONS),
  requestId: z.string().min(8).max(64),
});

/** POST /api/gunghap/invites/:code/reading */
export async function createGunghapReading(
  code: string,
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  user: User,
): Promise<Response> {
  const body = await readBody(req, ReadingBody);
  const invite = await inviteForMember(env, code, user.id);
  if (!invite.guest_id) throw new HttpError("INVALID_INPUT", INVITE_TEXT.waiting);
  const seedKey = gunghapSeedKey(code);

  // 이미 만든 풀이가 있으면 그대로 (초대 하나에 풀이 하나)
  const stored = await findBySeed(env, user.id, seedKey);
  if (stored)
    return json(await resultWithFollowups(env, stored, true, await callsLeft(env, user.id)));

  const [hostP, guestP] = await Promise.all([
    requireProfile(env, invite.host_id),
    requireProfile(env, invite.guest_id),
  ]);
  const today = todayKst();
  const hostNatal = natalOf(hostP);
  const guestNatal = natalOf(guestP);
  const zodiacOf = (n: typeof hostNatal) => ZODIAC[n.pillars.year.charAt(1)] ?? "";
  const result = gunghap(hostNatal.pillars, guestNatal.pillars);
  const parts = buildGunghap(
    { nickname: hostP.nickname, zodiac: zodiacOf(hostNatal), natal: hostNatal },
    { nickname: guestP.nickname, zodiac: zodiacOf(guestNatal), natal: guestNatal },
    result,
    body.relation,
  );
  const input: InterpretInput = {
    shop: "saju",
    product: "gunghap",
    today,
    user: {
      nickname: hostP.nickname,
      gender: hostP.gender,
      ageBand: ageBandAt(hostNatal, today),
      // 둘이 함께 듣는다 (04a 궁합 지시)
      vocative: "두 분",
    },
    partner: {
      nickname: guestP.nickname,
      gender: guestP.gender,
      ageBand: ageBandAt(guestNatal, today),
    },
    relation: body.relation,
    facts: parts.facts,
    question: null,
  };
  const visual = { shop: "saju" as const, gunghap: parts.board };

  const claim = await claimRequest(env, body.requestId, user.id);
  if (claim.kind === "foreign") throw new HttpError("INVALID_INPUT", "입력 형식이 올바르지 않아요");
  if (claim.kind !== "claimed") throw new HttpError("RATE_LIMITED", IN_FLIGHT_TEXT);
  let left: number;
  try {
    left = await reserveCall(env, user.id, "saju");
  } catch (e) {
    await releaseRequest(env, body.requestId);
    throw e;
  }
  await notifyRoom(env, code, { t: "picked", id: user.id, relation: body.relation });

  const work = (async (): Promise<Response> => {
    let r: InterpretResult;
    try {
      r = await env.READING.interpret(input);
    } catch (e) {
      console.error("gunghap interpret rpc failed", String(e));
      r = { ok: false, reason: "api_error", fallback: FALLBACK.saju, promptVersion: "" };
    }
    if (!r.ok) {
      await releaseRequest(env, body.requestId);
      const message = r.fallback || FALLBACK.saju;
      await notifyRoom(env, code, { t: "result_failed", message });
      return fail("LLM_UNAVAILABLE", message);
    }
    const createdAt = nowIso();
    const ids: Record<string, string> = {};
    for (const uid of [invite.host_id, invite.guest_id as string]) {
      const id = crypto.randomUUID();
      const inserted = await insertReading(env, {
        id,
        userId: uid,
        shop: "saju",
        product: "gunghap",
        seedKey,
        input,
        visual,
        output: r.output,
        promptVersion: r.promptVersion,
        createdAt,
      });
      ids[uid] = inserted ? id : ((await findBySeed(env, uid, seedKey))?.id ?? id);
    }
    await env.DB.prepare("UPDATE gunghap_invites SET status = 'done', relation = ? WHERE code = ?")
      .bind(body.relation, code)
      .run();
    const mine = ids[user.id] as string;
    await completeRequest(env, body.requestId, mine);
    await notifyRoom(env, code, { t: "result_ready" });
    const out: ReadingResult = {
      id: mine,
      shop: "saju",
      product: "gunghap",
      createdAt,
      visual,
      output: r.output,
      reused: false,
      disclaimer: DISCLAIMER,
      todayCallsLeft: left,
      followups: [],
      followupsLeft: followupMax("gunghap"),
    };
    return json(out);
  })();
  ctx.waitUntil(work.catch((e) => console.error("gunghap save failed", String(e))));
  return work;
}

/** GET /api/gunghap/invites/:code/result: 내 기록의 궁합 결과 */
export async function getGunghapResult(code: string, env: Env, user: User): Promise<Response> {
  await inviteForMember(env, code, user.id);
  const row = await findBySeed(env, user.id, gunghapSeedKey(code));
  if (!row) throw new HttpError("NOT_FOUND", "아직 풀이가 나오지 않았소.");
  return json(await resultWithFollowups(env, row, true, await callsLeft(env, user.id)));
}
