/**
 * 같이 보는 점 (F16, D-090, docs/09 §3). 점집마다 하나:
 * 궁합(gunghap)·관계 타로(tarot_pair)·둘의 신점(sinjeom_pair)은 누구든 관계를 고르면,
 * 두 사람 꿈풀이(dream_pair)는 둘 다 꿈을 내면 풀이 하나를 만들어 두 사람 기록에 한 줄씩 저장하고 방에 알린다.
 * 카드·쌀점은 서버 seed(`pair:<code>:<product>`)로 정한다. 하루 상한은 풀이를 만든 사람만 1회.
 */
import { gunghap } from "@fortune/fortune-engine";
import { fillTemplate } from "@fortune/prompts";
import { followupMax } from "@fortune/prompts/llm";
import {
  DISCLAIMER,
  GUNGHAP_RELATIONS,
  type GunghapRelation,
  type InterpretInput,
  type InterpretResult,
  type PairDreamResponse,
  type ProductId,
  type ReadingResult,
  type ReadingVisual,
  type ShopId,
  type TarotCategory,
} from "@fortune/shared-types";
import { z } from "zod";
import type { Env } from "../env";
import { DREAM_SYMBOL_IDS, dreamSymbol } from "../facts/data";
import { buildDream, knownSymbolIds } from "../facts/dream";
import { buildGunghap } from "../facts/gunghap";
import { buildSinjeom } from "../facts/obanggi";
import { buildTarot } from "../facts/tarot";
import { filterDream } from "../filters";
import {
  INVITE_TEXT,
  type InviteRow,
  gunghapSeedKey,
  inviteForMember,
  notifyRoom,
} from "../gunghap/invites";
import { HttpError, fail, json, readBody } from "../http";
import { DREAM_CHECK_TEXT, FALLBACK } from "../personas";
import { type Profile, ZODIAC, ageBandAt, natalOf, requireProfile } from "../profile";
import { CAUTION_RISKS } from "../readings/build";
import {
  claimRequest,
  completeRequest,
  findBySeed,
  insertReading,
  releaseRequest,
  resultWithFollowups,
} from "../readings/store";
import { pickThemes } from "../readings/themes";
import { drawTarot, flagForGrade, rngFor, throwRice } from "../seed";
import type { User } from "../session";
import { nowIso, todayKst } from "../time";
import { callsLeft, reserveCall } from "../usage";

export type PairProduct = "gunghap" | "tarot_pair" | "sinjeom_pair" | "dream_pair";
const PAIR_PRODUCTS = ["gunghap", "tarot_pair", "sinjeom_pair", "dream_pair"] as const;

const SHOP_OF: Record<PairProduct, ShopId> = {
  gunghap: "saju",
  tarot_pair: "tarot",
  sinjeom_pair: "dolyeong",
  dream_pair: "dream",
};

/** 궁합은 D-089 때 정한 키를 그대로 쓴다 */
export const pairSeedKey = (code: string, product: PairProduct) =>
  product === "gunghap" ? gunghapSeedKey(code) : `pair:${code}:${product}`;

/** 관계 → 관계 타로 카테고리 (F16) */
const TAROT_CATEGORY: Record<GunghapRelation, TarotCategory> = {
  연인: "연애",
  썸: "연애",
  동료: "직장",
  친구: "오늘",
  가족: "오늘",
};

const BUSY_TEXT = "두 분 풀이를 벌써 만들고 있소. 잠시만 기다리시오.";

/** 두 사람을 함께 부르는 말 (04 §3-1, D-090) */
function pairVocative(shop: ShopId, a: string, b: string): string {
  switch (shop) {
    case "dolyeong":
      return `${fillTemplate("{닉네임}아", a)}, ${fillTemplate("{닉네임}아", b)}`;
    case "dream":
      return "아가들";
    default:
      return "두 분";
  }
}

interface Pair {
  code: string;
  invite: InviteRow & { role: "host" | "guest" };
  host: Profile;
  guest: Profile;
  today: string;
}

async function loadPair(env: Env, code: string, user: User): Promise<Pair> {
  const invite = await inviteForMember(env, code, user.id);
  if (!invite.guest_id) throw new HttpError("INVALID_INPUT", INVITE_TEXT.waiting);
  const [host, guest] = await Promise.all([
    requireProfile(env, invite.host_id),
    requireProfile(env, invite.guest_id),
  ]);
  return { code, invite, host, guest, today: todayKst() };
}

const zodiacOf = (p: Profile) => ZODIAC[natalOf(p).pillars.year.charAt(1)] ?? "";

