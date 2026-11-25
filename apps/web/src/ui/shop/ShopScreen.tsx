/**
 * 점집 안 화면 (F04 입장 → F05~F08 점 보기 → 결과). 3D 점집 내부 위에 겹쳐 그린다.
 * - 위쪽 55%는 비워 점술가가 보이게 하고, 아래 45%에 대화 상자와 고르기를 둔다
 * - 첫인사는 미리 써 둔 대사 (LLM 아님, F04)
 * - 오류 코드는 보이지 않고 캐릭터 대사로 바꾼다 (errors.ts)
 */
import { fillTemplate, greetings } from "@fortune/prompts";
import {
  type MenuResponse,
  PRODUCT_NAMES,
  type ProductId,
  type ProfileView,
  type ReadingResult,
  type ShopId,
} from "@fortune/shared-types";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { api } from "../../api/client";
import { CrisisScreen, ResultView } from "../reading/ResultView";
import { Dialogue } from "./Dialogue";
import { CHARACTERS, PRODUCT_BLURB } from "./characters";
import { type FailView, describeFailure } from "./errors";
import {
  DailyView,
  DolyeongFlow,
  DreamFlow,
  type FlowProps,
  type Resume,
  SajuFlow,
  TarotFlow,
} from "./flows";
import "./shop.css";

export type NpcAction = "idle" | "greet" | "talk" | "present" | "celebrate";

type View =
  | { k: "menu" }
  | { k: "flow"; product: ProductId; resume?: Resume; n: number }
  | { k: "result"; result: ReadingResult; animate: boolean }
  | { k: "daily" }
  | { k: "crisis" }
  | { k: "fail"; fail: FailView; retry?: () => void };

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
  /** "나가기" → 거리 문 앞으로 */
  onExit: () => void;
  /** 오늘 남은 횟수가 바뀌면 알려 준다 */
  onCallsLeft?: (n: number) => void;
}): JSX.Element {
  const { shop, profile } = props;
  const c = CHARACTERS[shop];
  const nick = profile.nickname;
  const [view, setView] = useState<View>({ k: "menu" });
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
    loadMenu();
    return () => {
      alive.current = false;
    };
  }, [shop]);

  const toMenu = (text = c.again) => {
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
      case "dream":
        return <DreamFlow key={key} {...fp} />;
      default:
        return null;
    }
  };

  const inFlow = view.k === "flow";
  const covered = view.k === "result" || view.k === "daily" || view.k === "crisis";

  return (
    <div class={`sh-root sh-${shop}`}>
      <header class="sh-top">
        <button type="button" class="sh-pill" onClick={() => (inFlow ? toMenu() : props.onExit())}>
          <BackIcon />
          {inFlow ? "뒤로" : "나가기"}
        </button>
        <div class="sh-plaque">{c.shopName}</div>
      </header>

      <div class={covered ? "sh-panel sh-panel-hidden" : "sh-panel"}>
        <Dialogue key={lineKey} name={c.name} line={line} busy={busy} />

        {view.k === "menu" && (
          <div class="sh-menu">
            {menu ? (
              menu.items.map((it, i) => (
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
              ))
            ) : menuFailed ? (
              <button type="button" class="sh-quiet" onClick={loadMenu}>
                다시 불러오기
              </button>
            ) : (
              <div class="sh-menu-wait">
                <i />
                <i />
              </div>
            )}
          </div>
        )}

        {view.k === "flow" && renderFlow(view)}

        {view.k === "fail" && (
          <div class="sh-block sh-fail">
            {view.retry && (
              <button type="button" class="sh-primary" onClick={view.retry}>
                다시 해 보기
              </button>
            )}
            <button type="button" class="sh-quiet" onClick={() => toMenu(c.again)}>
              점 목록으로
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
