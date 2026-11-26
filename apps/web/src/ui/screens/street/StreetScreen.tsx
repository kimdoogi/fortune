/**
 * F03 점집 거리 + F04 점집 입장 (S3 → S4). Stage 하나를 전체 화면 캔버스에 올린다.
 * 들어가기: 0.6초 어두워짐 → stage.enterShop() → 0.6초 밝아짐 → ShopScreen (06 §4).
 * 안에 있는 동안 거리 장면은 Stage가 들고 있다 (F04). 경로(#/inside)와 Stage 상태를 맞춘다:
 * 안드로이드 뒤로 가기로 경로가 거리로 바뀌면 나가기 연출을 그대로 한다.
 */
import type { ProfileView, ShopId } from "@fortune/shared-types";
import { useEffect, useRef, useState } from "preact/hooks";
import { sfx } from "../../../audio/sound";
import { leavePair, pairState, sendPair, travel } from "../../../net/pairSession";
import type { NpcAction, Stage } from "../../../scene/stage";
import { Icon, Plaque, SoundButton } from "../../app/kit";
import { hasWebGL2, loadStage } from "../../app/preload";
import { goBack, goToMap, navigate } from "../../app/router";
import { SHOP_INFO } from "../../app/shops";
import { callsLeft, lookOf } from "../../app/state";
import { ShopScreen } from "../../shop/ShopScreen";
import { shareInvite } from "../../shop/pair";
import { TreeLayer } from "../tree/TreeLayer";
import { usePairStage } from "./pair";
import "./street.css";

const FADE_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const debug = new URLSearchParams(location.search).get("debug") === "1";
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const fadeMs = () => (reduceMotion() ? 120 : FADE_MS);

type Status = "loading" | "ready" | "nogl" | "failed";
type Stats = { fps: number; calls: number; triangles: number };

