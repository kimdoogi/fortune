/**
 * 상품별 seed_key 와 해석 입력 만들기 (docs/04 §3, docs/03, F05~F08).
 * 엔진 계산·카드·깃발 결정은 모두 여기(서버)에서 한다.
 */
import { analyzePillars, computeDaewoon, sewoonOfYear } from "@fortune/fortune-engine";
import type {
  AgeBand,
  ClassifyRisk,
  InterpretInput,
  ProductId,
  ReadingRequest,
  ReadingVisual,
  ShopId,
} from "@fortune/shared-types";
import { buildDream } from "../facts/dream";
import { buildObanggi } from "../facts/obanggi";
import { buildSajuFull } from "../facts/saju";
import { buildTarot } from "../facts/tarot";
import { type Profile, natalOf } from "../profile";
import {
  drawTarot,
  dreamSeedKey,
  obanggiSeedKey,
  pickFlag,
  rngFor,
  sajuSeedKey,
  tarotSeedKey,
} from "../seed";

/** 꿈 검사 결과 (checks 행) */
export interface DreamCheck {
  text: string;
  symbolIds: string[];
  risk: ClassifyRisk;
}

export interface Plan {
  shop: ShopId;
  product: ProductId;
  seedKey: string;
  /** seed 저장본이 없을 때만 부른다 */
  build: () => Promise<{ input: InterpretInput; visual: ReadingVisual }>;
}

/** 해석 입력에 caution을 넣는 위험 분류 (docs/04 §6) */
export const CAUTION_RISKS: readonly ClassifyRisk[] = ["medical", "legal", "investment"];

export interface PlanContext {
  userId: string;
  profile: Profile;
  ageBand: AgeBand;
  today: string;
  /** dream일 때만 */
  check?: DreamCheck;
}

function base(ctx: PlanContext, shop: ShopId, product: ProductId, facts: string[]): InterpretInput {
  return {
    shop,
    product,
    today: ctx.today,
    user: { nickname: ctx.profile.nickname, gender: ctx.profile.gender, ageBand: ctx.ageBand },
    facts,
    question: null,
  };
}

export async function planReading(req: ReadingRequest, ctx: PlanContext): Promise<Plan> {
  switch (req.shop) {
    case "saju": {
      const year = Number(ctx.today.slice(0, 4));
      return {
        shop: "saju",
        product: req.product,
        seedKey: sajuSeedKey(ctx.profile.profileVersion, year),
        build: async () => {
          const natal = natalOf(ctx.profile);
          const analysis = analyzePillars(natal.pillars);
          const daewoon = computeDaewoon(
            natal,
            ctx.profile.gender,
            ctx.today,
            natal.pillars.hour === null,
          );
          const sewoon = sewoonOfYear(year, natal.pillars);
          const parts = buildSajuFull(natal, analysis, daewoon, sewoon);
          return {
            input: {
              ...base(ctx, "saju", req.product, parts.facts),
              chart: parts.chart,
              luck: parts.luck,
            },
            visual: { shop: "saju", board: parts.board },
          };
        },
      };
    }
    case "tarot": {
      const seedKey = tarotSeedKey(ctx.today, req.product, req.category);
      const spread = req.product === "tarot_one" ? "one" : "three";
      return {
        shop: "tarot",
        product: req.product,
        seedKey,
        build: async () => {
          const drawn = drawTarot(await rngFor(ctx.userId, seedKey), spread);
          const parts = buildTarot(drawn, req.category);
          return {
            input: {
              ...base(ctx, "tarot", req.product, parts.facts),
              spread,
              category: req.category,
              cards: parts.cards,
            },
            visual: { shop: "tarot", spread, category: req.category, cards: parts.views },
          };
        },
      };
    }
    case "dolyeong": {
      const seedKey = obanggiSeedKey(ctx.today, req.category);
      return {
        shop: "dolyeong",
        product: "obanggi",
        seedKey,
        build: async () => {
          const color = pickFlag(await rngFor(ctx.userId, seedKey));
          const parts = buildObanggi(color, req.category);
          const input: InterpretInput = {
            ...base(ctx, "dolyeong", "obanggi", parts.facts),
            flag: parts.flag,
            category: req.category,
          };
          if (req.category === "건강") input.caution = true; // F07
          return { input, visual: { shop: "dolyeong", category: req.category, flag: parts.flag } };
        },
      };
    }
    case "dream": {
      const check = ctx.check;
      if (!check) throw new Error("dream plan needs a check");
      return {
        shop: "dream",
        product: "dream",
        seedKey: await dreamSeedKey(ctx.today, check.text),
        build: async () => {
          const parts = buildDream(check.symbolIds);
          const input: InterpretInput = {
            ...base(ctx, "dream", "dream", parts.facts),
            dream: check.text,
            symbols: parts.symbols,
          };
          if (CAUTION_RISKS.includes(check.risk)) input.caution = true;
          return {
            input,
            visual: {
              shop: "dream",
              dream: check.text,
              symbols: parts.symbols.map(({ id, name }) => ({ id, name })),
            },
          };
        },
      };
    }
  }
}
