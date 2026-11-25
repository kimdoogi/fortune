/**
 * F03 점집 거리 + F04 점집 입장 (S3 → S4). Stage 하나를 전체 화면 캔버스에 올린다.
 * 들어가기: 0.6초 어두워짐 → stage.enterShop() → 0.6초 밝아짐 → ShopScreen (06 §4).
 * 안에 있는 동안 거리 장면은 Stage가 들고 있다 (F04). 경로(#/inside)와 Stage 상태를 맞춘다:
 * 안드로이드 뒤로 가기로 경로가 거리로 바뀌면 나가기 연출을 그대로 한다.
 */
import type { ProfileView, ShopId } from "@fortune/shared-types";
import { useEffect, useRef, useState } from "preact/hooks";
import { sfx } from "../../../audio/sound";
import type { NpcAction, Stage } from "../../../scene/stage";
import { Icon, Plaque, SoundButton } from "../../app/kit";
import { hasWebGL2, loadStage } from "../../app/preload";
import { goBack, navigate } from "../../app/router";
import { SHOP_INFO } from "../../app/shops";
import { callsLeft, lookOf } from "../../app/state";
import { ShopScreen } from "../../shop/ShopScreen";
import "./street.css";

const FADE_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const debug = new URLSearchParams(location.search).get("debug") === "1";
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const fadeMs = () => (reduceMotion() ? 120 : FADE_MS);

type Status = "loading" | "ready" | "nogl" | "failed";
type Stats = { fps: number; calls: number; triangles: number };

export function StreetScreen(props: { shop: ShopId; inside: boolean; profile: ProfileView }) {
  const { shop } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const want = useRef(props.inside);
  const busy = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>(() => (hasWebGL2() ? "loading" : "nogl"));
  const [near, setNear] = useState(false);
  const [walked, setWalked] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  /** 검은 막 (페이드) */
  const [dark, setDark] = useState(true);
  /** 화면에 보이는 쪽 */
  const [shown, setShown] = useState<"street" | "inside">("street");
  const [enterFailed, setEnterFailed] = useState(false);
  const name = SHOP_INFO[shop].name;

  // Stage 만들기 (거리 → 지도로 나가면 dispose). attempt는 "다시 시도"
  // biome-ignore lint/correctness/useExhaustiveDependencies: 점집·외모는 이 화면이 떠 있는 동안 바뀌지 않는다 (key=shop)
  useEffect(() => {
    if (status === "nogl") return;
    let alive = true;
    setStatus("loading");
    loadStage()
      .then(({ Stage }) => {
        if (!alive || !canvas.current) return;
        stage.current = new Stage(
          canvas.current,
          { shop, look: lookOf(props.profile) },
          {
            onNearDoor: (v) => setNear(v),
            onFirstMove: () => setWalked(true),
            onStep: () => sfx("step"),
            onStats: debug ? (s) => setStats(s) : undefined,
          },
        );
        setStatus("ready");
        // 첫 그림이 그려진 뒤 밝아진다 (탭이 숨겨져 rAF가 멈춰도 밝아지게 시간 제한)
        const reveal = () => alive && setDark(false);
        requestAnimationFrame(() => requestAnimationFrame(reveal));
        setTimeout(reveal, 400);
      })
      .catch(() => {
        if (!alive) return;
        setStatus("failed");
        setDark(false);
      });
    return () => {
      alive = false;
      stage.current?.dispose();
      stage.current = null;
    };
  }, [attempt]);

  // 경로(안/밖)를 Stage에 맞춘다. 전환은 한 번에 하나씩
  useEffect(() => {
    want.current = props.inside;
    if (props.inside) setEnterFailed(false);
    if (status === "ready") void sync();
  }, [props.inside, status]);

  async function sync() {
    if (busy.current) return;
    busy.current = true;
    try {
      for (;;) {
        const s = stage.current;
        if (!s || want.current === s.inside) break;
        const ms = fadeMs();
        sfx("door");
        setDark(true);
        await sleep(ms);
        if (stage.current !== s) break;
        if (want.current) {
          try {
            await s.enterShop();
            if (s.inside) setShown("inside");
          } catch {
            // F04: 내부 생성 실패 → 거리에 남고 다시 시도 안내
            if (want.current) {
              want.current = false;
              setEnterFailed(true);
              goBack({ name: "street", shop });
            }
          }
        } else {
          s.exitShop();
          setShown("street");
        }
        setDark(false);
        await sleep(ms);
      }
    } finally {
      busy.current = false;
    }
  }

  const enter = () => {
    if (busy.current) return;
    setEnterFailed(false);
    navigate({ name: "inside", shop });
  };
  const exit = () => goBack({ name: "street", shop });
  const toMap = () => goBack({ name: "map" });
  const npc = (a: NpcAction) => stage.current?.npc(a);

  const inside = shown === "inside";

  return (
    <div class="stage street">
      <canvas ref={canvas} class={status === "ready" ? "" : "hidden"} />

      {status === "nogl" && (
        <div class="street-notice">
          <div class="card">
            <Plaque>{name}</Plaque>
            <p>
              이 기기에서는 마을에 들어갈 수 없어요.
              <br />
              오늘의 운세와 점 기록은 계속 볼 수 있어요.
            </p>
            <button type="button" class="btn-primary" onClick={toMap}>
              지도로 돌아가기
            </button>
          </div>
        </div>
      )}

      {status === "failed" && (
        <div class="street-notice">
          <div class="card">
            <Plaque>{name}</Plaque>
            <p>거리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>
            <div class="row">
              <button type="button" class="btn-quiet" onClick={toMap}>
                지도로
              </button>
              <button type="button" class="btn-primary" onClick={() => setAttempt(attempt + 1)}>
                다시 시도
              </button>
            </div>
          </div>
        </div>
      )}

      {status === "loading" && (
        <div class="street-loading">
          <span class="lamp" aria-hidden="true">
            <span />
          </span>
          {name} 골목으로 가는 중…
        </div>
      )}

      {!inside && status !== "nogl" && (
        <>
          <div class="hud-top">
            <button type="button" class="btn-map" onClick={toMap}>
              <Icon.back />
              지도
            </button>
            <div class="plaque">{name} 거리</div>
            <SoundButton />
          </div>

          {status === "ready" && (
            <div class="hud-bottom">
              {enterFailed && (
                <div class="enter-failed" role="alert">
                  문이 잘 열리지 않았어요. 다시 눌러 주세요.
                </div>
              )}
              {near ? (
                <>
                  <div class="arrived">문 앞에 도착했어요</div>
                  <button type="button" class="btn-enter" onClick={enter}>
                    <Icon.door />
                    {enterFailed ? "다시 들어가기" : `${name}에 들어가기`}
                  </button>
                </>
              ) : (
                <div class={walked ? "hint gone" : "hint"}>
                  <span class="dot" />
                  바닥을 눌러 걸어가요 · 문을 누르면 바로 가요
                </div>
              )}
            </div>
          )}
        </>
      )}

      {inside && (
        <div class="inside-layer">
          <ShopScreen
            shop={shop}
            profile={props.profile}
            npc={npc}
            onExit={exit}
            onCallsLeft={(n) => {
              callsLeft.value = n;
            }}
          />
        </div>
      )}

      <div class={`fade ${dark ? "on" : ""}`} style={{ transitionDuration: `${fadeMs()}ms` }} />

      {debug && stats && (
        <div class="stats">
          FPS {stats.fps} · draw {stats.calls} · tri {stats.triangles.toLocaleString()}
        </div>
      )}
    </div>
  );
}
