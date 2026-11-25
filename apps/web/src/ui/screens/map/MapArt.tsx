/**
 * F01 지도: 코드로 그린 2D 밤 한옥 골목 일러스트 (D-030, D-048).
 * 거리 장면과 같은 팔레트 (08 §1): 남보라 하늘 + 별 + 보름달, 길 따라 석등 불빛, 점집별 지붕색.
 * viewBox는 360×640. 화면 비율이 달라도 점집 네 곳은 늘 다 보이고, 남는 곳은 하늘·땅이 이어진다.
 */
import type { ShopId } from "@fortune/shared-types";
import type { ComponentChildren, JSX } from "preact";
import { SHOP_INFO } from "../../app/shops";

const W = 360;

/** 고정 시드 난수 (그림이 매번 같게) */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── 길: 위(먼 곳)는 좁고 아래(가까운 곳)는 넓다 ─────────────────────
const PATH_PTS: [number, number][] = [
  [181, 196],
  [176, 236],
  [186, 292],
  [172, 352],
  [186, 410],
  [170, 474],
  [182, 548],
  [176, 640],
  [180, 760],
];

function catmull(pts: [number, number][], steps: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)] as [number, number];
    const p1 = pts[i] as [number, number];
    const p2 = pts[i + 1] as [number, number];
    const p3 = pts[Math.min(pts.length - 1, i + 2)] as [number, number];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1] as [number, number]);
  return out;
}

const CENTER = catmull(PATH_PTS, 10);
const widthAt = (y: number) => 9 + Math.max(0, y - 196) * 0.115;

function ribbon(scale = 1): string {
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i < CENTER.length; i++) {
    const [x, y] = CENTER[i] as [number, number];
    const [nx0, ny0] = CENTER[Math.min(i + 1, CENTER.length - 1)] as [number, number];
    const [px0, py0] = CENTER[Math.max(i - 1, 0)] as [number, number];
    let dx = nx0 - px0;
    let dy = ny0 - py0;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const w = (widthAt(y) * scale) / 2;
    left.push(`${(x - dy * w).toFixed(1)} ${(y + dx * w).toFixed(1)}`);
    right.push(`${(x + dy * w).toFixed(1)} ${(y - dx * w).toFixed(1)}`);
  }
  return `M${left.join(" L")} L${right.reverse().join(" L")} Z`;
}

const PATH_D = ribbon(1);
const PATH_CORE = ribbon(0.45);

/** 길 위 디딤돌 */
const STONES = (() => {
  const r = rng(7);
  const out: { x: number; y: number; rx: number; ry: number }[] = [];
  for (let i = 4; i < CENTER.length - 2; i += 2) {
    const [x, y] = CENTER[i] as [number, number];
    const w = widthAt(y);
    out.push({ x: x + (r() - 0.5) * w * 0.5, y, rx: w * (0.12 + r() * 0.06), ry: w * 0.05 + 0.6 });
  }
  return out;
})();

const STARS = (() => {
  const r = rng(42);
  return Array.from({ length: 84 }, () => ({
    x: -120 + r() * (W + 240),
    y: -320 + r() * 500,
    r: 0.35 + r() ** 2 * 1.25,
    tw: r() < 0.35,
    d: r() * 5,
  }));
})();

const GRASS = (() => {
  const r = rng(99);
  const shades = ["#2f4a33", "#3d5a37", "#28402d", "#4a6a40"];
  return Array.from({ length: 46 }, (_, i) => ({
    x: -60 + r() * (W + 120),
    y: 214 + r() * 520,
    rx: 16 + r() * 46,
    ry: 4 + r() * 9,
    c: shades[i % shades.length] as string,
    o: 0.25 + r() * 0.35,
  }));
})();

const FIREFLIES = (() => {
  const r = rng(5);
  return Array.from({ length: 18 }, (_, i) => {
    // 꿈해몽집 근처에 더 많이 (08 §1)
    const nearDream = i < 8;
    return {
      x: nearDream ? 200 + r() * 140 : 10 + r() * 340,
      y: nearDream ? 420 + r() * 110 : 230 + r() * 360,
      d: r() * 6,
      dur: 5 + r() * 5,
    };
  });
})();

