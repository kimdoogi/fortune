/**
 * 앱 뼈대: 세션(F14) → 프로필(F02) → 지도(F01) → 거리(F03) → 점집 안(F04), 기록(F10), 운세(F13).
 * 화면 목록은 docs/06 §1. 경로는 router.ts.
 */
import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { MapScreen } from "../screens/map/MapScreen";
import { MeScreen } from "../screens/me/MeScreen";
import { ProfileFlow } from "../screens/profile/ProfileFlow";
import { Loading, NightSky, Plaque, ToastHost } from "./kit";
import { lazy } from "./lazy";
import { loadStreet } from "./preload";
import { goBack, initHistory, navigate, route } from "./router";
import { boot, bootError, phase, profile } from "./state";

const Street = lazy(() => loadStreet().then((m) => m.StreetScreen));
const History = lazy(() => import("../screens/history/HistoryScreen").then((m) => m.HistoryScreen));
const Daily = lazy(() => import("../screens/daily/DailyScreen").then((m) => m.DailyScreen));
const Join = lazy(() => import("../screens/join/JoinScreen").then((m) => m.JoinScreen));

function Splash(props: { failed?: string }) {
  return (
    <div class="screen center splash">
      <NightSky />
      <div class="splash-title">
        <Plaque class="big">점집 거리</Plaque>
        <p class="splash-sub">달 밝은 밤, 골목 끝 등불 아래</p>
      </div>
      {props.failed ? (
        <div class="card splash-card">
          <p>{props.failed}</p>
          <button type="button" class="btn-primary" onClick={() => void boot()}>
            다시 시도
          </button>
        </div>
      ) : (
        <Loading text="골목에 불을 밝히는 중이에요" />
      )}
    </div>
  );
}

function Routes() {
  const r = route.value;
  const p = profile.value;
  if (!p) return <Loading />;
  switch (r.name) {
    case "profile":
      return (
        <ProfileFlow
          mode="edit"
          initial={p}
          onDone={() => goBack({ name: "me" })}
          onCancel={() => goBack({ name: "me" })}
        />
      );
    case "me":
      return <MeScreen profile={p} />;
    case "street":
    case "inside":
      return <Street key={r.shop} shop={r.shop} inside={r.name === "inside"} profile={p} />;
    case "history":
      return <History id={r.id} />;
    case "daily":
      return <Daily />;
    // 궁합 (F16): 초대 받기 → 둘만의 사주집 거리
    case "join":
      return <Join code={r.code} />;
    case "pair":
    case "pair-in":
      return (
        <Street
          key={`pair:${r.code}`}
          shop="saju"
          inside={r.name === "pair-in"}
          profile={p}
          pair={{ code: r.code }}
        />
      );
    default:
      return <MapScreen />;
  }
}

export function App() {
  useEffect(() => {
    initHistory();
    void boot();
  }, []);

  let body: JSX.Element;
  switch (phase.value) {
    case "boot":
      body = <Splash />;
      break;
    case "failed":
      body = <Splash failed={bootError.value} />;
      break;
    case "onboarding":
      body = (
        <ProfileFlow
          mode="new"
          onDone={() => {
            phase.value = "ready";
            // 궁합 초대 링크로 처음 온 사람은 프로필을 만든 뒤 초대 화면으로 (F16)
            const r = route.value;
            navigate(r.name === "join" ? r : { name: "map" }, { replace: true });
          }}
        />
      );
      break;
    default:
      body = <Routes />;
  }

  return (
    <>
      {body}
      <ToastHost />
      {/* 07 §1: 세로 화면 고정 */}
      <div class="rotate-notice" aria-hidden="true">
        <div class="card">
          <p>세로로 돌려 주세요</p>
        </div>
      </div>
    </>
  );
}
