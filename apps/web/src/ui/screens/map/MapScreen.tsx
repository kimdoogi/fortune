/**
 * F01 지도 / 점집 선택 (S1). 3D 엔진 없이 뜨고, 뜬 뒤 거리 3D 코드를 미리 받는다 (07 §2).
 * 점집을 누르면 아래에서 정보 카드가 올라온다: 점술가 얼굴·이름·한 줄 소개·볼 수 있는 점 → "가기".
 * 늘 보이는 버튼: 내 캐릭터, 오늘의 운세(F13), 같이 보기(F16), 점 기록(F10). 가격·잔액은 어디에도 없다 (D-057).
 * 같이 보는 지도 (F16, D-090): 방장이 점집을 고르면 둘 다 그 골목으로 간다. 손님은 기다린다.
 */
import { PAIR_PRODUCT, PRODUCT_NAMES, SHOP_PRODUCTS, type ShopId } from "@fortune/shared-types";
import { useEffect, useState } from "preact/hooks";
import { leavePair, pairState, travel } from "../../../net/pairSession";
import { Icon, Plaque, SoundButton } from "../../app/kit";
import { hasWebGL2, loadStage, loadStreet, prefetch3d } from "../../app/preload";
import { navigate } from "../../app/router";
import { Portrait, SHOP_INFO } from "../../app/shops";
import { callsLeft, profile } from "../../app/state";
import { PRODUCT_BLURB } from "../../shop/characters";
import { shareInvite } from "../../shop/pair";
import { InviteSheet } from "./InviteSheet";
import { MapArt, type MapSpot } from "./MapArt";
import "./map.css";

let prefetched = false;

/** 당산나무 안내 카드 (F18) */
const TREE_INFO = {
  name: "당산나무",
  master: "마을 어귀 큰 나무",
  intro: "소원을 적은 천을 가지에 묶고, 돌 하나 올려 보세요.",
  tint: "#c9e6b8",
  roof: "#4a6b3a",
};
const TREE_THINGS = ["소원 빌기 (하루 한 번, 오색 천)", "돌탑에 돌 올리기", "지난 소원 돌아보기"];