function baseInput(
  pair: Pair,
  product: PairProduct,
  facts: string[],
  relation: GunghapRelation | null,
): InterpretInput {
  const { host, guest, today } = pair;
  const shop = SHOP_OF[product];
  return {
    shop,
    product,
    today,
    user: {
      nickname: host.nickname,
      gender: host.gender,
      ageBand: ageBandAt(natalOf(host), today),
      vocative: pairVocative(shop, host.nickname, guest.nickname),
    },
    partner: {
      nickname: guest.nickname,
      gender: guest.gender,
      ageBand: ageBandAt(natalOf(guest), today),
    },
    ...(relation ? { relation } : {}),
    facts,
    themes: pickThemes(),
    question: null,
  };
}

/** 관계를 고르는 세 점: 해석 입력과 화면 그림 */
async function planChosen(
  pair: Pair,
  product: Exclude<PairProduct, "dream_pair">,
  relation: GunghapRelation,
): Promise<{ input: InterpretInput; visual: ReadingVisual }> {
  const { host, guest, code } = pair;
  const hostNatal = natalOf(host);
  const guestNatal = natalOf(guest);
  switch (product) {
    case "gunghap": {
      const result = gunghap(hostNatal.pillars, guestNatal.pillars);
      const parts = buildGunghap(
        { nickname: host.nickname, zodiac: zodiacOf(host), natal: hostNatal },
        { nickname: guest.nickname, zodiac: zodiacOf(guest), natal: guestNatal },
        result,
        relation,
      );
      return {
        input: baseInput(pair, product, parts.facts, relation),
        visual: { shop: "saju", gunghap: parts.board },
      };
    }
    case "tarot_pair": {
      const category = TAROT_CATEGORY[relation];
      // 초대 하나에 한 판: seed는 초대한 사람 + 초대 코드
      const rng = await rngFor(pair.invite.host_id, pairSeedKey(code, product));
      const names = [`${host.nickname} 님의 마음`, `${guest.nickname} 님의 마음`, "두 사람의 앞날"];
      const drawn = drawTarot(rng, "three").map((d, i) => ({
        ...d,
        position: names[i] ?? d.position,
      }));
      const parts = buildTarot(drawn, category);
      return {
        input: {
          ...baseInput(pair, product, [`두 사람은 ${relation} 사이다.`, ...parts.facts], relation),
          spread: "three",
          category,
          cards: parts.cards,
        },
        visual: { shop: "tarot", spread: "three", category, cards: parts.views },
      };
    }
    case "sinjeom_pair": {
      const rng = await rngFor(pair.invite.host_id, pairSeedKey(code, product));
      const rice = throwRice(rng);
      const color = flagForGrade(rice.grade, rng);
      const parts = buildSinjeom(color, rice, "");
      const facts = [
        `두 손님은 ${relation} 사이다. ${host.nickname}는 ${zodiacOf(host)}띠, ${guest.nickname}는 ${zodiacOf(guest)}띠다. 아기도령이 두 사람 띠를 물어 확인했다.`,
        "아기도령이 두 사람 사이를 묻고 쌀을 한 번 던졌다.",
        ...parts.facts.slice(1),
      ];
      return {
        input: { ...baseInput(pair, product, facts, relation), flag: parts.flag },
        visual: {
          shop: "dolyeong",
          category: null,
          flag: parts.flag,
          mode: "sinjeom",
          rice: parts.rice,
        },
      };
    }
  }
}

/**
 * 풀이 만들기 공통: 한 초대·한 상품에 하나만 (잠금), 하루 상한 1회, LLM, 두 사람 기록에 저장, 방에 알림.
 * 잠금은 request_log에 `pair:<code>:<product>`로 잡는다 (먼저 잡은 사람만 만든다)
 */
