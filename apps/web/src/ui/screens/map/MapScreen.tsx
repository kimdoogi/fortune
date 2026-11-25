/**
 * F01 지도 / 점집 선택 (S1). 3D 엔진 없이 뜨고, 뜬 뒤 거리 3D 코드를 미리 받는다 (07 §2).
 * 점집을 누르면 아래에서 정보 카드가 올라온다: 점술가 얼굴·이름·한 줄 소개·볼 수 있는 점 → "가기".
 * 늘 보이는 버튼: 내 캐릭터, 오늘의 운세(F13), 점 기록(F10). 가격·잔액은 어디에도 없다 (D-057).
 */
import { PRODUCT_NAMES, SHOP_PRODUCTS, type ShopId } from "@fortune/shared-types";
import { useEffect, useState } from "preact/hooks";
import { Icon, Plaque } from "../../app/kit";
import { hasWebGL2, loadStage, loadStreet, prefetch3d } from "../../app/preload";
import { navigate } from "../../app/router";
import { Portrait, SHOP_INFO } from "../../app/shops";
import { callsLeft } from "../../app/state";
import { MapArt } from "./MapArt";
import "./map.css";

let prefetched = false;

export function MapScreen() {
  const [sel, setSel] = useState<ShopId | null>(null);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState<"" | "nogl" | "loadfail">("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!prefetched && hasWebGL2()) {
      prefetched = true;
      prefetch3d();
    }
  }, []);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel]);

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setSel(null);
      setClosing(false);
      setNotice("");
    }, 220);
  };

  async function go(shop: ShopId) {
    if (!hasWebGL2()) return setNotice("nogl");
    setLoading(true);
    setNotice("");
    try {
      // 3D 코드가 다 받아졌는지 확인하고 간다 (실패하면 다시 시도 버튼, F01 예외)
      await Promise.all([loadStreet(), loadStage()]);
      navigate({ name: "street", shop });
    } catch {
      setNotice("loadfail");
    } finally {
      setLoading(false);
    }
  }

  const info = sel ? SHOP_INFO[sel] : null;

  return (
    <div class="screen map">
      <MapArt selected={sel} onSelect={(s) => (s === sel ? close() : setSel(s))} />

      <div class="map-top">
        <Plaque>점집 거리</Plaque>
        {callsLeft.value !== null && (
          <div class="calls" title="하루에 볼 수 있는 점">
            오늘 남은 점 <b>{callsLeft.value}</b>번
          </div>
        )}
        {!sel && (
          <p class="map-hint">
            <span class="dot" aria-hidden="true" />
            가고 싶은 점집을 눌러 보세요
          </p>
        )}
      </div>

      <nav class="dock" aria-label="바로 가기">
        <button type="button" class="dock-btn" onClick={() => navigate({ name: "me" })}>
          <Icon.person />
          <span>내 캐릭터</span>
        </button>
        <button type="button" class="dock-btn main" onClick={() => navigate({ name: "daily" })}>
          <Icon.sun />
          <span>오늘의 운세</span>
        </button>
        <button type="button" class="dock-btn" onClick={() => navigate({ name: "history" })}>
          <Icon.scroll />
          <span>점 기록</span>
        </button>
      </nav>

      {sel && info && (
        <>
          <button
            type="button"
            class={`sheet-scrim ${closing ? "out" : ""}`}
            aria-label="닫기"
            onClick={close}
          />
          <section
            class={`sheet ${closing ? "out" : ""}`}
            style={{ "--tint": info.tint, "--roof": info.roof }}
            aria-label={`${info.name} 안내`}
          >
            <div class="sheet-grip" aria-hidden="true" />
            <button type="button" class="sheet-close" aria-label="닫기" onClick={close}>
              <Icon.close />
            </button>
            <div class="sheet-head">
              <Portrait shop={sel} size={72} />
              <div>
                <div class="sheet-shop">{info.name}</div>
                <h2 class="sheet-name">{info.master}</h2>
              </div>
            </div>
            <p class="sheet-intro">“{info.intro}”</p>
            <div class="sheet-label">볼 수 있는 점</div>
            <ul class="sheet-products">
              {SHOP_PRODUCTS[sel].map((p) => (
                <li key={p}>
                  <span class="dia" aria-hidden="true" />
                  {PRODUCT_NAMES[p]}
                </li>
              ))}
            </ul>
            {notice === "nogl" && (
              <p class="sheet-notice">
                이 기기에서는 마을에 들어갈 수 없어요. 오늘의 운세와 점 기록은 계속 볼 수 있어요.
              </p>
            )}
            {notice === "loadfail" && (
              <p class="sheet-notice">
                거리를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.
              </p>
            )}
            <button
              type="button"
              class="btn-enter sheet-go"
              disabled={loading || notice === "nogl"}
              onClick={() => void go(sel)}
            >
              <Icon.door />
              {loading
                ? "골목으로 가는 중…"
                : notice === "loadfail"
                  ? "다시 시도"
                  : `${info.name} 가기`}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
