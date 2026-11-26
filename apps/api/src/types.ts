/**
 * 족집게집 60유형 도감과 내 유형 카드 (F19, D-101). LLM을 부르지 않고 하루 상한에 세지 않는다.
 * - GET /api/types/me: 내 유형 + 60유형 모두와의 맞음
 * - POST /api/type-cards: 내 카드 링크 (한 사람 하나, 다시 만들면 같은 코드)
 * - GET /api/type-cards/:code: 주인 닉네임·유형 + 보는 사람 프로필이 있으면 둘의 맞음
 */
import { allTypeMatches, analyzePillars, typeMatch } from "@fortune/fortune-engine";
import type { MyTypesResponse, TypeCardCreated, TypeCardView } from "@fortune/shared-types";
import type { Env } from "./env";
import { natureTypeOf } from "./facts/nature";
import { newInviteCode } from "./gunghap/invites";
import { HttpError, json } from "./http";
import { type Profile, loadProfile, natalOf, requireProfile } from "./profile";
import type { User } from "./session";
import { nowIso } from "./time";

/** 결과의 세 가지로 정한 60유형 (02 §5-10) */
export const typeOf = (p: Profile): string => natureTypeOf(analyzePillars(natalOf(p).pillars));

export async function getMyTypes(env: Env, user: User): Promise<Response> {
  const type = typeOf(await requireProfile(env, user.id));
  const out: MyTypesResponse = { type, matches: allTypeMatches(type) };
  return json(out);
}

export async function createTypeCard(req: Request, env: Env, user: User): Promise<Response> {
  await requireProfile(env, user.id);
  const existing = await env.DB.prepare("SELECT code FROM type_cards WHERE user_id = ?")
    .bind(user.id)
    .first<{ code: string }>();
  let code = existing?.code;
  if (!code) {
    code = newInviteCode();
    await env.DB.prepare(
      "INSERT INTO type_cards (code, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO NOTHING",
    )
      .bind(code, user.id, nowIso())
      .run();
    // 동시에 두 번 눌렀으면 먼저 저장된 코드를 쓴다
    const row = await env.DB.prepare("SELECT code FROM type_cards WHERE user_id = ?")
      .bind(user.id)
      .first<{ code: string }>();
    code = row?.code ?? code;
  }
  const origin = new URL(req.url).origin;
  const out: TypeCardCreated = { code, url: `${origin}/?t=${code}` };
  return json(out);
}

export async function getTypeCard(code: string, env: Env, user: User): Promise<Response> {
  const row = await env.DB.prepare("SELECT user_id FROM type_cards WHERE code = ?")
    .bind(code)
    .first<{ user_id: string }>();
  const owner = row ? await loadProfile(env, row.user_id) : null;
  if (!row || !owner)
    throw new HttpError("NOT_FOUND", "이 카드는 찾을 수 없네. 친구에게 새 링크를 받아 주게");
  const type = typeOf(owner);
  const mine = row.user_id === user.id;
  const me = mine ? owner : await loadProfile(env, user.id);
  const viewerType = me ? typeOf(me) : null;
  const out: TypeCardView = {
    nickname: owner.nickname,
    type,
    mine,
    viewer: viewerType ? { type: viewerType, match: typeMatch(viewerType, type) } : null,
  };
  return json(out);
}
