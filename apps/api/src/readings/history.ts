/** 점 기록: 목록·다시 보기·삭제 (F10). 다시 보기는 LLM을 부르지 않는다 */
import type { ReadingList, ReadingListItem } from "@fortune/shared-types";
import { fromBase64Url, toBase64Url } from "../crypto";
import type { Env } from "../env";
import { HttpError, json, noContent } from "../http";
import type { User } from "../session";
import { callsLeft } from "../usage";
import { findById, toResult } from "./store";

export const PAGE_SIZE = 20;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** 커서 = base64url(JSON [created_at, id]). 클라이언트는 내용을 몰라도 된다 */
export const encodeCursor = (createdAt: string, id: string) =>
  toBase64Url(enc.encode(JSON.stringify([createdAt, id])));

export function decodeCursor(cursor: string): [string, string] | null {
  try {
    const v = JSON.parse(dec.decode(fromBase64Url(cursor))) as unknown;
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      typeof v[0] === "string" &&
      typeof v[1] === "string"
    ) {
      return [v[0], v[1]];
    }
  } catch {
    // 아래에서 null
  }
  return null;
}

const notFound = () => new HttpError("NOT_FOUND", "찾을 수 없는 기록이에요");

export async function listReadings(url: URL, env: Env, user: User): Promise<Response> {
  const raw = url.searchParams.get("cursor");
  const cursor = raw ? decodeCursor(raw) : null;
  if (raw && !cursor) throw new HttpError("INVALID_INPUT", "입력 형식이 올바르지 않아요");
  const stmt = cursor
    ? env.DB.prepare(
        `SELECT id, shop, product, created_at, summary FROM readings
         WHERE user_id = ?1 AND (created_at < ?2 OR (created_at = ?2 AND id < ?3))
         ORDER BY created_at DESC, id DESC LIMIT ?4`,
      ).bind(user.id, cursor[0], cursor[1], PAGE_SIZE + 1)
    : env.DB.prepare(
        `SELECT id, shop, product, created_at, summary FROM readings
         WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2`,
      ).bind(user.id, PAGE_SIZE + 1);
  const { results } = await stmt.all<{
    id: string;
    shop: ReadingListItem["shop"];
    product: ReadingListItem["product"];
    created_at: string;
    summary: string;
  }>();
  const page = results.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  const out: ReadingList = {
    items: page.map((r) => ({
      id: r.id,
      shop: r.shop,
      product: r.product,
      createdAt: r.created_at,
      summary: r.summary,
    })),
    nextCursor: results.length > PAGE_SIZE && last ? encodeCursor(last.created_at, last.id) : null,
  };
  return json(out);
}

export async function getReading(id: string, env: Env, user: User): Promise<Response> {
  const row = await findById(env, user.id, id);
  if (!row) throw notFound();
  return json(toResult(row, true, await callsLeft(env, user.id)));
}

/** 삭제 (D-055). 같은 seed로 다시 보면 새로 생성된다 (F10) */
export async function deleteReading(id: string, env: Env, user: User): Promise<Response> {
  const [res] = await env.DB.batch([
    env.DB.prepare("DELETE FROM readings WHERE id = ? AND user_id = ?").bind(id, user.id),
    env.DB.prepare("DELETE FROM request_log WHERE reading_id = ? AND user_id = ?").bind(
      id,
      user.id,
    ),
  ]);
  if (!res?.meta.changes) throw notFound();
  return noContent();
}