// ── 물체: 아래쪽(가까운 쪽)부터 앞에 그린다 ────────────────────────
interface ShopSpot {
  id: ShopId;
  x: number;
  y: number;
  s: number;
}
const SPOTS: ShopSpot[] = [
  { id: "saju", x: 92, y: 258, s: 0.84 },
  { id: "tarot", x: 270, y: 338, s: 0.9 },
  { id: "dolyeong", x: 92, y: 424, s: 0.96 },
  { id: "dream", x: 270, y: 510, s: 1.02 },
];

const LANTERNS: { x: number; y: number; s: number }[] = [
  { x: 166, y: 222, s: 0.42 },
  { x: 204, y: 270, s: 0.52 },
  { x: 150, y: 346, s: 0.6 },
  { x: 210, y: 430, s: 0.68 },
  { x: 140, y: 516, s: 0.76 },
  { x: 230, y: 598, s: 0.86 },
  { x: 118, y: 628, s: 0.9 },
];

const TREES: { x: number; y: number; s: number; flip?: boolean }[] = [
  { x: 6, y: 300, s: 0.8 },
  { x: 352, y: 262, s: 0.62, flip: true },
  { x: 340, y: 418, s: 0.9, flip: true },
  { x: 14, y: 520, s: 1.05 },
  { x: 348, y: 640, s: 1.2, flip: true },
  { x: 34, y: 690, s: 1.3 },
];

/** 빛 웅덩이 그라데이션 */
function Glow(props: { x: number; y: number; rx: number; ry: number; o?: number; cls?: string }) {
  return (
    <ellipse
      class={props.cls}
      cx={props.x}
      cy={props.y}
      rx={props.rx}
      ry={props.ry}
      fill="url(#m-glow)"
      opacity={props.o ?? 1}
    />
  );
}

/** 석등 (08 §1: 길을 따라 석등 불빛이 바닥에 고인다) */
function StoneLantern(props: { x: number; y: number; s: number; i: number }) {
  return (
    <g transform={`translate(${props.x} ${props.y}) scale(${props.s})`}>
      <Glow x={0} y={2} rx={46} ry={14} o={0.75} />
      <ellipse cx="0" cy="1" rx="9" ry="2.5" fill="#000" opacity=".3" />
      <path d="M-7 0h14l-2-5h-10z" fill="#6f6a61" />
      <rect x="-2.6" y="-20" width="5.2" height="15" fill="#8d877c" />
      <path d="M-8 -20h16l-2 -3h-12z" fill="#77716a" />
      <rect x="-6" y="-33" width="12" height="11" fill="#5f5a53" />
      <rect x="-4" y="-31" width="8" height="7" fill="#ffd27a" />
      <path d="M-10 -33h20l-5 -6h-10z" fill="#8d877c" />
      <circle cx="0" cy="-41" r="2.2" fill="#8d877c" />
      <circle
        class="lglow"
        style={{ animationDelay: `${props.i * -0.7}s` }}
        cx="0"
        cy="-27"
        r="16"
        fill="url(#m-flame)"
      />
    </g>
  );
}

/** 소나무: 겹친 삼각 덩어리, 달빛 쪽(왼쪽 위)이 밝다 */
function Pine(props: { x: number; y: number; s: number; flip?: boolean }) {
  return (
    <g
      transform={`translate(${props.x} ${props.y}) scale(${props.flip ? -props.s : props.s} ${props.s})`}
    >
      <ellipse cx="0" cy="2" rx="26" ry="5" fill="#000" opacity=".28" />
      <path d="M-3 0 q2 -24 -1 -46 h6 q-1 22 3 46z" fill="#3a2a22" />
      <path d="M-30 -24 q30 -14 60 0 q-28 -8 -60 0z M-34 -22 l34 -26 l34 26z" fill="#1b3024" />
      <path d="M-26 -44 l26 -24 l26 24z" fill="#22392a" />
      <path d="M-18 -64 l18 -22 l18 22z" fill="#284431" />
      <path
        d="M-34 -22 l34 -26 l-6 22z M-26 -44 l26 -24 l-5 21z M-18 -64 l18 -22 l-4 19z"
        fill="#3b5e43"
        opacity=".55"
      />
    </g>
  );
}