export function MapScreen(props: { pair?: { code: string } } = {}) {
  const code = props.pair?.code;
  const ps = code ? pairState.value : null;
  const host = ps?.role === "host";
  const partner = ps?.partner?.nickname ?? null;
  const [inviting, setInviting] = useState(false);
  const [sentNote, setSentNote] = useState("");
  const [sel, setSel] = useState<MapSpot | null>(null);
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

  async function go(shop: MapSpot) {
    if (!hasWebGL2()) return setNotice("nogl");
    setLoading(true);
    setNotice("");
    try {
      // 3D 코드가 다 받아졌는지 확인하고 간다 (실패하면 다시 시도 버튼, F01 예외)
      await Promise.all([loadStreet(), loadStage()]);
      // 같이 보기: 방장이 고르면 방이 둘 다 그 골목으로 보낸다 (pairSession)
      if (code) travel(shop);
      else navigate(shop === "tree" ? { name: "tree" } : { name: "street", shop });
    } catch {
      setNotice("loadfail");
    } finally {
      setLoading(false);
    }
  }

  const info = sel ? (sel === "tree" ? TREE_INFO : SHOP_INFO[sel]) : null;
  const resend = async () => {
    if (!code) return;
    const how = await shareInvite(`${location.origin}/?g=${code}`, profile.value?.nickname ?? "");
    setSentNote(how === "copied" ? "링크를 복사했어요" : "");
  };

  return (
    <div class="screen map">
      <MapArt selected={sel} onSelect={(s) => (s === sel ? close() : setSel(s))} />

      <div class="map-top">
        <Plaque>{code ? "같이 보기" : "점집 거리"}</Plaque>
        <SoundButton />
        {code ? (
          <div class={`pair-with ${partner ? "on" : ""}`}>
            <Icon.pair />
            {partner
              ? `${partner} 님과 함께`
              : ps?.partnerLeft
                ? `${ps.partnerLeft} 님이 나갔어요`
                : ps?.status === "closed"
                  ? "연결이 끊겼어요"
                  : host
                    ? "같이 볼 분을 기다리는 중…"
                    : "연결하는 중…"}
          </div>
        ) : (
          callsLeft.value !== null && (
            <div class="calls" title="하루에 볼 수 있는 점">
              오늘 남은 점 <b>{callsLeft.value}</b>번
            </div>
          )
        )}
        {!sel && (
          <p class="map-hint">
            <span class="dot" aria-hidden="true" />
            {!code
              ? "가고 싶은 점집을 눌러 보세요"
              : host
                ? "같이 갈 점집을 골라 보세요"
                : `${partner ?? "같이 온 분"} 님이 점집을 고르는 중이에요`}
          </p>
        )}
      </div>

      {code ? (
        <nav class="dock" aria-label="같이 보기">
          {host && (
            <button type="button" class="dock-btn" onClick={() => void resend()}>
              <Icon.share />
              <span>{sentNote || "링크 다시 보내기"}</span>
            </button>
          )}
          <button type="button" class="dock-btn" onClick={leavePair}>
            <Icon.close />
            <span>같이 보기 끝내기</span>
          </button>
        </nav>
      ) : (
        <nav class="dock" aria-label="바로 가기">
          <button type="button" class="dock-btn" onClick={() => navigate({ name: "me" })}>
            <Icon.person />
            <span>내 캐릭터</span>
          </button>
          <button type="button" class="dock-btn main" onClick={() => navigate({ name: "daily" })}>
            <Icon.sun />
            <span>오늘의 운세</span>
          </button>
          <button type="button" class="dock-btn" onClick={() => setInviting(true)}>
            <Icon.pair />
            <span>같이 보기</span>
          </button>
          <button type="button" class="dock-btn" onClick={() => navigate({ name: "history" })}>
            <Icon.scroll />
            <span>점 기록</span>
          </button>
        </nav>
      )}

      {inviting && !sel && (
        <InviteSheet nickname={profile.value?.nickname ?? ""} onClose={() => setInviting(false)} />
      )}

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
              {sel === "tree" ? (
                <span class="invite-icon tree-icon" aria-hidden="true">
                  <Icon.tree />
                </span>
              ) : (
                <Portrait shop={sel} size={72} />
              )}
              <div>
                <div class="sheet-shop">{info.name}</div>
                <h2 class="sheet-name">{info.master}</h2>
              </div>
            </div>
            <p class="sheet-intro">“{info.intro}”</p>
            {sel === "tree" ? (
              <>
                <div class="sheet-label">할 수 있는 것</div>
                <ul class="sheet-products">
                  {TREE_THINGS.map((t) => (
                    <li key={t}>
                      <span class="dia" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <div class="sheet-label">{code ? "둘이 같이 보는 점" : "볼 수 있는 점"}</div>
                <ul class="sheet-products">
                  {(code ? [PAIR_PRODUCT[sel]] : SHOP_PRODUCTS[sel]).map((p) => (
                    <li key={p}>
                      <span class="dia" aria-hidden="true" />
                      {PRODUCT_NAMES[p]}
                      {code && <span class="sheet-blurb"> · {PRODUCT_BLURB[p]}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
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
            {code && !host ? (
              <p class="sheet-wait">
                갈 곳은 {partner ?? "같이 온 분"} 님이 골라요. 고르면 같이 이동해요.
              </p>
            ) : (
              <button
                type="button"
                class="btn-enter sheet-go"
                disabled={loading || notice === "nogl"}
                onClick={() => void go(sel)}
              >
                <Icon.door />
                {loading
                  ? sel === "tree"
                    ? "나무 앞으로 가는 중…"
                    : "골목으로 가는 중…"
                  : notice === "loadfail"
                    ? "다시 시도"
                    : code
                      ? `${partner ? `${partner} 님과` : "먼저"} 같이 가기`
                      : `${info.name} 가기`}
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
