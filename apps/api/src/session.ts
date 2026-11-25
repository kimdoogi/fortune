/** 비회원 계정과 기기 토큰 (F14, docs/09 §1) */
import type { SessionResponse } from "@fortune/shared-types";
import { z } from "zod";
import { randomToken, sha256Hex } from "./crypto";
import type { Env } from "./env";
import { HttpError, json, noContent, readBody } from "./http";
import { nowIso, todayKst } from "./time";
import { DAILY_CALLS, callsLeft } from "./usage";

export const COOKIE = "fsid";
const MAX_AGE = 365 * 24 * 3600;
/** IP당 하루 새 계정 수 (F14) */
export const ACCOUNTS_PER_IP = 5;

export interface User {
  id: string;
  lastSeenAt: string;
}

export function readCookie(req: Request, name = COOKIE): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim() || null;
  }
  return null;
}

export const sessionCookie = (token: string) =>
  `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
const clearCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

async function findUser(env: Env, token: string): Promise<User | null> {
  const row = await env.DB.prepare(
    "SELECT id, last_seen_at FROM users WHERE token_hash = ? AND status = 'active'",
  )
    .bind(await sha256Hex(token))
    .first<{ id: string; last_seen_at: string }>();
  return row ? { id: row.id, lastSeenAt: row.last_seen_at } : null;
}

/** 마지막 접속 시각은 하루에 한 번만 고친다 (보관 기간 2년 계산용, docs/09 §4) */
async function touch(env: Env, user: User): Promise<void> {
  if (todayKst(Date.parse(user.lastSeenAt)) === todayKst()) return;
  await env.DB.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?")
    .bind(nowIso(), user.id)
    .run();
}

/** 인증이 필요한 경로. 쿠키가 없거나 모르는 토큰이면 401 */
export async function requireUser(req: Request, env: Env): Promise<User> {
  const token = readCookie(req);
  const user = token ? await findUser(env, token) : null;
  if (!user) throw new HttpError("UNAUTHORIZED", "다시 접속해 주세요");
  await touch(env, user);
  return user;
}

const SessionBody = z.object({ turnstileToken: z.string().max(4096).optional() }).optional();

async function verifyTurnstile(env: Env, token: string | undefined, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true; // 위젯을 만들기 전까지는 건너뛴다 (F14)
  if (!token) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (ip !== "local") form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  }).catch(() => null);
  if (!res?.ok) return false;
  const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
  return data?.success === true;
}

async function hasProfile(env: Env, userId: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT 1 AS x FROM profiles WHERE user_id = ?")
    .bind(userId)
    .first();
  return row !== null;
}

/** POST /api/session: 쿠키가 있으면 그 계정, 없으면 새 계정 (F14) */
export async function postSession(req: Request, env: Env): Promise<Response> {
  const body = await readBody(req, SessionBody);
  const token = readCookie(req);
  const existing = token ? await findUser(env, token) : null;
  if (existing && token) {
    await touch(env, existing);
    const res: SessionResponse = {
      userId: existing.id,
      hasProfile: await hasProfile(env, existing.id),
      todayCallsLeft: await callsLeft(env, existing.id),
    };
    // 접속할 때마다 1년으로 다시 연장
    return json(res, 200, { "set-cookie": sessionCookie(token) });
  }

  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  if (!(await verifyTurnstile(env, body?.turnstileToken, ip))) {
    throw new HttpError("INVALID_INPUT", "자동 접속 확인에 실패했어요. 다시 시도해 주세요");
  }

  // IP는 날짜를 섞어 해시만 남긴다. 6번째부터는 그날 새 계정을 만들지 않는다
  const date = todayKst();
  const ipHash = await sha256Hex(`account:${date}:${ip}`);
  const slot = await env.DB.prepare(
    `INSERT INTO account_creations (ip_hash, date, count) VALUES (?1, ?2, 1)
     ON CONFLICT (ip_hash, date) DO UPDATE SET count = count + 1 WHERE count < ?3
     RETURNING count`,
  )
    .bind(ipHash, date, ACCOUNTS_PER_IP)
    .first<{ count: number }>();
  if (!slot) {
    throw new HttpError(
      "ACCOUNT_LIMIT",
      "오늘은 이 곳에서 새로 시작할 수 있는 횟수를 다 썼어요. 내일 다시 와 주세요",
    );
  }

  const userId = crypto.randomUUID();
  const newToken = randomToken();
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO users (id, token_hash, created_at, last_seen_at, auth_provider, status)
     VALUES (?, ?, ?, ?, NULL, 'active')`,
  )
    .bind(userId, await sha256Hex(newToken), now, now)
    .run();
  const res: SessionResponse = { userId, hasProfile: false, todayCallsLeft: DAILY_CALLS };
  return json(res, 200, { "set-cookie": sessionCookie(newToken) });
}

/** 사용자의 모든 행을 지운다 (D-055: 즉시 삭제, 유예 없음) */
export async function deleteUserData(env: Env, userId: string): Promise<void> {
  const tables = ["readings", "checks", "request_log", "daily_usage", "profiles"];
  await env.DB.batch([
    ...tables.map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(userId)),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId),
  ]);
}

/** DELETE /api/session: 내 정보 삭제 + 쿠키 지우기 (F14) */
export async function deleteSession(req: Request, env: Env): Promise<Response> {
  const user = await requireUser(req, env);
  await deleteUserData(env, user.id);
  return noContent({ "set-cookie": clearCookie() });
}