/** 걸린 초롱 (처마 끝) */
function Chorong(props: { x: number; y: number; color?: string; i: number }) {
  return (
    <g class="sway" style={{ animationDelay: `${props.i * -0.9}s` }}>
      <line
        x1={props.x}
        y1={props.y - 7}
        x2={props.x}
        y2={props.y - 1}
        stroke="#2a170d"
        stroke-width="1"
      />
      <circle cx={props.x} cy={props.y + 4} r="9" fill="url(#m-flame)" class="lglow" />
      <rect x={props.x - 3.6} y={props.y - 1.6} width="7.2" height="1.6" fill="#2a170d" />
      <ellipse cx={props.x} cy={props.y + 4} rx="4" ry="5" fill={props.color ?? "#e8553e"} />
      <ellipse cx={props.x - 1.2} cy={props.y + 3} rx="1.4" ry="2.6" fill="#ffd9a0" opacity=".7" />
      <rect x={props.x - 3} y={props.y + 8.6} width="6" height="1.4" fill="#2a170d" />
    </g>
  );
}

interface HanokProps {
  shop: ShopId;
  children?: ComponentChildren;
  /** 처마 끝 장식 (문 위·처마 아래에 붙는 것) */
  eaves?: ComponentChildren;
  door?: ComponentChildren;
  paper?: string;
}

