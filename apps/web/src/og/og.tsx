/**
 * 공유 미리보기 이미지 (docs/16 §1, D-082). 1200×630 한 장을 실제 앱의 그림 부품으로 그린다.
 * `tools/assets/og.sh`가 headless Chrome으로 찍어 public/og.png로 저장한다. 그림이 다 그려지면 body에 data-ready를 단다.
 */
import type { ShopId } from "@fortune/shared-types";
import { render } from "preact";
import { Portrait, SHOP_INFO } from "../ui/app/shops";
import { MapArt } from "../ui/screens/map/MapArt";
import "../ui/styles.css";
import "../ui/screens/map/map.css";
import "./og.css";

const SHOPS: { id: ShopId; what: string }[] = [
  { id: "saju", what: "사주" },
  { id: "tarot", what: "타로" },
  { id: "dolyeong", what: "신점" },
  { id: "dream", what: "꿈해몽" },
];

/** 결정적인 별 자리 (찍을 때마다 같게) */
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: r(1) * 100, y: r(2) * 70, s: 1 + r(3) * 2.2, o: 0.35 + r(4) * 0.6 };
});

function Og() {
  return (
    <div class="og">
      <div class="og-stars" aria-hidden="true">
        {STARS.map((s) => (
          <i
            key={`${s.x}-${s.y}`}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.s}px`,
              height: `${s.s}px`,
              opacity: s.o,
            }}
          />
        ))}
      </div>

      <div class="og-map">
        <MapArt selected={null} onSelect={() => {}} />
      </div>

      <div class="og-text">
        <div class="plaque big og-plaque">점집 거리</div>
        <p class="og-tag">달 밝은 밤, 골목 끝 등불 아래 점집 네 곳</p>
        <ul class="og-masters">
          {SHOPS.map((s) => (
            <li key={s.id}>
              <Portrait shop={s.id} size={92} />
              <b>{s.what}</b>
              <span>{SHOP_INFO[s.id].master}</span>
            </li>
          ))}
        </ul>
        <p class="og-chips">
          <span>무료</span>
          <span>가입 없이</span>
          <span>월별 운세 · 오늘의 운세 점수</span>
        </p>
      </div>
    </div>
  );
}

/** ?icon=1: apple-touch-icon 180×180 (favicon.svg를 크게) */
function Icon() {
  return <img class="og-icon" src="/favicon.svg" alt="" width={180} height={180} />;
}

const icon = new URLSearchParams(location.search).has("icon");
if (icon) document.documentElement.classList.add("is-icon");
const root = document.getElementById("og");
if (root) render(icon ? <Icon /> : <Og />, root);
// 글꼴까지 다 받은 뒤 찍을 수 있게 표시한다
void document.fonts.ready.then(() =>
  requestAnimationFrame(() => document.body.setAttribute("data-ready", "1")),
);
