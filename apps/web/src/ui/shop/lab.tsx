import { greetings } from "@fortune/prompts";
/**
 * 개발용 화면 실험실 (ui-lab.html). 서버 없이 점집 안 화면을 확인한다. 배포 빌드에 들어가지 않는다.
 * 주소 파라미터
 *   ?shop=saju|tarot|dolyeong|dream
 *   &view=shop(기본)|result|crisis|cards   &product=saju_full…   &animate=0
 *   &err=daily|llm|network|profile|unauth   (첫 점 보기 요청만 실패, 다시 해 보기는 성공)
 *   &hour=unknown  &replay=1(다시 보기 있음)  &delay=2200(응답 지연 ms)  &dolflag=파랑
 * 꿈: "죽고 싶" 같은 글은 위기 안내, 숫자 010-…은 개인정보 안내, 5자 미만은 짧다는 안내.
 */
import {
  type CheckRequest,
  type FlagColor,
  type FlagGrade,
  PRODUCT_NAMES,
  type ProductId,
  type ReadingRequest,
  type ReadingResult,
  SHOP_PRODUCTS,
  type ShopId,
} from "@fortune/shared-types";
import { render } from "preact";
import { useState } from "preact/hooks";
import { ApiFailure, api } from "../../api/client";
import { CrisisScreen, ResultView } from "../reading/ResultView";
import { TAROT_NAMES, TarotBack, TarotFace } from "../reading/tarotArt";
import { type NpcAction, ShopScreen } from "./ShopScreen";
import { CHARACTERS } from "./characters";
import { LAB_DISCLAIMER, LAB_OUTPUT, LAB_PROFILE, labVisual } from "./labData";
import "../styles.css";

const q = new URLSearchParams(location.search);
const SHOPS: ShopId[] = ["saju", "tarot", "dolyeong", "dream"];
const shop = SHOPS.find((s) => s === q.get("shop")) ?? "saju";
const view = q.get("view") ?? "shop";
const err = q.get("err");
const delay = Number(q.get("delay") ?? 2200);
const hourUnknown = q.get("hour") === "unknown";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let calls = 24;
let failedOnce = false;

const profile = hourUnknown
  ? { ...LAB_PROFILE, birthTime: { kind: "unknown" as const } }
  : LAB_PROFILE;

function sample(product: ProductId, category?: string, reused = false): ReadingResult {
  const visual = labVisual(product, { hourUnknown, category });
  if (visual.shop === "dolyeong") {
    const color = (q.get("dolflag") as FlagColor | null) ?? visual.flag.color;
    const grades: Record<FlagColor, FlagGrade> = {
      빨강: "대길",
      노랑: "길",
      하양: "길",
      초록: "평",
      파랑: "주의",
    };
    visual.flag = { color, grade: grades[color] ?? "길" };
  }
  return {
    id: `lab-${product}`,
    shop:
      (Object.keys(SHOP_PRODUCTS) as ShopId[]).find((s) => SHOP_PRODUCTS[s].includes(product)) ??
      shop,
    product,
    createdAt: new Date().toISOString(),
    visual,
    output: LAB_OUTPUT[product],
    reused,
    disclaimer: LAB_DISCLAIMER,
    todayCallsLeft: calls,
  };
}

function maybeFail() {
  if (!err || failedOnce) return;
  failedOnce = true;
  const c = CHARACTERS[shop];
  switch (err) {
    case "daily":
      throw new ApiFailure(
        "DAILY_LIMIT",
        greetings[shop].dailyLimit[0]?.replace("{닉네임}", "하늘") ?? "",
        429,
      );
    case "llm":
      throw new ApiFailure("LLM_UNAVAILABLE", c.fallback, 503);
    case "network":
      throw new ApiFailure("NETWORK", "인터넷 연결을 확인해 주세요", 0);
    case "profile":
      throw new ApiFailure("PROFILE_REQUIRED", "프로필이 필요해요", 409);
    case "unauth":
      throw new ApiFailure("UNAUTHORIZED", "다시 들어와 주세요", 401);
  }
}