/** 한옥 정면 한 채. 원점은 기단 앞 가운데, 폭 약 140 */
function Hanok(props: HanokProps) {
  const info = SHOP_INFO[props.shop];
  const id = props.shop;
  const paper = props.paper ?? "#ffcf86";
  // 처마선 위 기와 막새 점
  const tiles: JSX.Element[] = [];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    const x = -70 + 140 * t;
    const y = (1 - t) ** 2 * -66 + 2 * (1 - t) * t * -46 + t ** 2 * -66;
    tiles.push(
      <circle
        key={i}
        cx={x}
        cy={y + 0.6}
        r="1.9"
        fill={info.roof}
        stroke="#000"
        stroke-opacity=".35"
        stroke-width=".6"
      />,
    );
  }
  const ridges: JSX.Element[] = [];
  for (let x = -66; x <= 66; x += 5.5) {
    ridges.push(<line key={x} x1={x * 0.7} y1={-86} x2={x} y2={-52} />);
  }
  return (
    <g>
      {/* 담장: 건물 양옆으로 낮게, 기와를 얹은 돌담 */}
      <g>
        <rect x="-96" y="-24" width="192" height="17" fill="#5d574f" />
        <path d="M-96 -24 h192" stroke="#8d877c" stroke-width="1.2" />
        <path d="M-99 -24 q99 -5 198 0 l-4 -5 q-95 -4 -190 0z" fill={info.roof} />
        {[-86, -72, 72, 86].map((x) => (
          <ellipse key={x} cx={x} cy="-15" rx="4" ry="2.4" fill="#6f6a61" />
        ))}
      </g>
      {/* 마당 그림자 */}
      <ellipse cx="0" cy="3" rx="74" ry="9" fill="#000" opacity=".3" />
      {/* 기단 */}
      <path d="M-58 0 H58 L54 -12 H-54 Z" fill="#77716a" />
      <path d="M-54 -12 H54" stroke="#a49d91" stroke-width="1.4" />
      <path d="M-30 -12 v12 M-2 -12 v12 M26 -12 v12" stroke="#5f5a53" stroke-width=".8" />
      <path d="M-13 0 h26 l-2 -6 h-22z" fill="#9a9387" />
      {/* 벽과 기둥 */}
      <rect x="-47" y="-53" width="94" height="41" fill={`url(#m-wall-${id})`} />
      <rect x="-47" y="-22" width="94" height="10" fill="#c3b291" />
      <path d="M-47 -22 h94" stroke="#a08c6c" stroke-width=".8" />
      {[-47, -17, 12, 42].map((x) => (
        <g key={x}>
          <rect x={x} y="-53" width="5" height="41" fill="#6e4429" />
          <rect x={x + 3.4} y="-53" width="1.6" height="41" fill="#4a2c1b" />
        </g>
      ))}
      {/* 양쪽 창 (창호지에 등불이 비친다) */}
      {[-38, 21].map((x) => (
        <g key={x}>
          <rect x={x} y="-46" width="17" height="17" fill={paper} class="window" />
          <path
            d={`M${x + 5.7} -46 v17 M${x + 11.3} -46 v17 M${x} -40.3 h17 M${x} -34.7 h17`}
            stroke="#8a5a32"
            stroke-width=".7"
            opacity=".8"
          />
          <rect
            x={x}
            y="-46"
            width="17"
            height="17"
            fill="none"
            stroke="#4a2c1b"
            stroke-width="1.2"
          />
        </g>
      ))}
      {/* 문 */}
      <rect x="-11" y="-49" width="22" height="37" fill={paper} class="window" />
      <path
        d="M0 -49 v37 M-11 -40 h22 M-11 -31 h22 M-11 -22 h22 M-5.5 -49 v37 M5.5 -49 v37"
        stroke="#8a5a32"
        stroke-width=".7"
        opacity=".75"
      />
      <rect
        x="-11"
        y="-49"
        width="22"
        height="37"
        fill="none"
        stroke="#4a2c1b"
        stroke-width="1.4"
      />
      {props.door}
      {/* 문틈으로 새어 나온 빛 */}
      <Glow x={0} y={2} rx={40} ry={10} o={0.85} />
      {/* 창방 */}
      <rect x="-50" y="-57" width="100" height="5" fill="#5a3520" />
      <rect x="-50" y="-57" width="100" height="1.4" fill="#8a5a32" />
      {/* 처마 밑 서까래 그늘 */}
      <path d="M-70 -66 Q0 -46 70 -66 L60 -57 Q0 -42 -60 -57 Z" fill="#26160e" />
      <path d="M-60 -57 Q0 -42 60 -57" stroke="#6e4429" stroke-width="1" fill="none" opacity=".7" />
      {/* 아래 지붕 (처마 끝이 하늘로 들린다) */}
      <path d="M-70 -66 Q0 -46 70 -66 L50 -86 Q0 -90 -50 -86 Z" fill={`url(#m-roof-${id})`} />
      <clipPath id={`m-clip-${id}`}>
        <path d="M-70 -66 Q0 -46 70 -66 L50 -86 Q0 -90 -50 -86 Z" />
      </clipPath>
      <g clip-path={`url(#m-clip-${id})`} stroke="#000" stroke-opacity=".22" stroke-width="1.6">
        {ridges}
      </g>
      {tiles}
      {/* 위 지붕(합각) + 용마루 */}
      <path d="M-24 -86 L0 -97 L24 -86 Z" fill="#4a2c1b" />
      <path d="M-14 -88 L0 -94 L14 -88" stroke="#8a5a32" stroke-width=".8" fill="none" />
      <path
        d="M-50 -86 Q0 -90 50 -86 L38 -99 Q0 -103 -38 -99 Z"
        fill={`url(#m-roof-${id})`}
        opacity=".92"
      />
      <path
        d="M-44 -100 Q0 -105 44 -100"
        stroke="#16141a"
        stroke-width="4.2"
        stroke-linecap="round"
        fill="none"
      />
      <path
        d="M-44 -100 q-4 0 -7 -6 M44 -100 q4 0 7 -6"
        stroke="#16141a"
        stroke-width="3"
        stroke-linecap="round"
        fill="none"
      />
      {/* 달빛이 닿는 지붕 윗선 */}
      <path
        d="M-50 -86 Q0 -90 50 -86"
        stroke={info.tint}
        stroke-opacity=".45"
        stroke-width="1.2"
        fill="none"
      />
      <path
        d="M-38 -99 Q0 -103 38 -99"
        stroke={info.tint}
        stroke-opacity=".35"
        stroke-width="1"
        fill="none"
      />
      {props.eaves}
      {props.children}
    </g>
  );
}