async function makeReading(
  env: Env,
  ctx: ExecutionContext,
  user: User,
  pair: Pair,
  product: PairProduct,
  build: () => Promise<{ input: InterpretInput; visual: ReadingVisual }>,
  relation: GunghapRelation | null,
  after?: () => Promise<void>,
): Promise<Response> {
  const { code, invite } = pair;
  const shop = SHOP_OF[product];
  const seedKey = pairSeedKey(code, product);
  const lock = `${seedKey}:lock`;
  const claim = await claimRequest(env, lock, user.id);
  if (claim.kind === "done" || claim.kind === "busy" || claim.kind === "foreign") {
    // 이미 만든 것이 있으면 그것을, 아니면 상대가 만드는 중
    const stored = await findBySeed(env, user.id, seedKey);
    if (stored)
      return json(await resultWithFollowups(env, stored, true, await callsLeft(env, user.id)));
    throw new HttpError("RATE_LIMITED", BUSY_TEXT);
  }
  let left: number;
  let plan: { input: InterpretInput; visual: ReadingVisual };
  try {
    left = await reserveCall(env, user.id, shop);
    plan = await build();
  } catch (e) {
    await releaseRequest(env, lock);
    throw e;
  }
  if (relation) await notifyRoom(env, code, { t: "picked", id: user.id, relation, product });

  const work = (async (): Promise<Response> => {
    let r: InterpretResult;
    try {
      r = await env.READING.interpret(plan.input);
    } catch (e) {
      console.error("pair interpret rpc failed", product, String(e));
      r = { ok: false, reason: "api_error", fallback: FALLBACK[shop], promptVersion: "" };
    }
    if (!r.ok) {
      await releaseRequest(env, lock);
      const message = r.fallback || FALLBACK[shop];
      await notifyRoom(env, code, { t: "result_failed", message, product });
      return fail("LLM_UNAVAILABLE", message);
    }
    const createdAt = nowIso();
    const ids: Record<string, string> = {};
    for (const uid of [invite.host_id, invite.guest_id as string]) {
      const id = crypto.randomUUID();
      const inserted = await insertReading(env, {
        id,
        userId: uid,
        shop,
        product,
        seedKey,
        input: plan.input,
        visual: plan.visual,
        output: r.output,
        promptVersion: r.promptVersion,
        createdAt,
      });
      ids[uid] = inserted ? id : ((await findBySeed(env, uid, seedKey))?.id ?? id);
    }
    await env.DB.prepare(
      "UPDATE gunghap_invites SET status = 'done', relation = COALESCE(?, relation) WHERE code = ?",
    )
      .bind(relation, code)
      .run();
    const mine = ids[user.id] as string;
    await completeRequest(env, lock, mine);
    if (after) await after();
    await notifyRoom(env, code, { t: "result_ready", product });
    const out: ReadingResult = {
      id: mine,
      shop,
      product,
      createdAt,
      visual: plan.visual,
      output: r.output,
      reused: false,
      disclaimer: DISCLAIMER,
      todayCallsLeft: left,
      followups: [],
      followupsLeft: followupMax(product),
    };
    return json(out);
  })();
  ctx.waitUntil(work.catch((e) => console.error("pair save failed", product, String(e))));
  return work;
}

const ReadingBody = z.object({
  product: z.enum(["gunghap", "tarot_pair", "sinjeom_pair"]).default("gunghap"),
  relation: z.enum(GUNGHAP_RELATIONS),
  requestId: z.string().min(8).max(64),
});

/** POST /api/pair/:code/readings (예전: /api/gunghap/invites/:code/reading = 궁합) */
export async function createPairReading(
  code: string,
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  user: User,
): Promise<Response> {
  const body = await readBody(req, ReadingBody);
  const pair = await loadPair(env, code, user);
  const stored = await findBySeed(env, user.id, pairSeedKey(code, body.product));
  if (stored)
    return json(await resultWithFollowups(env, stored, true, await callsLeft(env, user.id)));
  return makeReading(
    env,
    ctx,
    user,
    pair,
    body.product,
    () => planChosen(pair, body.product, body.relation),
    body.relation,
  );
}

// ── 두 사람 꿈풀이 ────────────────────────────────────────
const DreamBody = z.object({ text: z.string().max(5000) });
const BLOCKED_RISKS = new Set(["sexual", "violence", "other"]);

interface DreamRow {
  user_id: string;
  text: string;
  symbols_json: string;
  risk: string;
}

const symbolViews = (ids: string[]) => ids.map((id) => ({ id, name: dreamSymbol(id)?.name ?? id }));

