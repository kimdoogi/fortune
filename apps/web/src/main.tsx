/**
 * M1 프로토타입: 점집 거리 1개 + 2등신 캐릭터 탭 이동 (혼자 모드, docs/14 M1).
 * 주소 파라미터: ?shop=saju|tarot|dolyeong|dream &gender=female|male &age=20대 &debug=1
 * 화면 모양은 08 §1 UI 규칙을 따른다 (한지 카드 + 목재 현판 + 등불색 강조 버튼).
 */
import type { ShopId } from "@fortune/shared-types";
import { signal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { AgeBand, Gender } from "./scene/chibi";
import { THEMES } from "./scene/street";
import { World } from "./scene/world";
import "./ui/styles.css";

const params = new URLSearchParams(location.search);
const SHOPS: ShopId[] = ["saju", "tarot", "dolyeong", "dream"];
const shop = (SHOPS.find((s) => s === params.get("shop")) ?? "saju") as ShopId;
const gender: Gender = params.get("gender") === "male" ? "male" : "female";
const AGES: AgeBand[] = ["10대", "20대", "30대", "40대 이상"];
const ageBand = AGES.find((a) => a === params.get("age")) ?? "20대";
const debug = params.get("debug") === "1";

const nearDoor = signal(false);
const entered = signal(false);
const walked = signal(false);
const stats = signal<{ fps: number; calls: number; triangles: number } | null>(null);

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

/** 문 모양 아이콘 (들어가기) */
const DoorIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 9l9-5 9 5" />
    <path d="M5 9v11h14V9" />
    <path d="M10 20v-6h4v6" />
  </svg>
);

function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const name = THEMES[shop].name;

  useEffect(() => {
    if (!canvas.current) return;
    if (!canvas.current.getContext("webgl2")) {
      // 07 §1: WebGL2가 없으면 거리에 들어가지 않는다
      alert("이 기기에서는 마을에 들어갈 수 없어요");
      return;
    }
    const world = new World(
      canvas.current,
      shop,
      { gender, ageBand },
      {
        onNearDoor: (v) => {
          nearDoor.value = v;
        },
        onFirstMove: () => {
          walked.value = true;
        },
        onStats: debug
          ? (s) => {
              stats.value = s;
            }
          : undefined,
      },
    );
    return () => world.dispose();
  }, []);

  return (
    <div class="stage">
      <canvas ref={canvas} />

      <div class="hud-top">
        <button type="button" class="btn-map">
          <BackIcon />
          지도
        </button>
        <div class="plaque">{name} 거리</div>
      </div>

      {!entered.value && (
        <div class="hud-bottom">
          {nearDoor.value ? (
            <>
              <div class="arrived">문 앞에 도착했어요</div>
              <button
                type="button"
                class="btn-enter"
                onClick={() => {
                  entered.value = true;
                }}
              >
                <DoorIcon />
                {name}에 들어가기
              </button>
            </>
          ) : (
            <div class={walked.value ? "hint gone" : "hint"}>
              <span class="dot" />
              바닥을 눌러 걸어가요 · 문을 누르면 바로 가요
            </div>
          )}
        </div>
      )}

      {entered.value && (
        <div class="veil">
          <div class="card">
            <div class="plaque">{name}</div>
            <p>
              점집 안은 곧 문을 열어요.
              <br />
              조금만 기다려 주세요.
            </p>
            <button
              type="button"
              class="btn-quiet"
              onClick={() => {
                entered.value = false;
              }}
            >
              거리로 나가기
            </button>
          </div>
        </div>
      )}

      {debug && stats.value && (
        <div class="stats">
          FPS {stats.value.fps} · draw {stats.value.calls} · tri{" "}
          {stats.value.triangles.toLocaleString()}
        </div>
      )}
    </div>
  );
}

const root = document.getElementById("app");
if (root) render(<App />, root);