// 진짜 api 객체를 바꿔 끼운다 (ui/app/mock.ts와 같은 방식)
Object.assign(api, {
  async menu(s: ShopId) {
    await sleep(350);
    return {
      shop: s,
      items: SHOP_PRODUCTS[s].map((product) => ({
        product,
        name: PRODUCT_NAMES[product],
        todayReadingId: q.get("replay") === "1" && product !== "daily" ? `lab-${product}` : null,
      })),
    };
  },
  async read(req: ReadingRequest) {
    await sleep(delay);
    maybeFail();
    calls = Math.max(0, calls - 1);
    return sample(req.product, "category" in req ? req.category : undefined);
  },
  async get(id: string) {
    await sleep(300);
    return sample(id.replace("lab-", "") as ProductId, undefined, true);
  },
  async check(req: CheckRequest) {
    await sleep(900);
    const t = req.text;
    if (/죽고\s*싶|자살|사라지고\s*싶/.test(t))
      return { ok: false, reason: "CRISIS", message: "", todayCallsLeft: calls };
    if (/\d{3}-?\d{3,4}-?\d{4}/.test(t))
      return {
        ok: false,
        reason: "PII",
        message: "아가, 전화번호 같은 건 빼고 써 줘.",
        todayCallsLeft: calls,
      };
    if (t.trim().length < 5)
      return {
        ok: false,
        reason: "NO_SYMBOLS",
        message: "아이고, 할매가 잘 못 알아들었구먼. 꿈을 조금 더 자세히 얘기해 줘.",
        todayCallsLeft: calls,
      };
    calls = Math.max(0, calls - 1);
    return {
      ok: true,
      checkId: "lab-check",
      symbols: [
        { id: "water", name: "물" },
        { id: "river", name: "강" },
        { id: "fish", name: "물고기" },
      ],
      todayCallsLeft: calls,
    };
  },
  async daily() {
    await sleep(800);
    maybeFail();
    return {
      date: "2026-11-25",
      iljin: "병오",
      dayMaster: "갑",
      result: LAB_OUTPUT.daily,
      disclaimer: LAB_DISCLAIMER,
    };
  },
} satisfies Partial<typeof api>);

function Lab() {
  const [npc, setNpc] = useState<NpcAction>("idle");
  const [left, setLeft] = useState<number | null>(null);
  const [exited, setExited] = useState(false);
  const c = CHARACTERS[shop];

  if (view === "cards") {
    return (
      <div class="lab-cards">
        <TarotBack />
        {TAROT_NAMES.map((n, i) => (
          <TarotFace key={n} id={i} />
        ))}
      </div>
    );
  }

  const product =
    (q.get("product") as ProductId | null) ?? SHOP_PRODUCTS[shop].at(-1) ?? "saju_full";
  return (
    <div class="lab-room">
      <div class="lab-npc" data-action={npc}>
        <div class="lab-npc-body" />
        <span>
          {c.name} · {npc}
        </span>
      </div>
      {left !== null && <div class="lab-left">남은 횟수 {left}</div>}
      {view === "result" && (
        <ResultView
          result={sample(product)}
          animate={q.get("animate") !== "0"}
          onClose={() => location.reload()}
        />
      )}
      {view === "crisis" && <CrisisScreen onClose={() => location.reload()} />}
      {view === "shop" &&
        (exited ? (
          <button type="button" class="lab-back" onClick={() => setExited(false)}>
            (거리) 다시 들어가기
          </button>
        ) : (
          <ShopScreen
            shop={shop}
            profile={profile}
            npc={setNpc}
            onExit={() => setExited(true)}
            onCallsLeft={setLeft}
          />
        ))}
    </div>
  );
}

const root = document.getElementById("app");
if (root) render(<Lab />, root);