/** 점집별 꾸밈 (08 §1 점집별 외관) */
function ShopDecor(props: { shop: ShopId }) {
  switch (props.shop) {
    case "saju":
      return (
        <Hanok
          shop="saju"
          door={
            <>
              {/* 문 양옆 세로 주련 */}
              {[-16, 13].map((x) => (
                <g key={x}>
                  <rect x={x} y="-50" width="3.2" height="26" fill="#efe2c4" />
                  {[0, 1, 2, 3].map((k) => (
                    <rect
                      key={k}
                      x={x + 0.9}
                      y={-47 + k * 6}
                      width="1.4"
                      height="3.4"
                      fill="#2a1d16"
                    />
                  ))}
                </g>
              ))}
            </>
          }
          eaves={
            <>
              <Chorong x={-63} y={-60} i={0} />
              <Chorong x={63} y={-60} i={1} />
            </>
          }
        >
          {/* 장독대 */}
          <g transform="translate(70 4)">
            <ellipse cx="0" cy="1" rx="22" ry="5" fill="#000" opacity=".25" />
            <rect x="-22" y="-5" width="44" height="6" fill="#77716a" />
            {[
              [-12, 0.9],
              [3, 1.15],
              [15, 0.75],
            ].map(([x, s]) => (
              <g key={x} transform={`translate(${x} -5) scale(${s})`}>
                <path d="M-8 0 q-3 -10 1 -16 h14 q4 6 1 16z" fill="#4a2a1c" />
                <path d="M-6 -16 h12 l-1 -3 h-10z" fill="#3a2016" />
                <path
                  d="M-5 -14 q-1 6 0 11"
                  stroke="#c49a74"
                  stroke-opacity=".5"
                  stroke-width="1.4"
                  fill="none"
                />
              </g>
            ))}
          </g>
        </Hanok>
      );
    case "tarot":
      return (
        <Hanok
          shop="tarot"
          paper="#e3c8ff"
          door={
            // 문에 보라 휘장
            <path
              d="M-12 -49 h24 v8 q-6 5 -12 0 q-6 5 -12 0z"
              fill="#7b4fc0"
              stroke="#4d2c86"
              stroke-width=".8"
            />
          }
          eaves={
            <>
              {/* 처마에 별 장식 */}
              {[
                [-52, -54, 1],
                [-30, -50, 0.8],
                [30, -50, 0.8],
                [52, -54, 1],
              ].map(([x, y, s], i) => (
                <g key={x} class="sway" style={{ animationDelay: `${i * -0.6}s` }}>
                  <line
                    x1={x}
                    y1={(y as number) - 8}
                    x2={x}
                    y2={y}
                    stroke="#f2d38a"
                    stroke-width=".6"
                    opacity=".7"
                  />
                  <path
                    transform={`translate(${x} ${(y as number) + 3}) scale(${s})`}
                    d="M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3Z"
                    fill="#ffe7a6"
                    class="twinkle"
                  />
                </g>
              ))}
            </>
          }
        >
          {/* 문 앞 받침대 위 빛나는 수정구 */}
          <g transform="translate(-34 4)">
            <circle cx="0" cy="-20" r="18" fill="url(#m-crystal-glow)" class="pulse" />
            <path d="M-5 0 h10 l-2 -9 h-6z" fill="#5a3f8f" />
            <path d="M-7 -9 h14 v-2 h-14z" fill="#f2d38a" />
            <circle cx="0" cy="-17" r="6.5" fill="url(#m-crystal)" />
            <circle cx="-2" cy="-19" r="1.6" fill="#fff" opacity=".85" />
          </g>
        </Hanok>
      );
    case "dolyeong":
      return (
        <Hanok
          shop="dolyeong"
          eaves={
            // 처마에 금줄 (새끼줄 + 흰 종이)
            <g>
              <path d="M-58 -56 Q0 -42 58 -56" stroke="#c9a46a" stroke-width="1.4" fill="none" />
              {[-44, -26, -8, 10, 28, 46].map((x) => (
                <path key={x} d={`M${x} ${-50 + Math.abs(x) * -0.07} l-2 6 h4z`} fill="#fbf7ee" />
              ))}
            </g>
          }
        >
          {/* 문 양옆 오방기 다섯 깃발 */}
          {(
            [
              [-64, "#e5483d"],
              [-56, "#f6c344"],
              [56, "#4f8fd8"],
              [64, "#f7f3ea"],
              [72, "#5fb36a"],
            ] as const
          ).map(([x, c], i) => (
            <g key={x}>
              <line x1={x} y1="0" x2={x} y2="-44" stroke="#6e4429" stroke-width="1.6" />
              <circle cx={x} cy="-45" r="1.4" fill="#f2d38a" />
              <path
                class="flag"
                style={{ animationDelay: `${i * -0.35}s` }}
                d={`M${x} -43 q${x < 0 ? -6 : 6} 2 ${x < 0 ? -11 : 11} 0 l${x < 0 ? 1 : -1} 13 q${x < 0 ? -5 : 5} -2 ${x < 0 ? 10 : -10} 0z`}
                fill={c}
              />
            </g>
          ))}
          <Chorong x={0} y={-62} i={2} color="#f6c344" />
        </Hanok>
      );
    case "dream":
      return (
        <Hanok
          shop="dream"
          paper="#ffe6b0"
          eaves={
            <>
              {/* 처마에 달 모양 초롱 */}
              {[-60, 60].map((x, i) => (
                <g key={x} class="sway" style={{ animationDelay: `${i * -1.1}s` }}>
                  <line x1={x} y1="-66" x2={x} y2="-58" stroke="#2a170d" stroke-width="1" />
                  <circle cx={x} cy="-52" r="11" fill="url(#m-flame)" class="lglow" />
                  <path d={`M${x + 2} -58 a6 6 0 1 0 0 12 a4.6 4.6 0 1 1 0 -12z`} fill="#fff1c2" />
                </g>
              ))}
            </>
          }
        >
          {/* 마당에 달항아리 */}
          <g transform="translate(-72 4)">
            <ellipse cx="0" cy="0" rx="12" ry="3" fill="#000" opacity=".25" />
            <ellipse cx="0" cy="-11" rx="10" ry="10.5" fill="url(#m-moonjar)" />
            <rect x="-4" y="-22.5" width="8" height="2.4" rx="1" fill="#e9e3d4" />
            <ellipse cx="-3.5" cy="-14" rx="2.2" ry="4" fill="#fff" opacity=".6" />
          </g>
        </Hanok>
      );
  }
}

