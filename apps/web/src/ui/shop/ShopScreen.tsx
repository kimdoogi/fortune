/**
 * 점집 안 화면 (F04 입장 → F05~F08 점 보기 → 결과). 3D 점집 내부 위에 겹쳐 그린다.
 * - 위쪽 55%는 비워 점술가가 보이게 하고, 아래 45%에 대화 상자와 고르기를 둔다
 * - 첫인사는 미리 써 둔 대사 (LLM 아님, F04)
 * - 오류 코드는 보이지 않고 캐릭터 대사로 바꾼다 (errors.ts)
 */
import { fillTemplate, greetings } from "@fortune/prompts";
import {
  type MenuResponse,
  PAIR_PRODUCT,
  PRODUCT_NAMES,
  type PairShopId,
  type ProductId,
  type ProfileView,
  type ReadingResult,
  type ShopId,
} from "@fortune/shared-types";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { api } from "../../api/client";
import { sfx } from "../../audio/sound";
import { SoundButton } from "../app/kit";
import { navigate } from "../app/router";
import { CrisisScreen, ResultView } from "../reading/ResultView";
import { Dialogue } from "./Dialogue";
import { CHARACTERS, PRODUCT_BLURB } from "./characters";
import { type FailView, describeFailure } from "./errors";
import {
  DailyView,
  DolyeongFlow,
  DreamFlow,
  type FlowProps,
  NatureFlow,
  type Resume,
  SajuFlow,
  TarotFlow,
} from "./flows";
import { josaGa, josaRang } from "./helpers";
import { DreamPairFlow, PairChoiceFlow, type PairCtx } from "./pair";
import { SinjeomFlow } from "./sinjeom";
import "./shop.css";

/** 같이 보기: 풀이를 다 본 뒤 다음 곳 안내 (점집 말투, 04a) */
const PAIR_NEXT: Record<PairShopId, { host: (p: string) => string; guest: (p: string) => string }> =
  {
    saju: {
      host: (p) => `다른 점집도 ${p} 님과 같이 가 보시오. 지도에서 고르면 둘이 함께 가오.`,
      guest: (p) => `${p} 님이 다음 점집을 고르면 같이 가게 되오. 잠시 기다리시오.`,
    },
    tarot: {
      host: (p) => `다른 점집도 ${p} 님과 같이 들러 보세요. 지도에서 고르시면 두 분이 함께 가요.`,
      guest: (p) => `${p} 님이 다음 점집을 고르시면 같이 가요. 조금만 기다려 주세요.`,
    },
    dolyeong: {
      host: (p) => `다른 데도 ${p}${josaRang(p)} 같이 가 봐! 지도에서 고르면 같이 가!`,
      guest: (p) => `${p}${josaGa(p)} 다음 데 고르면 같이 가! 조금만 기다려!`,
    },
    dream: {
      host: (p) => `다른 집도 ${p}${josaRang(p)} 같이 가 봐. 지도에서 고르면 같이 가.`,
      guest: (p) => `${p}${josaGa(p)} 다음 집 고르면 같이 가. 조금만 기다려.`,
    },
  };

export type NpcAction = "idle" | "greet" | "talk" | "present" | "celebrate";

type View =
  | { k: "menu" }
  | { k: "flow"; product: ProductId; resume?: Resume; n: number }
  | { k: "result"; result: ReadingResult; animate: boolean }
  | { k: "daily" }
  | { k: "crisis" }
  | { k: "fail"; fail: FailView; retry?: () => void }
  /** 같이 보기: 풀이를 다 봤다. 방장이 다음 곳을 고른다 (F16) */
  | { k: "pairDone"; result: ReadingResult };

const BackIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

const ReplayIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
  </svg>
);

