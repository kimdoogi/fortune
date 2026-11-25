/**
 * 같이 보기 초대·참여 (F16, D-089·D-090, docs/09 §3).
 * 초대한 사람(host)이 링크를 만들고, 손님(guest)이 동의하고 들어오면 둘만의 방(`pair:<code>`)에서
 * 같이 걷는다. 점집별 같이 보는 점은 pair/readings.ts.
 */
import type { GunghapInviteCreated, GunghapInviteView, ServerMessage } from "@fortune/shared-types";
import { z } from "zod";
import type { Env } from "../env";
import { HttpError, json, readBody } from "../http";
import { loadProfile, requireProfile } from "../profile";
import type { User } from "../session";

const OPEN_MS = 30 * 60_000;
const JOINED_MS = 3 * 3_600_000;
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const CODE_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/;

export const INVITE_TEXT = {
  expired: "초대가 끝났소. 친구에게 새 링크를 받아 주시오.",
  full: "이미 다른 분이 같이 보고 있소.",
  self: "내가 만든 초대에는 손님으로 들어갈 수 없소.",
  notMember: "이 방에 같이 들어온 사람만 볼 수 있소.",
  waiting: "아직 같이 볼 분이 들어오지 않았소.",
} as const;

export const gunghapSeedKey = (code: string) => `gunghap:${code}`;

export interface InviteRow {
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

/** POST /api/pair/invites (예전: /api/gunghap/invites) */
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

/** GET /api/pair/invites/:code */
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

/** POST /api/pair/invites/:code/join */
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
export async function notifyRoom(env: Env, code: string, msg: ServerMessage) {
  try {
    const stub = env.VILLAGE.get(env.VILLAGE.idFromName(`pair:${code}`)) as unknown as {
      notify(m: ServerMessage): Promise<void>;
    };
    await stub.notify(msg);
  } catch (e) {
    console.error("pair notify failed", String(e));
  }
}