/** 지평선 너머 작은 마을 지붕들 (깊이감) */
function FarVillage() {
  const roofs = [
    [-40, 206, 0.36],
    [8, 204, 0.3],
    [44, 208, 0.34],
    [318, 206, 0.32],
    [352, 203, 0.28],
    [396, 207, 0.34],
    [130, 198, 0.24],
    [236, 199, 0.24],
  ];
  return (
    <g opacity=".9">
      {roofs.map(([x, y, s]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-40" y="-20" width="80" height="20" fill="#1c1838" />
          <path d="M-58 -20 Q0 -8 58 -20 L40 -38 Q0 -42 -40 -38z" fill="#16132e" />
          <rect x="-8" y="-17" width="16" height="13" fill="#ffc46b" opacity=".75" />
          <rect x="-30" y="-15" width="10" height="9" fill="#ffc46b" opacity=".45" />
        </g>
      ))}
    </g>
  );
}

export function MapArt(props: { selected: ShopId | null; onSelect: (s: ShopId) => void }) {
  type Item = { y: number; el: JSX.Element };
  const items: Item[] = [];

  for (const t of TREES) items.push({ y: t.y, el: <Pine key={`t${t.x}`} {...t} /> });
  LANTERNS.forEach((l, i) =>
    items.push({ y: l.y, el: <StoneLantern key={`l${l.x}`} {...l} i={i} /> }),
  );
  for (const sp of SPOTS) {
    const info = SHOP_INFO[sp.id];
    const on = props.selected === sp.id;
    const dim = props.selected !== null && !on;
    items.push({
      y: sp.y,
      el: (
        <g
          key={sp.id}
          class={`shop ${on ? "on" : ""} ${dim ? "dim" : ""}`}
          // biome-ignore lint/a11y/useSemanticElements: SVG 안에는 <button>을 둘 수 없다
          role="button"
          tabIndex={0}
          aria-label={`${info.name}, ${info.master}`}
          aria-pressed={on}
          onClick={() => props.onSelect(sp.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              props.onSelect(sp.id);
            }
          }}
          transform={`translate(${sp.x} ${sp.y})`}
        >
          <g class="shop-art" style={{ transform: `scale(${sp.s})` }}>
            {on && <ellipse class="ring" cx="0" cy="2" rx="86" ry="16" />}
            <ShopDecor shop={sp.id} />
            {/* 현판 */}
            <g class="map-plaque" transform="translate(0 12)">
              <rect
                x="-36"
                y="0"
                width="72"
                height="24"
                rx="3"
                fill="url(#m-wood)"
                stroke="#f2d38a"
                stroke-width="1.5"
              />
              <rect
                x="-32.5"
                y="3.5"
                width="65"
                height="17"
                rx="1.5"
                fill="none"
                stroke="#f2d38a"
                stroke-opacity=".45"
                stroke-width=".8"
              />
              <text x="0" y="17" text-anchor="middle" class="map-label">
                {info.name}
              </text>
            </g>
            {/* 누르기 쉬운 넓은 영역 */}
            <rect x="-80" y="-112" width="160" height="152" fill="transparent" />
          </g>
        </g>
      ),
    });
  }
  items.sort((a, b) => a.y - b.y);

  return (
    <svg
      class="map-art"
      viewBox={`0 0 ${W} 640`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="점집 거리 지도"
    >
      <defs>
        <linearGradient id="m-sky" x1="0" y1="-320" x2="0" y2="230" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#0d0f2a" />
          <stop offset=".55" stop-color="#141634" />
          <stop offset=".85" stop-color="#2a2253" />
          <stop offset="1" stop-color="#3b2d5c" />
        </linearGradient>
        <linearGradient
          id="m-ground"
          x1="0"
          y1="200"
          x2="0"
          y2="760"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#1d2a26" />
          <stop offset=".4" stop-color="#22362a" />
          <stop offset="1" stop-color="#1a2a20" />
        </linearGradient>
        <linearGradient id="m-path" x1="0" y1="196" x2="0" y2="760" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#5a4c52" />
          <stop offset=".5" stop-color="#7d6a58" />
          <stop offset="1" stop-color="#8f7860" />
        </linearGradient>
        <radialGradient id="m-glow">
          <stop offset="0" stop-color="#ffb85c" stop-opacity=".55" />
          <stop offset=".45" stop-color="#ff9a3c" stop-opacity=".22" />
          <stop offset="1" stop-color="#ff9a3c" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="m-flame">
          <stop offset="0" stop-color="#fff2c8" stop-opacity=".95" />
          <stop offset=".3" stop-color="#ffb85c" stop-opacity=".55" />
          <stop offset="1" stop-color="#ff9a3c" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="m-moon" cx=".42" cy=".4">
          <stop offset="0" stop-color="#fffdf0" />
          <stop offset=".7" stop-color="#f7e9bc" />
          <stop offset="1" stop-color="#e8d293" />
        </radialGradient>
        <radialGradient id="m-halo">
          <stop offset="0" stop-color="#fff1c4" stop-opacity=".35" />
          <stop offset=".35" stop-color="#c9b8ff" stop-opacity=".14" />
          <stop offset="1" stop-color="#8f7fe0" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="m-crystal" cx=".38" cy=".35">
          <stop offset="0" stop-color="#fbf2ff" />
          <stop offset=".5" stop-color="#c79cff" />
          <stop offset="1" stop-color="#6b3fc0" />
        </radialGradient>
        <radialGradient id="m-crystal-glow">
          <stop offset="0" stop-color="#d9b8ff" stop-opacity=".8" />
          <stop offset="1" stop-color="#9a6bff" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="m-moonjar" cx=".35" cy=".35">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset=".7" stop-color="#ece6d6" />
          <stop offset="1" stop-color="#bfb6a2" />
        </radialGradient>
        <linearGradient id="m-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#5a341f" />
          <stop offset="1" stop-color="#2a170d" />
        </linearGradient>
        <linearGradient id="m-horizon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3b2d5c" stop-opacity="0" />
          <stop offset=".45" stop-color="#4a3c70" stop-opacity=".55" />
          <stop offset="1" stop-color="#22362a" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="m-mist" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#b9a9ff" stop-opacity="0" />
          <stop offset=".5" stop-color="#b9a9ff" stop-opacity=".16" />
          <stop offset="1" stop-color="#b9a9ff" stop-opacity="0" />
        </linearGradient>
        {SPOTS.map(({ id }) => {
          const info = SHOP_INFO[id];
          return (
            <g key={id}>
              <linearGradient id={`m-roof-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color={info.tint} stop-opacity=".9" />
                <stop offset=".18" stop-color={info.roof} />
                <stop offset="1" stop-color={info.roof} stop-opacity=".85" />
              </linearGradient>
              <linearGradient id={`m-wall-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#a99b84" />
                <stop offset=".3" stop-color={id === "tarot" ? "#ddd0e2" : "#e9dcc0"} />
                <stop offset="1" stop-color={id === "tarot" ? "#cfc0d6" : "#d9c9a6"} />
              </linearGradient>
            </g>
          );
        })}
      </defs>

      {/* 하늘 (viewBox 밖까지 이어 그린다) */}
      <rect x="-600" y="-800" width={W + 1200} height="1040" fill="url(#m-sky)" />
      <g class="stars">
        {STARS.map((s) => (
          <circle
            key={`${s.x}-${s.y}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#fff6dc"
            class={s.tw ? "twinkle" : undefined}
            style={s.tw ? { animationDelay: `${s.d}s` } : undefined}
          />
        ))}
      </g>
      <line
        class="shooting"
        x1="60"
        y1="40"
        x2="96"
        y2="22"
        stroke="#fff6dc"
        stroke-width="1.4"
        stroke-linecap="round"
      />

      {/* 보름달 + 달무리 + 엷은 구름 */}
      <circle cx="284" cy="86" r="90" fill="url(#m-halo)" class="pulse-slow" />
      <circle cx="284" cy="86" r="25" fill="url(#m-moon)" />
      <circle cx="276" cy="80" r="4.5" fill="#e6d49c" opacity=".45" />
      <circle cx="292" cy="95" r="3" fill="#e6d49c" opacity=".4" />
      <circle cx="289" cy="76" r="2" fill="#e6d49c" opacity=".35" />
      <g class="cloud" fill="#4b3f7d" opacity=".55">
        <ellipse cx="246" cy="104" rx="46" ry="5" />
        <ellipse cx="300" cy="110" rx="34" ry="4" />
        <ellipse cx="60" cy="140" rx="54" ry="5" opacity=".6" />
      </g>

      {/* 먼 산 두 겹 */}
      <path
        d="M-600 196 L-600 150 Q-200 120 -40 150 Q20 112 74 140 Q120 104 168 136 Q214 116 256 134 Q300 98 352 132 Q400 112 450 140 Q700 118 960 146 L960 196 Z"
        fill="#2b2455"
      />
      <path
        d="M-600 210 L-600 176 Q-100 160 -10 172 Q40 150 96 168 Q150 146 200 166 Q250 152 300 164 Q350 144 410 170 Q700 154 960 172 L960 210 Z"
        fill="#221d45"
      />
      <rect class="mist" x="-120" y="160" width="600" height="34" fill="url(#m-mist)" />
      <FarVillage />

      {/* 땅 */}
      <path d="M-600 204 Q180 192 960 204 L960 1400 L-600 1400 Z" fill="url(#m-ground)" />
      {/* 지평선 안개 (산과 땅 사이 경계를 부드럽게) */}
      <rect x="-600" y="180" width={W + 1200} height="48" fill="url(#m-horizon)" />
      {GRASS.map((g) => (
        <ellipse
          key={`${g.x}-${g.y}`}
          cx={g.x}
          cy={g.y}
          rx={g.rx}
          ry={g.ry}
          fill={g.c}
          opacity={g.o}
        />
      ))}

      {/* 마당과 문에서 길로 이어지는 샛길 */}
      {SPOTS.map((sp) => (
        <g key={sp.id}>
          <ellipse
            cx={sp.x}
            cy={sp.y + 4 * sp.s}
            rx={78 * sp.s}
            ry={13 * sp.s}
            fill="#6b5a4b"
            opacity=".75"
          />
          <path
            d={`M${sp.x} ${sp.y + 6 * sp.s} Q${(sp.x + 180) / 2} ${sp.y + 14 * sp.s} 180 ${sp.y + 10}`}
            stroke="#6f5d4d"
            stroke-width={13 * sp.s}
            stroke-linecap="round"
            fill="none"
          />
        </g>
      ))}

      {/* 큰길 */}
      <path d={PATH_D} fill="url(#m-path)" />
      <path d={PATH_CORE} fill="#a58d70" opacity=".25" />
      {STONES.map((s) => (
        <ellipse
          key={`${s.x}-${s.y}`}
          cx={s.x}
          cy={s.y}
          rx={s.rx}
          ry={s.ry}
          fill="#b89b74"
          opacity=".35"
        />
      ))}

      {/* 나무·석등·점집 (먼 것부터) */}
      {items.map((it) => it.el)}

      {/* 반딧불이 */}
      {FIREFLIES.map((f) => (
        <circle
          key={`${f.x}-${f.y}`}
          class="firefly"
          cx={f.x}
          cy={f.y}
          r="1.6"
          fill="#f4ffb0"
          style={{ animationDelay: `${f.d}s`, animationDuration: `${f.dur}s` }}
        />
      ))}
    </svg>
  );
}