export function ShopScreen(props: {
  shop: ShopId;
  profile: ProfileView;
  /** 3D 점술가 동작 트리거 */
  npc: (a: NpcAction) => void;
  /** "나가기" → 바로 지도로 (같이 보기는 방장 지도·손님 끝내기) */
  onExit: () => void;
  /** 오늘 남은 횟수가 바뀌면 알려 준다 */
  onCallsLeft?: (n: number) => void;
  /** 같이 보기로 둘이 들어왔을 때 (F16). 메뉴 없이 바로 이 점집의 같이 보는 점 */
  pair?: PairCtx;
}): JSX.Element {
  const { shop, profile } = props;
  const c = CHARACTERS[shop];
  const nick = profile.nickname;
  const [view, setView] = useState<View>(
    props.pair ? { k: "flow", product: PAIR_PRODUCT[shop as PairShopId], n: 1 } : { k: "menu" },
  );
  const [line, setLine] = useState(() => {
    const xs = greetings[shop].enter;
    return fillTemplate(xs[Math.floor(Math.random() * xs.length)] ?? "", nick);
  });
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [menuFailed, setMenuFailed] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  // 같은 문장을 다시 말해도 처음부터 치도록
  const [lineKey, setLineKey] = useState(0);
  const alive = useRef(true);

  const say = (text: string, isBusy = false) => {
    setLine(text);
    setBusy(isBusy);
    setLineKey((k) => k + 1);
  };

  const loadMenu = () => {
    setMenuFailed(false);
    api.menu(shop).then(
      (m) => alive.current && setMenu(m),
      (e) => {
        if (!alive.current) return;
        setMenuFailed(true);
        say(describeFailure(shop, e, nick).line);
      },
    );
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: 점집에 들어올 때 한 번만
  useEffect(() => {
    props.npc("greet");
    if (!props.pair) loadMenu();
    return () => {
      alive.current = false;
    };
  }, [shop]);

  const toMenu = (text = c.again) => {
    // 같이 보기에는 메뉴가 없다: 본 풀이를 닫으면 다음 곳을 고르는 안내, 실패면 처음부터
    if (props.pair) {
      if (view.k === "result") {
        const partner = props.pair.partnerName ?? "같이 온 분";
        setView({ k: "pairDone", result: view.result });
        props.npc("idle");
        const next = PAIR_NEXT[shop as PairShopId];
        say(props.pair.host ? next.host(partner) : next.guest(partner));
      } else start(PAIR_PRODUCT[shop as PairShopId]);
      return;
    }
    setView({ k: "menu" });
    say(text);
    props.npc("idle");
    loadMenu();
  };

  const fail = (err: unknown, retry?: () => void) => {
    const f = describeFailure(shop, err, nick);
    if (f.crisis) {
      setView({ k: "crisis" });
      return;
    }
    props.npc("idle");
    setView({ k: "fail", fail: f, retry: f.retry ? retry : undefined });
    say(f.line);
  };

  const showResult = (r: ReadingResult, animate: boolean) => {
    props.onCallsLeft?.(r.todayCallsLeft);
    setView({ k: "result", result: r, animate });
    sfx("reveal");
    if (animate) props.npc("talk");
  };

  const start = (product: ProductId, resume?: Resume) => {
    if (product === "daily") {
      setView({ k: "daily" });
      say("오늘 하루의 기운을 살펴보겠소.", true);
      return;
    }
    setView((v) => ({ k: "flow", product, resume, n: (v.k === "flow" ? v.n : 0) + 1 }));
  };

  const replay = (id: string) => {
    setOpening(id);
    api.get(id).then(
      (r) => {
        if (!alive.current) return;
        setOpening(null);
        showResult(r, false);
      },
      (e) => {
        if (!alive.current) return;
        setOpening(null);
        fail(e);
      },
    );
  };

  const flowProps = (product: ProductId, resume?: Resume): FlowProps => ({
    shop,
    profile,
    resume,
    say,
    npc: props.npc,
    onResult: (r) => showResult(r, !r.reused),
    onFail: (err, res) => fail(err, () => start(product, res)),
    onCrisis: () => setView({ k: "crisis" }),
    onCallsLeft: props.onCallsLeft,
  });

  const renderFlow = (v: Extract<View, { k: "flow" }>) => {
    const fp = flowProps(v.product, v.resume);
    const key = `${v.product}-${v.n}`;
    switch (v.product) {
      case "saju_full":
        return <SajuFlow key={key} {...fp} />;
      case "tarot_one":
      case "tarot_three":
        return <TarotFlow key={key} {...fp} product={v.product} />;
      case "obanggi":
        return <DolyeongFlow key={key} {...fp} />;
      case "sinjeom":
        return <SinjeomFlow key={key} {...fp} />;
      case "dream":
        return <DreamFlow key={key} {...fp} />;
      case "nature":
        return <NatureFlow key={key} {...fp} />;
      case "gunghap":
      case "tarot_pair":
      case "sinjeom_pair":
        return props.pair ? (
          <PairChoiceFlow key={key} {...fp} pair={props.pair} product={v.product} />
        ) : null;
      case "dream_pair":
        return props.pair ? <DreamPairFlow key={key} {...fp} pair={props.pair} /> : null;
      default:
        return null;
    }
  };

  const inFlow = view.k === "flow" && !props.pair;
  const covered = view.k === "result" || view.k === "daily" || view.k === "crisis";

  return (
    <div class={`sh-root sh-${shop}`}>
      <header class="sh-top">
        <button type="button" class="sh-pill" onClick={() => (inFlow ? toMenu() : props.onExit())}>
          <BackIcon />
          {inFlow ? "뒤로" : props.pair?.host ? "지도" : "나가기"}
        </button>
        <div class="sh-plaque">{c.shopName}</div>
        <SoundButton />
      </header>

      <div class={covered ? "sh-panel sh-panel-hidden" : "sh-panel"}>
        <Dialogue key={lineKey} name={c.name} line={line} busy={busy} />

        {view.k === "menu" && (
          <div class="sh-menu">
            {menu?.items.map((it, i) => (
              <div class="sh-item" key={it.product} style={{ "--i": i }}>
                <button type="button" class="sh-item-main" onClick={() => start(it.product)}>
                  <span class="sh-item-name">{it.name || PRODUCT_NAMES[it.product]}</span>
                  <span class="sh-item-blurb">{PRODUCT_BLURB[it.product]}</span>
                </button>
                {it.todayReadingId && (
                  <button
                    type="button"
                    class="sh-replay"
                    disabled={opening !== null}
                    onClick={() => it.todayReadingId && replay(it.todayReadingId)}
                  >
                    <ReplayIcon />
                    {opening === it.todayReadingId ? "여는 중" : "다시 보기"}
                  </button>
                )}
              </div>
            ))}
            {menu && shop === "jokjipge" && (
              <div class="sh-item" style={{ "--i": menu.items.length }}>
                <button
                  type="button"
                  class="sh-item-main"
                  onClick={() => navigate({ name: "types" })}
                >
                  <span class="sh-item-name">60유형 도감</span>
                  <span class="sh-item-blurb">60가지 사람 중 나와 잘 맞는 유형 찾기</span>
                </button>
              </div>
            )}
            {!menu && menuFailed && (
              <button type="button" class="sh-quiet" onClick={loadMenu}>
                다시 불러오기
              </button>
            )}
            {!menu && !menuFailed && (
              <div class="sh-menu-wait">
                <i />
                <i />
              </div>
            )}
          </div>
        )}

        {view.k === "flow" && renderFlow(view)}

        {view.k === "pairDone" && (
          <div class="sh-block sh-gh">
            {props.pair?.host && (
              <button type="button" class="sh-primary" onClick={props.onExit}>
                지도로 같이 나가기
              </button>
            )}
            <button type="button" class="sh-quiet" onClick={() => showResult(view.result, false)}>
              풀이 다시 보기
            </button>
          </div>
        )}

        {view.k === "fail" && (
          <div class="sh-block sh-fail">
            {view.retry && (
              <button type="button" class="sh-primary" onClick={view.retry}>
                다시 해 보기
              </button>
            )}
            <button type="button" class="sh-quiet" onClick={() => toMenu(c.again)}>
              {props.pair ? "처음부터" : "점 목록으로"}
            </button>
          </div>
        )}
      </div>

      {view.k === "result" && (
        <ResultView result={view.result} animate={view.animate} onClose={() => toMenu()} />
      )}
      {view.k === "daily" && (
        <DailyView
          npc={props.npc}
          onClose={() => toMenu()}
          onFail={(e) => fail(e, () => start("daily"))}
        />
      )}
      {view.k === "crisis" && (
        <CrisisScreen
          onClose={() =>
            toMenu(shop === "dream" ? "아가, 할매는 늘 여기 있어. 언제든 와." : c.again)
          }
        />
      )}
    </div>
  );
}