/** POST /api/pair/:code/dream: 내 꿈 검사·저장. 둘 다 냈으면 이 요청이 풀이를 만든다 */
export async function submitPairDream(
  code: string,
  req: Request,
  env: Env,
  ctx: ExecutionContext,
  user: User,
): Promise<Response> {
  const body = await readBody(req, DreamBody);
  const pair = await loadPair(env, code, user);
  const seedKey = pairSeedKey(code, "dream_pair");
  const stored = await findBySeed(env, user.id, seedKey);
  if (stored) {
    const result = await resultWithFollowups(env, stored, true, await callsLeft(env, user.id));
    return json({ kind: "result", result } satisfies PairDreamResponse);
  }
  const text = body.text.trim();
  const blocked = async (reason: keyof typeof DREAM_CHECK_TEXT) =>
    json({
      kind: "blocked",
      reason,
      message: DREAM_CHECK_TEXT[reason],
      todayCallsLeft: await callsLeft(env, user.id),
    } satisfies PairDreamResponse);

  // 1차 필터 (코드). 분류 호출은 상한에 세지 않는다: 풀이를 만든 사람만 1회 (F16)
  const block = filterDream(text);
  if (block) return blocked(block);
  if ((await callsLeft(env, user.id)) <= 0)
    throw new HttpError("RATE_LIMITED", "오늘은 점을 많이 봤구먼. 내일 또 와.");
  let cls: Awaited<ReturnType<Env["READING"]["classify"]>>;
  try {
    cls = await env.READING.classify({ kind: "dream", text, symbolIds: DREAM_SYMBOL_IDS });
  } catch (e) {
    console.error("pair classify rpc failed", String(e));
    cls = { ok: false, reason: "api_error" };
  }
  if (!cls.ok) throw new HttpError("LLM_UNAVAILABLE", FALLBACK.dream);
  if (cls.risk === "self_harm") return blocked("CRISIS");
  if (BLOCKED_RISKS.has(cls.risk)) return blocked("BLOCKED");
  const ids = knownSymbolIds(cls.symbols);
  if (ids.length === 0) return blocked("NO_SYMBOLS");

  await env.DB.prepare(
    `INSERT INTO pair_dreams (code, user_id, text, symbols_json, risk, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (code, user_id) DO UPDATE SET text = excluded.text, symbols_json = excluded.symbols_json,
       risk = excluded.risk, created_at = excluded.created_at`,
  )
    .bind(code, user.id, text, JSON.stringify(ids), cls.risk, nowIso())
    .run();
  await notifyRoom(env, code, { t: "submitted", id: user.id, product: "dream_pair" });

  const rows = (
    await env.DB.prepare("SELECT user_id, text, symbols_json, risk FROM pair_dreams WHERE code = ?")
      .bind(code)
      .all<DreamRow>()
  ).results;
  const hostRow = rows.find((r) => r.user_id === pair.invite.host_id);
  const guestRow = rows.find((r) => r.user_id === pair.invite.guest_id);
  const symbols = symbolViews(ids);
  if (!hostRow || !guestRow) {
    return json({
      kind: "waiting",
      symbols,
      todayCallsLeft: await callsLeft(env, user.id),
    } satisfies PairDreamResponse);
  }

  const build = async () => {
    const people = [
      { p: pair.host, row: hostRow },
      { p: pair.guest, row: guestRow },
    ].map(({ p, row }) => ({
      nickname: p.nickname,
      dream: row.text,
      risk: row.risk,
      parts: buildDream(JSON.parse(row.symbols_json) as string[]),
    }));
    const facts = people.flatMap((x) => x.parts.facts.map((f) => `${x.nickname} 님 ${f}`));
    const input: InterpretInput = {
      ...baseInput(pair, "dream_pair", facts, (pair.invite.relation as GunghapRelation) ?? null),
      dreams: people.map((x) => ({
        nickname: x.nickname,
        dream: x.dream,
        symbols: x.parts.symbols,
      })),
    };
    if (people.some((x) => (CAUTION_RISKS as readonly string[]).includes(x.risk)))
      input.caution = true;
    const visual: ReadingVisual = {
      shop: "dream",
      pair: people.map((x) => ({
        nickname: x.nickname,
        dream: x.dream,
        symbols: x.parts.symbols.map(({ id, name }) => ({ id, name })),
      })),
    };
    return { input, visual };
  };
  // 풀이를 만들면 꿈 글은 지운다 (입력에만 남는다)
  const cleanup = async () => {
    await env.DB.prepare("DELETE FROM pair_dreams WHERE code = ?").bind(code).run();
  };
  let res: Response;
  try {
    res = await makeReading(env, ctx, user, pair, "dream_pair", build, null, cleanup);
  } catch (e) {
    if (e instanceof HttpError && e.message === BUSY_TEXT)
      return json({ kind: "making", symbols } satisfies PairDreamResponse);
    throw e;
  }
  if (!res.ok) return res;
  const result = (await res.json()) as ReadingResult;
  return json({ kind: "result", result } satisfies PairDreamResponse);
}

/** GET /api/pair/:code/result?product= : 내 기록의 같이 본 결과 */
export async function getPairResult(
  code: string,
  product: string | null,
  env: Env,
  user: User,
): Promise<Response> {
  const p = (PAIR_PRODUCTS as readonly string[]).includes(product ?? "")
    ? (product as PairProduct)
    : "gunghap";
  await inviteForMember(env, code, user.id);
  const row = await findBySeed(env, user.id, pairSeedKey(code, p));
  if (!row) throw new HttpError("NOT_FOUND", "아직 풀이가 나오지 않았소.");
  return json(await resultWithFollowups(env, row, true, await callsLeft(env, user.id)));
}

export const isPairProduct = (p: ProductId): p is PairProduct =>
  (PAIR_PRODUCTS as readonly string[]).includes(p);
