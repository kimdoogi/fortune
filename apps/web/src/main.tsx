/**
 * M1 프로토타입: 점집 거리 1개 + 2등신 캐릭터 탭 이동 (혼자 모드, docs/14 M1).
 * 주소 파라미터: ?shop=saju|tarot|dolyeong|dream &gender=female|male &age=20대 &debug=1
 */
import type { ShopId } from "@fortune/shared-types";
import { signal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { AgeBand, Gender } from "./scene/chibi";
import { THEMES } from "./scene/street";
import { World } from "./scene/world";

const params = new URLSearchParams(location.search);
const SHOPS: ShopId[] = ["saju", "tarot", "dolyeong", "dream"];
const shop = (SHOPS.find((s) => s === params.get("shop")) ?? "saju") as ShopId;
const gender: Gender = params.get("gender") === "male" ? "male" : "female";
const AGES: AgeBand[] = ["10대", "20대", "30대", "40대 이상"];
const ageBand = AGES.find((a) => a === params.get("age")) ?? "20대";
const debug = params.get("debug") === "1";

const nearDoor = signal(false);
const entered = signal(false);
const stats = signal<{ fps: number; calls: number; triangles: number } | null>(null);

const button = {
  border: "none",
  borderRadius: "999px",
  padding: "12px 22px",
  fontSize: "16px",
  fontWeight: 700,
  boxShadow: "0 4px 14px rgba(0,0,0,.35)",
} as const;

function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
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
    <div style={{ position: "relative", height: "100%" }}>
      <canvas ref={canvas} />
      <div
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top) + 12px)",
          left: 12,
          right: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <button
          type="button"
          style={{ ...button, background: "#fff7e0", color: "#3b2b22", pointerEvents: "auto" }}
        >
          ← 지도
        </button>
        <span style={{ fontSize: 18, fontWeight: 800, textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>
          {THEMES[shop].name} 거리
        </span>
      </div>

      {nearDoor.value && !entered.value && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(env(safe-area-inset-bottom) + 28px)",
            left: 0,
            right: 0,
            textAlign: "center",
          }}
        >
          <button
            type="button"
            style={{ ...button, background: "#ffb347", color: "#2b1b14", fontSize: 18 }}
            onClick={() => {
              entered.value = true;
            }}
          >
            {THEMES[shop].name}에 들어가기
          </button>
        </div>
      )}

      {entered.value && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(10,8,20,.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <p style={{ fontSize: 18 }}>점집 내부는 M2에서 만들어요</p>
          <button
            type="button"
            style={{ ...button, background: "#fff7e0", color: "#3b2b22" }}
            onClick={() => {
              entered.value = false;
            }}
          >
            나가기
          </button>
        </div>
      )}

      {debug && stats.value && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            fontSize: 12,
            fontFamily: "ui-monospace, monospace",
            background: "rgba(0,0,0,.55)",
            padding: "4px 8px",
            borderRadius: 6,
          }}
        >
          FPS {stats.value.fps} · draw {stats.value.calls} · tri {stats.value.triangles}
        </div>
      )}
    </div>
  );
}

const root = document.getElementById("app");
if (root) render(<App />, root);