export function StreetScreen(props: {
  /** 점집 넷 또는 당산나무 (F18: 실내 없음) */
  shop: ShopId | "tree";
  inside: boolean;
  profile: ProfileView;
  /** 같이 보기 (F16): 상대가 보이고 같이 들어간다. 연결은 pairSession */
  pair?: { code: string };
}) {
  const { shop } = props;
  const code = props.pair?.code;
  /** 내 목적지를 방에 보낸다 (pair.ts가 채운다) */
  const walkRef = useRef<((x: number, z: number) => void) | null>(null);
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
  const isTree = shop === "tree";
  const name = shop === "tree" ? "당산나무" : SHOP_INFO[shop].name;

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
            onWalk: (x, z) => walkRef.current?.(x, z),
            onStats: debug ? (s) => setStats(s) : undefined,
          },
        );
        setStatus("ready");
        // ?debug=1: 개발용으로 Stage를 창에 건다 (위치 확인 등)
        if (debug) (window as unknown as { __stage?: Stage }).__stage = stage.current;
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
        // 문이 열리고 캐릭터가 걸어 들어간 뒤 어두워진다 (D-094)
        if (want.current && !s.inside && !reduceMotion()) {
          await s.playEnter();
          if (stage.current !== s) break;
        }
        setDark(true);
        await sleep(ms);
        if (stage.current !== s) break;
        if (want.current) {
          try {
            await s.enterShop();
            if (s.inside) setShown("inside");
          } catch {
            // F04: 내부 생성 실패 → 거리에 남고 다시 시도 안내
            s.cancelEnter();
            if (want.current) {
              want.current = false;
              setEnterFailed(true);
              if (code) navigate({ name: "pair", code, shop }, { replace: true });
              else goBack(shop === "tree" ? { name: "tree" } : { name: "street", shop });
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
    if (busy.current || shop === "tree") return;
    setEnterFailed(false);
    navigate({ name: "inside", shop });
  };
  // 점집 안 "나가기"는 거리를 거치지 않고 바로 지도로
  const exit = () => goToMap();
  const ps = code ? pairState.value : null;
  const host = ps?.role === "host";
  const room = usePairStage({ active: !!code, stage, ready: status === "ready", walkRef });
  const [sentNote, setSentNote] = useState("");
  const resend = async () => {
    if (!code) return;
    const how = await shareInvite(`${location.origin}/?g=${code}`, props.profile.nickname);
    setSentNote(how === "copied" ? "링크를 복사했어요" : "");
  };
  // 같이 보기: 방장의 "지도"는 둘 다 같이 보는 지도로, 손님의 "나가기"는 같이 보기를 끝낸다 (F16)
  const toMap = () => {
    if (!code) goBack({ name: "map" });
    else if (host) travel("map");
    else leavePair();
  };
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
              {code && !host ? "나가기" : "지도"}
            </button>
            <div class="plaque">{code ? `${name} · 같이` : isTree ? name : `${name} 거리`}</div>
            <SoundButton />
          </div>

          {status === "ready" && isTree && (
            <TreeLayer
              stage={stage}
              ready={status === "ready"}
              near={code ? room.meNear : near}
              pair={
                code && ps
                  ? { code, myId: ps.myId, partner: ps.partner?.nickname ?? null }
                  : undefined
              }
            />
          )}
          {status === "ready" && !isTree && (
            <div class="hud-bottom">
              {enterFailed && (
                <div class="enter-failed" role="alert">
                  문이 잘 열리지 않았어요. 다시 눌러 주세요.
                </div>
              )}
              {code ? (
                <PairHud
                  shopName={name}
                  partner={ps?.partner?.nickname ?? null}
                  left={ps?.partnerLeft ?? null}
                  connecting={ps?.status !== "open"}
                  closed={ps?.status === "closed"}
                  meNear={room.meNear}
                  partnerNear={room.partnerNear}
                  onTogether={() => sendPair({ t: "go_inside" })}
                  onResend={resend}
                  note={sentNote}
                />
              ) : near ? (
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

      {inside && shop !== "tree" && (
        <div class="inside-layer">
          <ShopScreen
            shop={shop}
            profile={props.profile}
            npc={npc}
            onExit={code ? toMap : exit}
            onCallsLeft={(n) => {
              callsLeft.value = n;
            }}
            pair={
              code && ps
                ? {
                    code,
                    myId: ps.myId,
                    host,
                    partnerName: ps.partner?.nickname ?? ps.partnerLeft,
                    event: ps.event,
                  }
                : undefined
            }
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

/** 같이 보기 골목 아래쪽 안내 (F16) */
function PairHud(props: {
  shopName: string;
  partner: string | null;
  left: string | null;
  connecting: boolean;
  closed: boolean;
  meNear: boolean;
  partnerNear: boolean;
  onTogether: () => void;
  onResend: () => void;
  note: string;
}) {
  if (props.closed)
    return <div class="enter-failed">연결이 끊겼어요. 화면을 다시 열어 주세요.</div>;
  if (!props.partner)
    return (
      <>
        <div class="arrived">
          {props.left
            ? `${props.left} 님이 나갔어요. 다시 들어오면 보여요`
            : props.connecting
              ? "골목에 불을 켜는 중…"
              : "같이 볼 분이 들어오면 여기 나타나요"}
        </div>
        <button type="button" class="btn-map" onClick={props.onResend}>
          링크 다시 보내기
        </button>
        {props.note && <div class="hint">{props.note}</div>}
      </>
    );
  if (props.meNear && props.partnerNear)
    return (
      <>
        <div class="arrived">둘 다 문 앞에 왔어요</div>
        <button type="button" class="btn-enter" onClick={props.onTogether}>
          <Icon.door />
          같이 들어가기
        </button>
      </>
    );
  return (
    <div class="hint">
      <span class="dot" />
      {props.meNear
        ? `${props.partner} 님을 기다리는 중… 문 앞으로 오면 같이 들어가요`
        : `${props.partner} 님과 ${props.shopName} 문 앞으로 가요 · 문을 누르면 바로 가요`}
    </div>
  );
}
