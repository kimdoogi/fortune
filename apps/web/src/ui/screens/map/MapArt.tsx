/**
 * F01 지도: 코드로 그린 2D 밤 한옥 골목 일러스트 (D-030, D-048).
 * 거리 장면과 같은 팔레트 (08 §1): 남보라 하늘 + 별 + 보름달, 길 따라 석등 불빛.
 * 점집마다 생김새가 다르다 (D-075): 사주집 기와 한옥, 타로집 서양 오두막, 아기도령 신당 초가집, 꿈해몽 꿈속 찻집,
 * 족집게집 장터 골목 점방 (D-100).
 * viewBox는 360×640. 화면 비율이 달라도 점집 다섯 곳은 늘 다 보이고, 남는 곳은 하늘·땅이 이어진다.
 * 16:9 휴대폰(375×667)에서도 아래 버튼 줄(y ≈ 557 위)에 가리지 않게 다섯 곳을 지그재그로 촘촘히 둔다.
 */
import type { ShopId } from "@fortune/shared-types";
import type { JSX } from "preact";
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
  /** 마당 흙빛 */
  yard: string;
}
const SPOTS: ShopSpot[] = [
  { id: "saju", x: 92, y: 246, s: 0.78, yard: "#6b5a4b" },
  { id: "tarot", x: 270, y: 316, s: 0.82, yard: "#625b66" },
  { id: "dolyeong", x: 92, y: 386, s: 0.86, yard: "#54463f" },
  { id: "dream", x: 270, y: 456, s: 0.9, yard: "#6a6480" },
  { id: "jokjipge", x: 94, y: 514, s: 0.92, yard: "#5a4c44" },
];

const LANTERNS: { x: number; y: number; s: number }[] = [
  { x: 166, y: 220, s: 0.42 },
  { x: 204, y: 262, s: 0.5 },
  { x: 156, y: 302, s: 0.54 },
  { x: 206, y: 372, s: 0.62 },
  { x: 152, y: 440, s: 0.7 },
  { x: 214, y: 528, s: 0.8 },
  { x: 230, y: 610, s: 0.88 },
  { x: 118, y: 630, s: 0.9 },
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

/** 사주집: 먹색 기와 한옥 한 채. 원점은 기단 앞 가운데, 폭 약 140 */
function SajuHanok() {
  const info = SHOP_INFO.saju;
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
      <rect x="-47" y="-53" width="94" height="41" fill="url(#m-wall-saju)" />
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
          <rect x={x} y="-46" width="17" height="17" fill="#ffcf86" class="window" />
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
      <rect x="-11" y="-49" width="22" height="37" fill="#ffcf86" class="window" />
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
      {/* 문 양옆 세로 주련 */}
      {[-16, 13].map((x) => (
        <g key={x}>
          <rect x={x} y="-50" width="3.2" height="26" fill="#efe2c4" />
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x={x + 0.9} y={-47 + k * 6} width="1.4" height="3.4" fill="#2a1d16" />
          ))}
        </g>
      ))}
      {/* 문틈으로 새어 나온 빛 */}
      <Glow x={0} y={2} rx={40} ry={10} o={0.85} />
      {/* 창방 */}
      <rect x="-50" y="-57" width="100" height="5" fill="#5a3520" />
      <rect x="-50" y="-57" width="100" height="1.4" fill="#8a5a32" />
      {/* 처마 밑 서까래 그늘 */}
      <path d="M-70 -66 Q0 -46 70 -66 L60 -57 Q0 -42 -60 -57 Z" fill="#26160e" />
      <path d="M-60 -57 Q0 -42 60 -57" stroke="#6e4429" stroke-width="1" fill="none" opacity=".7" />
      {/* 아래 지붕 (처마 끝이 하늘로 들린다) */}
      <path d="M-70 -66 Q0 -46 70 -66 L50 -86 Q0 -90 -50 -86 Z" fill="url(#m-roof-saju)" />
      <clipPath id="m-clip-saju">
        <path d="M-70 -66 Q0 -46 70 -66 L50 -86 Q0 -90 -50 -86 Z" />
      </clipPath>
      <g clip-path="url(#m-clip-saju)" stroke="#000" stroke-opacity=".22" stroke-width="1.6">
        {ridges}
      </g>
      {tiles}
      {/* 위 지붕(합각) + 용마루 */}
      <path d="M-24 -86 L0 -97 L24 -86 Z" fill="#4a2c1b" />
      <path d="M-14 -88 L0 -94 L14 -88" stroke="#8a5a32" stroke-width=".8" fill="none" />
      <path
        d="M-50 -86 Q0 -90 50 -86 L38 -99 Q0 -103 -38 -99 Z"
        fill="url(#m-roof-saju)"
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
        d="M-50 -86 Q0 -90 50 -86 M-38 -99 Q0 -103 38 -99"
        stroke={info.tint}
        stroke-opacity=".4"
        stroke-width="1.1"
        fill="none"
      />
      <Chorong x={-63} y={-60} i={0} />
      <Chorong x={63} y={-60} i={1} />
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
    </g>
  );
}

// ── 아기도령: 으스스한 신당 초가집 (D-075) ──────────────────────────
/** 초가지붕 처마선: (-64,-42)에서 (64,-42)까지 가운데가 살짝 처진다 */
const thatchEave = (t: number) => -42 + 16 * t * (1 - t);

/** 처마 끝 삐죽삐죽한 짚 술 */
const THATCH_FRINGE = (() => {
  const r = rng(11);
  const pts: string[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const tip = i % 2 ? 3 + r() * 2.6 : 0.4;
    pts.push(`${(-64 + 128 * t).toFixed(1)} ${(thatchEave(t) + tip).toFixed(1)}`);
  }
  for (let i = 32; i >= 0; i -= 4) {
    const t = i / 32;
    pts.push(`${(-64 + 128 * t).toFixed(1)} ${(thatchEave(t) - 5).toFixed(1)}`);
  }
  return `M${pts.join(" L")}Z`;
})();

/** 짚 결 (지붕 꼭대기에서 처마로 흘러내린다) */
const THATCH_STRANDS = (() => {
  const r = rng(23);
  let d = "";
  for (let i = -13; i <= 13; i++) {
    const top = i * 2.6 + (r() - 0.5) * 2;
    const bot = i * 5.2 + (r() - 0.5) * 3;
    d += `M${top.toFixed(1)} -94 Q${(i * 4.4).toFixed(1)} -66 ${bot.toFixed(1)} -36`;
  }
  return d;
})();

/** 싸리 울타리 (가는 가지를 촘촘히 세운다) */
const BRUSH_FENCE = (() => {
  const r = rng(31);
  let d = "";
  for (const [a, b] of [
    [-90, -48],
    [46, 70],
  ] as const) {
    for (let x = a; x <= b; x += 1.8) {
      const h = 12 + r() * 4;
      d += `M${x.toFixed(1)} -1 l${((r() - 0.5) * 2).toFixed(1)} ${(-h).toFixed(1)}`;
    }
  }
  return d;
})();

/** 횃불: 붉게 일렁이는 불과 바닥 빛 */
function Torch(props: { x: number; i: number }) {
  const delay = { animationDelay: `${props.i * -0.45}s` };
  return (
    <g transform={`translate(${props.x} 4)`}>
      <ellipse
        class="torch-glow"
        style={delay}
        cx="0"
        cy="0"
        rx="30"
        ry="8"
        fill="url(#m-redglow)"
      />
      <path d="M-1.3 0 L-.8 -24 h1.6 L1.3 0z" fill="#3f2c1e" />
      <path d="M-4 -24 h8 l-1.6 4 h-4.8z" fill="#2a2026" />
      <circle class="torch-glow" style={delay} cx="0" cy="-30" r="17" fill="url(#m-torch)" />
      <g class="flame" style={delay}>
        <path d="M0 -38 q4.4 5 3.6 9 q-.8 4 -3.6 4 q-3 0 -3.6 -4 q-.4 -4 3.6 -9z" fill="#e8452f" />
        <path
          d="M0 -34 q2.2 3 1.8 5.6 q-.6 2.2 -1.8 2.2 q-1.6 0 -1.9 -2.4 q0 -2.4 1.9 -5.4z"
          fill="#ffb347"
        />
        <ellipse cx="0" cy="-27.6" rx="1" ry="1.4" fill="#fff0b0" />
      </g>
    </g>
  );
}

/** 장승: 큰 눈과 이빨 웃음. 무섭되 귀엽게 */
function Jangseung(props: { x: number; female?: boolean }) {
  return (
    <g transform={`translate(${props.x} 6)`}>
      <ellipse cx="0" cy="0" rx="7" ry="1.8" fill="#000" opacity=".35" />
      <path d="M-4 0 V-22 h8 V0z" fill="#7d5d40" />
      <rect x="2" y="-22" width="2" height="22" fill="#5e4430" />
      {/* 몸통 글씨 */}
      <path d="M0 -18 v2.4 M-1 -13 h2 M0 -10 v3 M-1 -4.5 h2" stroke="#2a1a12" stroke-width=".9" />
      <path d="M-5.2 -21 Q-6 -34 0 -35 Q6 -34 5.2 -21z" fill="#94704c" />
      {props.female ? (
        <path d="M-5.4 -31 q5.4 -5 10.8 0 v1.4 h-10.8z" fill="#2a2026" />
      ) : (
        <>
          <path d="M-4 -32 h8 l-1 -6 h-6z" fill="#2a2026" />
          <rect x="-6.4" y="-32.6" width="12.8" height="1.8" rx=".9" fill="#2a2026" />
        </>
      )}
      <path
        d={
          props.female
            ? "M-4 -29.4 l2.6 .6 M4 -29.4 l-2.6 .6"
            : "M-4 -30.4 l2.8 1.2 M4 -30.4 l-2.8 1.2"
        }
        stroke="#1a1016"
        stroke-width="1"
        stroke-linecap="round"
      />
      <circle cx="-2.2" cy="-27" r="1.8" fill="#f4ecd8" />
      <circle cx="2.2" cy="-27" r="1.8" fill="#f4ecd8" />
      <circle cx="-1.8" cy="-26.8" r=".85" fill="#1a1016" />
      <circle cx="2.6" cy="-26.8" r=".85" fill="#1a1016" />
      <path d="M-.9 -26 q.9 2.6 1.8 0" fill="#7a5638" />
      <path d="M-3.4 -23.4 q3.4 2.6 6.8 0z" fill="#3a1a14" />
      <path d="M-2 -23 v.9 M0 -22.6 v.9 M2 -23 v.9" stroke="#f4ecd8" stroke-width=".8" />
      {props.female && (
        <>
          <circle cx="-3.6" cy="-24.6" r="1" fill="#e05a4a" opacity=".7" />
          <circle cx="3.6" cy="-24.6" r="1" fill="#e05a4a" opacity=".7" />
        </>
      )}
    </g>
  );
}

function DolyeongShrine() {
  // 금줄 (처마 아래 새끼줄): (-46,-45) → (46,-45), 가운데가 -39까지 처진다
  const ropeY = (t: number) => -45 + 24 * t * (1 - t);
  return (
    <g>
      {/* 뒤쪽 붉은 보라 안개 */}
      <ellipse class="fog" cx="0" cy="-8" rx="104" ry="26" fill="url(#m-fog)" />
      {/* 앙상한 죽은 나무 + 까마귀 */}
      <g transform="translate(-70 -2)" stroke="#4a3d52" stroke-linecap="round" fill="none">
        <path d="M0 0 C-2 -20 4 -36 0 -58" stroke-width="5" />
        <path
          d="M0 -36 C-8 -42 -14 -46 -22 -58 M1 -50 C6 -60 12 -66 10 -80 M0 -58 C-4 -68 -10 -72 -8 -86"
          stroke-width="2.4"
        />
        <path
          d="M-14 -48 l-7 -1 M-22 -58 l-1 -8 M10 -70 l8 -5 M-8 -78 l-6 -4 M4 -60 l7 2"
          stroke-width="1.3"
        />
        <g transform="translate(-21 -59)" fill="#1a1520" stroke="none">
          <path d="M-5 0 l-4 1.8 l4 -.2z" />
          <ellipse cx="-1" cy="-2" rx="4" ry="2.8" />
          <circle cx="2.6" cy="-4.4" r="2.2" />
          <path d="M4.4 -4.8 l2.6 .8 l-2.4 .8z" fill="#8a7a6a" />
          <circle cx="3.2" cy="-4.9" r=".55" fill="#ffd27a" />
        </g>
      </g>
      {/* 싸리 울타리 */}
      <path d={BRUSH_FENCE} stroke="#7a6248" stroke-width=".9" />
      <path
        d="M-91 -5 H-47 M-91 -10 H-47 M45 -5 H71 M45 -10 H71"
        stroke="#4e3c2c"
        stroke-width="1.2"
      />
      {/* 마당 그림자 + 흙 기단 */}
      <ellipse cx="0" cy="2" rx="68" ry="8" fill="#000" opacity=".32" />
      <path d="M-50 0 H50 L47 -7 H-47Z" fill="#5e5248" />
      <path d="M-47 -7 H47" stroke="#7d7064" stroke-width="1.2" />
      {/* 흙벽 (지푸라기가 박혀 있다) + 금 간 자국 */}
      <path d="M-44 -7 V-44 L44 -45 V-7Z" fill="url(#m-mud)" />
      <path
        d="M-40 -14 l4 -1 M-30 -40 l3 1 M24 -14 l3 -1 M34 -38 l3 .5 M-26 -12 l3 .4 M30 -20 l3 -1"
        stroke="#d8bf8a"
        stroke-width=".7"
        opacity=".6"
      />
      <path
        d="M-40 -20 l3 3 l-1 3 l3 2 M38 -30 l-2 4 l2 3"
        stroke="#4a3626"
        stroke-width=".7"
        fill="none"
      />
      {/* 기울어진 나무 기둥과 인방 */}
      <path
        d="M-44 -7 L-42 -46 M-15 -7 L-16 -45 M15 -7 L14 -45 M44 -7 L46 -46"
        stroke="#3f2c1e"
        stroke-width="3.6"
      />
      <path d="M-48 -45 L48 -43" stroke="#3f2c1e" stroke-width="3.4" />
      {/* 작은 창 (붉은 빛이 비친다) */}
      <rect x="-36" y="-36" width="13" height="12" fill="#ff9468" class="window" />
      <path d="M-29.5 -36 v12 M-36 -30 h13" stroke="#5a3424" stroke-width=".8" />
      <path d="M-36 -36 l4 0 l-4 4z" fill="#3a2418" opacity=".8" />
      <rect
        x="-36"
        y="-36"
        width="13"
        height="12"
        fill="none"
        stroke="#3f2c1e"
        stroke-width="1.2"
      />
      {/* 문 */}
      <rect x="-10" y="-35" width="20" height="28" fill="#ffa070" class="window" />
      <path
        d="M0 -35 v28 M-10 -28 h20 M-10 -21 h20 M-10 -14 h20 M-5 -35 v28 M5 -35 v28"
        stroke="#7a3a24"
        stroke-width=".7"
        opacity=".7"
      />
      <rect
        x="-10"
        y="-35"
        width="20"
        height="28"
        fill="none"
        stroke="#3f2c1e"
        stroke-width="1.4"
      />
      {/* 벽에 걸린 낡은 천 조각 */}
      {(
        [
          [22, "#b8423a"],
          [27, "#3f6aa8"],
          [32, "#d8b04a"],
          [37, "#e8e0cc"],
        ] as const
      ).map(([x, c], i) => (
        <path
          key={x}
          class="sway"
          style={{ animationDelay: `${i * -0.5}s` }}
          d={`M${x} -42 h3.4 l-.4 ${11 + (i % 2) * 3} l-1.2 -2 l-1 2.6z`}
          fill={c}
          opacity=".85"
        />
      ))}
      <Glow x={0} y={1} rx={34} ry={8} o={0.6} />
      {/* 둥글고 덥수룩한 초가지붕 */}
      <path
        d="M-64 -42 C-72 -60 -50 -76 -34 -86 C-20 -96 20 -96 34 -86 C50 -76 72 -60 64 -42 Q0 -26 -64 -42Z"
        fill="url(#m-thatch)"
      />
      <clipPath id="m-clip-thatch">
        <path d="M-64 -42 C-72 -60 -50 -76 -34 -86 C-20 -96 20 -96 34 -86 C50 -76 72 -60 64 -42 Q0 -26 -64 -42Z" />
      </clipPath>
      <g clip-path="url(#m-clip-thatch)" fill="none">
        <path d={THATCH_STRANDS} stroke="#5a4226" stroke-width=".8" opacity=".45" />
        <path
          d="M-66 -54 Q0 -64 66 -54 M-52 -72 Q0 -84 52 -72"
          stroke="#5e4628"
          stroke-width="1.1"
          opacity=".6"
        />
        {/* 이끼 낀 자리 */}
        <ellipse cx="-34" cy="-58" rx="12" ry="4" fill="#4a5a3a" opacity=".35" />
        <ellipse cx="40" cy="-70" rx="9" ry="3" fill="#4a5a3a" opacity=".3" />
        {/* 달빛 받는 오른쪽 윗면 */}
        <path d="M8 -92 C30 -90 52 -78 62 -60" stroke="#f0d79a" stroke-width="3" opacity=".25" />
      </g>
      <path d={THATCH_FRINGE} fill="#6a5030" />
      {/* 용마름 (꼭대기 짚 덮개) */}
      <path
        d="M-28 -88 Q0 -100 28 -88"
        stroke="#7a5e36"
        stroke-width="5"
        stroke-linecap="round"
        fill="none"
      />
      <path
        d="M-28 -88 Q0 -100 28 -88"
        stroke="#b8975e"
        stroke-width="2"
        stroke-dasharray="2 2.4"
        fill="none"
      />
      {/* 지붕 위 박 두 덩이 */}
      <ellipse cx="-20" cy="-80" rx="5.6" ry="4.6" fill="#e8e2c8" />
      <ellipse cx="-21.6" cy="-81.4" rx="1.8" ry="1.4" fill="#fff" opacity=".6" />
      <ellipse cx="-11" cy="-77" rx="3.8" ry="3.2" fill="#d8d2b4" />
      <path d="M-17 -84 q4 -4 8 -1 q2 2 5 0" stroke="#4a6a3a" stroke-width=".9" fill="none" />
      {/* 금줄: 새끼줄에 흰 한지를 꽂았다 */}
      <path d="M-46 -45 Q0 -27 46 -45" stroke="#c9a46a" stroke-width="1.7" fill="none" />
      <path
        d="M-46 -45 Q0 -27 46 -45"
        stroke="#7a5a32"
        stroke-width="1.7"
        stroke-dasharray="1.2 1.8"
        fill="none"
      />
      {[0.1, 0.24, 0.38, 0.62, 0.76, 0.9].map((t, i) => {
        const x = -46 + 92 * t;
        const y = ropeY(t);
        return (
          <path
            key={t}
            class="sway"
            style={{ animationDelay: `${i * -0.4}s` }}
            d={`M${(x - 1.6).toFixed(1)} ${y.toFixed(1)} h3.2 l-1 2.8 l1.6 2 l-1.6 3 h-2.4 l1.2 -3 l-1.6 -2z`}
            fill="#fbf7ee"
          />
        );
      })}
      {/* 오방기 다섯 깃발 */}
      {(
        [
          [53, "#e5483d", 44],
          [57, "#f6c344", 48],
          [61, "#4f8fd8", 42],
          [65, "#f7f3ea", 46],
          [69, "#5fb36a", 40],
        ] as const
      ).map(([x, c, h], i) => (
        <g key={x}>
          <line x1={x} y1="2" x2={x} y2={-h} stroke="#6e4429" stroke-width="1.5" />
          <circle cx={x} cy={-h - 1} r="1.3" fill="#f2d38a" />
          <path
            class="flag"
            style={{ animationDelay: `${i * -0.35}s` }}
            d={`M${x} ${1 - h} q5 2 10 0 l-1 12 q-4 -2 -9 0z`}
            fill={c}
          />
        </g>
      ))}
      {/* 솟대: 긴 장대 위 나무 새 */}
      <g transform="translate(84 4)">
        <ellipse cx="0" cy="0" rx="3" ry="1" fill="#000" opacity=".35" />
        <path d="M0 0 V-80" stroke="#8a6a48" stroke-width="1.8" />
        <path d="M.6 0 V-80" stroke="#5e4430" stroke-width=".6" />
        <g transform="translate(0 -82) scale(-1 1)">
          <path d="M-4 0 l-4.6 -2.4 l1.2 3.2z" fill="#9a7854" />
          <ellipse cx="0" cy="0" rx="5" ry="2.3" fill="#b8946a" />
          <circle cx="4.4" cy="-2" r="1.9" fill="#b8946a" />
          <path d="M6 -2.4 l2.8 .6 l-2.8 .6z" fill="#e0b070" />
          <circle cx="4.8" cy="-2.4" r=".45" fill="#1a1016" />
        </g>
      </g>
      <Torch x={-49} i={0} />
      <Torch x={47} i={1} />
      <Jangseung x={-80} />
      <Jangseung x={-66} female />
      {/* 앞쪽 낮게 깔린 안개 */}
      <ellipse
        class="fog"
        style={{ animationDelay: "-4s" }}
        cx="-20"
        cy="4"
        rx="80"
        ry="7"
        fill="url(#m-fog)"
      />
    </g>
  );
}

// ── 타로집: 서양식 타로 오두막 (D-075) ──────────────────────────────
/** 슬레이트 비늘 무늬 (반원 줄을 엇갈려 쌓는다) */
const SLATE_SCALES = (() => {
  let d = "";
  let row = 0;
  for (let y = -48; y >= -96; y -= 5.2) {
    const off = row % 2 ? 3.2 : 0;
    d += `M${-64 + off} ${y.toFixed(1)}`;
    for (let k = 0; k < 20; k++) d += " a3.2 3.2 0 0 0 6.4 0";
    row++;
  }
  return d;
})();

/** 하얀 말뚝 울타리 */
function Picket(props: { from: number; to: number }) {
  const pickets: string[] = [];
  for (let x = props.from; x <= props.to; x += 5) {
    pickets.push(`M${x - 1.6} 5 V-6 L${x} -9.4 L${x + 1.6} -6 V5z`);
  }
  const w = props.to - props.from + 4;
  return (
    <g>
      <rect x={props.from - 2} y="-5" width={w} height="1.8" fill="#bdb2cc" />
      <rect x={props.from - 2} y="0" width={w} height="1.8" fill="#bdb2cc" />
      <path d={pickets.join("")} fill="#ece4f4" />
    </g>
  );
}

/** 둥근 산울타리 덤불 */
function Bush(props: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${props.x} ${props.y}) scale(${props.s})`}>
      <path
        d="M-12 0 a6 6 0 0 1 3 -9 a7 7 0 0 1 12 -2 a6 6 0 0 1 8 6 a4 4 0 0 1 1 5z"
        fill="#1f3a2a"
      />
      <path
        d="M-4 -10 a7 7 0 0 1 7 -1 a6 6 0 0 1 6 4"
        stroke="#3a6a48"
        stroke-width="1.6"
        fill="none"
      />
    </g>
  );
}

function TarotCottage() {
  return (
    <g>
      {/* 굴뚝 (지붕 뒤) + 피어오르는 연기 */}
      <rect x="25" y="-100" width="11" height="34" fill="#6e4b52" />
      <path
        d="M25 -92 h11 M25 -84 h11 M25 -76 h11 M30 -100 v8 M28 -84 v8"
        stroke="#4a3238"
        stroke-width=".7"
      />
      <rect x="23" y="-104" width="15" height="4.4" fill="#3e2a32" />
      <g class="smoke" fill="#cfc6e8">
        <circle cx="31" cy="-110" r="3.6" opacity=".6" />
        <circle cx="35" cy="-117" r="4.4" opacity=".42" />
        <circle cx="30" cy="-124" r="5" opacity=".2" />
      </g>
      <Bush x={-48} y={-1} s={1} />
      <Bush x={50} y={-1} s={0.9} />
      <Picket from={-88} to={-58} />
      <Picket from={58} to={86} />
      <ellipse cx="0" cy="2" rx="62" ry="8" fill="#000" opacity=".3" />
      {/* 큰 지붕 (뾰족한 보라 슬레이트) */}
      <path d="M-55 -44 L-31 -94 L31 -94 L55 -44 Z" fill="url(#m-slate)" />
      <clipPath id="m-clip-slate">
        <path d="M-55 -44 L-31 -94 L31 -94 L55 -44 Z" />
      </clipPath>
      <path
        clip-path="url(#m-clip-slate)"
        d={SLATE_SCALES}
        stroke="#241846"
        stroke-width=".7"
        stroke-opacity=".7"
        fill="none"
      />
      <path d="M-31 -94 H31" stroke="#2a1c48" stroke-width="2.4" stroke-linecap="round" />
      <path d="M31 -94 L55 -44" stroke="#d9b8ff" stroke-width="1.2" stroke-opacity=".5" />
      {/* 돌 기단 */}
      <path d="M-45 0 H45 L43 -7 H-43Z" fill="#6a6470" />
      <path d="M-30 0 v-7 M-12 0 v-7 M8 0 v-7 M26 0 v-7" stroke="#4e4a56" stroke-width=".8" />
      {/* 하프팀버 벽: 회벽 + 짙은 나무 골조 */}
      <rect x="-41" y="-47" width="82" height="40" fill="url(#m-plaster)" />
      <path
        d="M-40 -7 L-17 -25 M-17 -7 L-40 -25 M40 -7 L17 -25 M17 -7 L40 -25"
        stroke="#4a3024"
        stroke-width="2.2"
      />
      <path d="M-41 -26 H-15 M15 -26 H41" stroke="#4a3024" stroke-width="2.6" />
      <path
        d="M-40 -7 V-47 M40 -7 V-47 M-15 -7 V-47 M15 -7 V-47"
        stroke="#4a3024"
        stroke-width="3"
      />
      <path d="M-44 -46 H44" stroke="#3a241a" stroke-width="3.6" />
      {/* 창 둘 (창가 촛불) */}
      {[-34, 21].map((x) => (
        <g key={x}>
          <rect x={x} y="-42" width="13" height="12" fill="#ffd98a" class="window" />
          <path d={`M${x + 6.5} -42 v12 M${x} -36 h13`} stroke="#4a3024" stroke-width="1" />
          <rect
            x={x}
            y="-42"
            width="13"
            height="12"
            fill="none"
            stroke="#3a241a"
            stroke-width="1.2"
          />
          <rect x={x - 1.5} y="-30" width="16" height="2" fill="#5a3a28" />
          <rect x={x + 2} y="-34" width="1.8" height="4" fill="#fff6e0" />
          <ellipse cx={x + 2.9} cy="-35.2" rx=".9" ry="1.4" fill="#ff9a3c" class="lglow" />
        </g>
      ))}
      {/* 아치형 문 + 별무늬 깔개 */}
      <path d="M-9 -7 V-28 A9 9 0 0 1 9 -28 V-7Z" fill="#5a3626" />
      <path d="M-4.5 -7 V-35 M0 -7 V-37 M4.5 -7 V-35" stroke="#3a2418" stroke-width=".7" />
      <path d="M-9 -7 V-28 A9 9 0 0 1 9 -28 V-7" stroke="#2a1a12" stroke-width="1.6" fill="none" />
      <circle cx="0" cy="-27" r="2.8" fill="#ffd98a" class="window" />
      <circle cx="5" cy="-16" r=".9" fill="#f2d38a" />
      <Glow x={0} y={1} rx={36} ry={9} o={0.8} />
      <ellipse cx="0" cy="1.6" rx="12" ry="2.8" fill="#5a3f8f" stroke="#f2d38a" stroke-width=".6" />
      <path
        d="M0 -.6 l.8 1.6 l1.8 .4 l-1.8 .4 l-.8 1.6 l-.8 -1.6 l-1.8 -.4 l1.8 -.4z"
        fill="#ffe7a6"
      />
      {/* 앞 박공 (뾰족 지붕 + 둥근 창) */}
      <path d="M-20 -46 L0 -98 L20 -46Z" fill="url(#m-plaster)" />
      <path d="M0 -46 V-60 M-13 -46 L-5 -62 M13 -46 L5 -62" stroke="#4a3024" stroke-width="2" />
      <circle cx="0" cy="-71" r="9.4" fill="#3a241a" />
      <circle cx="0" cy="-71" r="7.4" fill="#ffd98a" class="window" />
      <path d="M0 -78.4 v14.8 M-7.4 -71 h14.8" stroke="#3a241a" stroke-width="1.1" />
      <path d="M-29 -43 L0 -114 L29 -43 L21 -43 L0 -97 L-21 -43Z" fill="url(#m-slate)" />
      <path d="M0 -114 L29 -43" stroke="#d9b8ff" stroke-width="1.2" stroke-opacity=".55" />
      <path
        d="M0 -121 l1 2.6 l2.6 1 l-2.6 1 l-1 2.6 l-1 -2.6 l-2.6 -1 l2.6 -1z"
        fill="#f2d38a"
        class="twinkle"
      />
      {/* 수정구 달린 쇠 간판 */}
      <path d="M40 -42 H60 M41 -37 q9 0 12 -5" stroke="#2a2433" stroke-width="1.3" fill="none" />
      <g class="sway">
        <path d="M51 -42 v4 M59 -42 v4" stroke="#2a2433" stroke-width=".8" />
        <circle cx="55" cy="-31" r="11" fill="url(#m-crystal-glow)" class="pulse" />
        <circle cx="55" cy="-31" r="7" fill="#2a2433" stroke="#f2d38a" stroke-width=".9" />
        <circle cx="55" cy="-32" r="3.2" fill="url(#m-crystal)" />
        <path d="M52.6 -27.6 h4.8 l-.8 -1.4 h-3.2z" fill="#f2d38a" />
      </g>
      {/* 쇠 가로등 (노란 빛) */}
      <g transform="translate(-66 6)">
        <Glow x={0} y={0} rx={30} ry={8} o={0.9} />
        <path d="M-4.5 0 h9 l-2 -5 h-5z" fill="#2a2433" />
        <path d="M0 -4 V-58" stroke="#2a2433" stroke-width="2" />
        <path d="M0 -50 q6 -1 6 -6 q0 -3 -3 -3" stroke="#2a2433" stroke-width="1" fill="none" />
        <circle class="lglow" cx="0" cy="-63" r="18" fill="url(#m-flame)" />
        <path d="M-4.4 -58 h8.8 l1.6 -10 h-12z" fill="#ffe39a" />
        <path
          d="M-4.4 -58 h8.8 l1.6 -10 h-12z M0 -58 v-10"
          stroke="#2a2433"
          stroke-width="1"
          fill="none"
        />
        <path d="M-7.4 -68 h14.8 l-7.4 -5.4z" fill="#2a2433" />
        <circle cx="0" cy="-74.4" r="1.3" fill="#2a2433" />
      </g>
    </g>
  );
}

// ── 꿈해몽: 꿈속 찻집 (D-075) ──────────────────────────────────────
/** 둥실 떠 있는 구름 덩어리 */
function Puff(props: { x: number; y: number; s: number; i: number }) {
  return (
    <g transform={`translate(${props.x} ${props.y}) scale(${props.s})`}>
      <g class="bob" style={{ animationDelay: `${props.i * -1.7}s` }}>
        <path
          d="M-15 3 a5 5 0 0 1 3 -8 a7 7 0 0 1 11 -4 a6.5 6.5 0 0 1 11 4 a4.5 4.5 0 0 1 4 8z"
          fill="#ebe6ff"
          opacity=".9"
        />
        <path d="M-15 3 h29 q-4 2.6 -14 2.6 q-10 0 -15 -2.6z" fill="#b9b0e6" opacity=".8" />
      </g>
    </g>
  );
}

/** 꿈해몽 지붕: 처마선 (-74,-66) → (74,-66), 가운데 -54 */
const dreamEave = (t: number) => -66 + 48 * t * (1 - t);
const DREAM_ROOF =
  "M-74 -66 Q0 -42 74 -66 Q58 -68 50 -78 Q42 -88 0 -90 Q-42 -88 -50 -78 Q-58 -68 -74 -66Z";
/** 기와 골 (용마루에서 처마로 퍼진다) */
const DREAM_SEAMS = (() => {
  let d = "";
  for (let x = -72; x <= 72; x += 6) d += `M${(x * 0.6).toFixed(1)} -92 L${x} -44`;
  return d;
})();
/** 처마 끝 둥근 막새 */
const DREAM_TILES = (() => {
  let d = "";
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = -74 + 148 * t;
    const y = dreamEave(t) + 0.4;
    d += `M${(x - 1.9).toFixed(1)} ${y.toFixed(1)}a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0`;
  }
  return d;
})();
/** 작은 구름 무늬 */
const CLOUD_MARK = "M-7 0 q-1 -4.6 4 -4.4 q1.4 -4.6 6.4 -2.6 q4.8 -.6 3.6 4 q3 1.6 -.6 3z";

function DreamTeaHouse() {
  const eaveY = (x: number) => dreamEave((x + 74) / 148);
  return (
    <g>
      {/* 꿈결 같은 파스텔 빛무리 */}
      <circle class="pulse-slow" cx="0" cy="-58" r="92" fill="url(#m-dreamaura)" />
      <Puff x={-74} y={-96} s={0.8} i={0} />
      <Puff x={72} y={-104} s={0.62} i={1} />
      <ellipse cx="0" cy="2" rx="66" ry="8" fill="#000" opacity=".28" />
      <ellipse cx="0" cy="2" rx="70" ry="11" fill="url(#m-pastel)" />
      {/* 기단 (둥글린 돌) */}
      <path d="M-52 0 H52 Q55 -4 50 -7 H-50 Q-55 -4 -52 0Z" fill="#8a88a4" />
      <path d="M-50 -7 H50" stroke="#b4b0cc" stroke-width="1.2" />
      {/* 벽 + 기둥 */}
      <rect x="-46" y="-52" width="92" height="45" fill="url(#m-dreamwall)" />
      <path d="M-46 -16 H-20 M20 -16 H46" stroke="#b6a8cc" stroke-width="1" />
      {[-48, 44].map((x) => (
        <rect key={x} x={x} y="-53" width="4.4" height="46" rx="1.4" fill="#9a7f86" />
      ))}
      {/* 둥근 창 둘 */}
      {[-32, 32].map((x) => (
        <g key={x}>
          <circle cx={x} cy="-32" r="9" fill="#7a6a8a" />
          <circle cx={x} cy="-32" r="7.2" fill="#ffeccc" class="window" />
          <path d={`M${x - 7.2} -32 h14.4 M${x} -39.2 v14.4`} stroke="#9a86a8" stroke-width=".8" />
          <circle cx={x} cy="-32" r="3.4" fill="none" stroke="#9a86a8" stroke-width=".8" />
        </g>
      ))}
      {/* 달문 (둥근 문): 안쪽에 따뜻한 빛과 찻상 그림자 */}
      <circle cx="0" cy="-27" r="19.5" fill="#8e86a8" />
      <circle cx="0" cy="-27" r="16.5" fill="url(#m-moongate)" class="window" />
      <path d="M-14 -17 H14" stroke="#c99ab8" stroke-width="1" opacity=".6" />
      <path
        d="M-6 -17 h12 v-2.4 h-12z M-4 -17 v3 M4 -17 v3"
        fill="#b07a9a"
        stroke="#b07a9a"
        stroke-width=".8"
        opacity=".55"
      />
      <path
        d="M-1 -21 q-2 -3 0 -5 q2 -2 0 -4"
        stroke="#fff"
        stroke-width=".7"
        fill="none"
        opacity=".6"
      />
      <circle cx="0" cy="-27" r="19.5" fill="none" stroke="#c4bcdc" stroke-width=".8" />
      <Glow x={0} y={1} rx={34} ry={8} o={0.65} />
      {/* 인방 + 처마 그늘 */}
      <rect x="-50" y="-56" width="100" height="4.4" rx="1" fill="#a58a8a" />
      <path d="M-74 -66 Q0 -42 74 -66 L62 -59 Q0 -44 -62 -59Z" fill="#3a3456" />
      {/* 둥글게 휜 연청 기와지붕 (처마 끝이 부드럽게 들린다) */}
      <path d={DREAM_ROOF} fill="url(#m-dreamroof)" />
      <clipPath id="m-clip-dream">
        <path d={DREAM_ROOF} />
      </clipPath>
      <g clip-path="url(#m-clip-dream)" fill="none">
        <path d={DREAM_SEAMS} stroke="#45679a" stroke-opacity=".3" stroke-width="1.5" />
        <path
          d="M-74 -70 Q0 -50 74 -70 M-60 -79 Q0 -64 60 -79"
          stroke="#fff"
          stroke-opacity=".3"
          stroke-width="1"
        />
        <path
          d="M14 -92 C40 -90 54 -80 62 -68"
          stroke="#fff6e0"
          stroke-opacity=".4"
          stroke-width="2.4"
        />
      </g>
      {/* 처마 끝 막새 (연한 흰빛) */}
      <path d={DREAM_TILES} fill="#eef6ff" stroke="#6f92c4" stroke-width=".6" />
      {/* 지붕의 구름 장식 */}
      {[-34, 34].map((x) => (
        <path
          key={x}
          transform={`translate(${x} -72)`}
          d={CLOUD_MARK}
          fill="#f4f8ff"
          opacity=".9"
        />
      ))}
      {/* 용마루 + 양 끝 구름 + 처마 끝 구름 + 초승달 꼭지 */}
      <path
        d="M-46 -86 Q0 -95 46 -86"
        stroke="#eaf4ff"
        stroke-width="3.6"
        stroke-linecap="round"
        fill="none"
      />
      {(
        [
          [-50, -88, 1],
          [50, -88, 1],
          [-76, -67, 0.8],
          [76, -67, 0.8],
        ] as const
      ).map(([x, y, k]) => (
        <path
          key={x}
          transform={`translate(${x} ${y}) scale(${x < 0 ? -k : k} ${k})`}
          d={CLOUD_MARK}
          fill="#f8fbff"
        />
      ))}
      <path d="M0 -91 v-5" stroke="#c9a85a" stroke-width="1.2" />
      <path
        d="M2.4 -108 a5.6 5.6 0 1 0 0 11 a4.2 4.2 0 1 1 0 -11z"
        fill="#f6dc97"
        class="twinkle"
      />
      {/* 처마에 매달린 달 초롱 */}
      {(
        [
          [-60, 12],
          [-30, 3],
          [30, 3],
          [60, 12],
        ] as const
      ).map(([x, len], i) => {
        const top = eaveY(x);
        const cy = top + len + 4.6;
        return (
          <g key={x} class="sway" style={{ animationDelay: `${i * -0.8}s` }}>
            <line x1={x} y1={top} x2={x} y2={cy - 4.6} stroke="#5a4a6a" stroke-width=".8" />
            <circle cx={x} cy={cy} r="11" fill="url(#m-moonglow)" class="lglow" />
            <circle cx={x} cy={cy} r="4.6" fill="#fff3c8" />
            <path
              d={`M${x + 1.4} ${cy - 4.4} a4.6 4.6 0 0 1 0 8.8 a3.4 3.4 0 0 0 0 -8.8z`}
              fill="#e8cf86"
              opacity=".6"
            />
            <rect x={x - 1.8} y={cy - 5.6} width="3.6" height="1.4" rx=".6" fill="#7a6a8a" />
          </g>
        );
      })}
      {/* 마당의 달항아리 */}
      <g transform="translate(-74 4)">
        <ellipse cx="0" cy="0" rx="12" ry="3" fill="#000" opacity=".25" />
        <ellipse cx="0" cy="-11" rx="10" ry="10.5" fill="url(#m-moonjar)" />
        <rect x="-4" y="-22.5" width="8" height="2.4" rx="1" fill="#e9e3d4" />
        <ellipse cx="-3.5" cy="-14" rx="2.2" ry="4" fill="#fff" opacity=".6" />
      </g>
      {/* 작은 연못 + 디딤돌 + 물에 비친 달 */}
      <g transform="translate(57 6)">
        <ellipse cx="0" cy="0" rx="25" ry="7" fill="#58587e" />
        <ellipse cx="0" cy="-.4" rx="23" ry="5.8" fill="url(#m-water)" />
        <ellipse class="twinkle" cx="7" cy="-1" rx="4" ry="1.3" fill="#fff6d0" opacity=".8" />
        <ellipse
          cx="-6"
          cy="1"
          rx="8"
          ry="2"
          fill="none"
          stroke="#d8f0ff"
          stroke-width=".5"
          opacity=".5"
        />
        {[
          [-15, 1, 4.6],
          [-5, -1.4, 4],
          [4, 1.6, 4.4],
        ].map(([x, y, rx]) => (
          <g key={x}>
            <ellipse cx={x} cy={(y as number) + 0.8} rx={rx} ry="1.9" fill="#3e3c58" />
            <ellipse cx={x} cy={y} rx={rx} ry="1.8" fill="#b4b0c8" />
          </g>
        ))}
      </g>
      <Puff x={78} y={-58} s={0.48} i={2} />
    </g>
  );
}

/** 족집게집 (D-100): 판자벽 점방, 황동빛 골함석 맞배지붕, 큰 유리창, 돋보기 간판, "용하다" 깃발, 궤짝·평상 */
function JokjipgeShop() {
  const bulbs = Array.from({ length: 11 }, (_, i) => {
    const t = (i + 0.5) / 11;
    return { x: -62 + 124 * t, y: -57 + 9 * 4 * t * (1 - t) };
  });
  return (
    <g>
      <ellipse cx="0" cy="2" rx="80" ry="10" fill="#000" opacity=".3" />
      <Glow x={0} y={4} rx={70} ry={14} o={0.8} />
      {/* 기단 */}
      <rect x="-58" y="-7" width="116" height="7" fill="#6e6a64" />
      <path d="M-58 -7 H58" stroke="#9a948a" stroke-width="1.2" />
      {/* 판자벽 */}
      <rect x="-52" y="-64" width="104" height="57" fill="url(#m-plank)" />
      <path
        d="M-52 -57 H52 M-52 -50 H52 M-52 -43 H52 M-52 -36 H52 M-52 -29 H52 M-52 -22 H52 M-52 -15 H52"
        stroke="#2e1e14"
        stroke-opacity=".45"
        stroke-width=".7"
      />
      {/* 큰 미닫이 유리창 둘 */}
      {[-46, 16].map((x) => (
        <g key={x}>
          <rect x={x} y="-48" width="30" height="30" fill="#ffcf86" class="window" />
          <path
            d={`M${x + 15} -48 v30 M${x + 7.5} -48 v30 M${x + 22.5} -48 v30 M${x} -38 h30 M${x} -28 h30`}
            stroke="#3a2a1e"
            stroke-width="1.1"
          />
          <rect
            x={x}
            y="-48"
            width="30"
            height="30"
            fill="none"
            stroke="#3a2a1e"
            stroke-width="2"
          />
          <rect x={x - 2} y="-18" width="34" height="2.4" fill="#5a3c28" />
        </g>
      ))}
      {/* 안쪽 실루엣 (선반 위 단지) */}
      <path
        d="M-44 -33 h26 M-41 -33 v-5 h4 v5 M-33 -33 v-7 h5 v7 M-25 -33 v-4 h4 v4"
        stroke="#7a4a2a"
        stroke-width="1"
        fill="none"
        opacity=".7"
      />
      {/* 유리 미닫이 문 */}
      <rect x="-12" y="-52" width="24" height="45" fill="#ffcf86" class="window" />
      <path d="M0 -52 v45 M-12 -38 h24 M-12 -24 h24" stroke="#3a2a1e" stroke-width="1.2" />
      <rect
        x="-12"
        y="-52"
        width="24"
        height="45"
        fill="none"
        stroke="#3a2a1e"
        stroke-width="2.2"
      />
      {/* 문 위 현판 */}
      <rect
        x="-19"
        y="-62.5"
        width="38"
        height="9"
        rx="1"
        fill="url(#m-wood)"
        stroke="#e0b45e"
        stroke-width=".9"
      />
      <text x="0" y="-55.6" text-anchor="middle" font-size="6.4" fill="#ffe0a0" font-weight="700">
        족집게
      </text>
      {/* 골함석 맞배지붕 (앞에서 본 처마 쪽 경사면) */}
      <path d="M-68 -62 H68 L56 -94 H-56 Z" fill="url(#m-tin)" />
      <path
        d={Array.from({ length: 27 }, (_, i) => {
          const t = i / 26;
          return `M${-68 + 136 * t} -62 L${-56 + 112 * t} -94`;
        }).join(" ")}
        stroke="#8a6630"
        stroke-opacity=".55"
        stroke-width=".9"
      />
      <path d="M-68 -62 H68" stroke="#5a4020" stroke-width="2.4" />
      <rect x="-58" y="-97" width="116" height="4" rx="2" fill="#c99a48" />

      {/* 처마 끝 전구 줄 */}
      <path d="M-64 -59 Q0 -41 64 -59" stroke="#1e1a18" stroke-width=".9" fill="none" />
      {bulbs.map((b, i) => (
        <g key={b.x}>
          <circle
            class="lglow"
            style={{ animationDelay: `${i * -0.4}s` }}
            cx={b.x}
            cy={b.y + 3}
            r="6"
            fill="url(#m-flame)"
          />
          <circle cx={b.x} cy={b.y + 3} r="1.7" fill="#ffe6b0" />
        </g>
      ))}
      {/* 큰 돋보기 간판: 황동 테 + 가운데 눈 */}
      <path d="M26 -61 L27 -55 M36 -61 L35 -55" stroke="#2a2420" stroke-width=".8" />
      <circle cx="31" cy="-44" r="14" fill="url(#m-flame)" class="pulse" />
      <path d="M37.5 -37.5 L46 -28" stroke="#5a3420" stroke-width="3.6" stroke-linecap="round" />
      <circle cx="31" cy="-44" r="9.5" fill="#fff2d2" />
      <path
        d="M24.5 -44 q6.5 -6 13 0 q-6.5 6 -13 0z"
        fill="#fffdf6"
        stroke="#2a1a12"
        stroke-width="1"
      />
      <circle cx="31" cy="-44" r="2.6" fill="#6a4424" />
      <circle cx="31" cy="-44" r="1.3" fill="#140c08" />
      <circle cx="31" cy="-44" r="9.5" fill="none" stroke="#e0b45e" stroke-width="2.6" />
      {/* "용하다" 깃발 */}
      <path d="M-62 0 V-100" stroke="#b8a060" stroke-width="2" />
      <g class="flag">
        <rect
          x="-61"
          y="-96"
          width="13"
          height="38"
          fill="#f2e8d2"
          stroke="#b8322a"
          stroke-width="1.5"
        />
        {["용", "하", "다"].map((ch, i) => (
          <text
            key={ch}
            x="-54.5"
            y={-85 + i * 11}
            text-anchor="middle"
            font-size="8"
            font-weight="700"
            fill="#1e1612"
          >
            {ch}
          </text>
        ))}
      </g>
      {/* 나무 궤짝 (왼쪽) */}
      <g>
        <rect x="-84" y="-13" width="17" height="13" fill="#7a5a3a" />
        <rect x="-82" y="-25" width="15" height="12" fill="#8a6440" />
        <path
          d="M-84 -9 h17 M-84 -4.5 h17 M-82 -21 h15 M-82 -17 h15"
          stroke="#4a3220"
          stroke-width=".8"
        />
        {[-79, -75, -71].map((x) => (
          <circle key={x} cx={x} cy="-26" r="2.3" fill="#c83a2a" />
        ))}
      </g>
      {/* 평상 + 노란 주전자 (오른쪽) */}
      <g>
        <rect x="58" y="-10" width="26" height="3" fill="#a07a50" />
        <path d="M60 -7 v7 M82 -7 v7" stroke="#3a2a1e" stroke-width="1.6" />
        <path d="M66 -10 v-5 q3 -2 6 0 v5 z" fill="#e8c860" />
        <path d="M72 -13 l3 -2" stroke="#e8c860" stroke-width="1.2" />
        <ellipse cx="78" cy="-11" rx="2.6" ry="1.2" fill="#f4f0e6" />
      </g>
    </g>
  );
}

/** 당산나무 (F18): 둥근 수관, 오색 천, 금줄, 옆의 돌탑 */
function WishTreeArt() {
  const cloth = ["#e0473a", "#f2c94c", "#3f7fd9", "#f4f1ea", "#4caf6a"];
  const r = rng(77);
  const strips = Array.from({ length: 26 }, (_, i) => {
    const a = r() * Math.PI;
    const rad = 26 + r() * 30;
    return {
      x: Math.cos(a) * rad * (r() < 0.5 ? -1 : 1),
      y: -64 + Math.sin(a) * 10 + r() * 14,
      c: cloth[i % cloth.length] as string,
      d: (r() * 3).toFixed(2),
    };
  });
  return (
    <g>
      <ellipse cx="0" cy="2" rx="64" ry="12" fill="#2a2234" opacity=".55" />
      {/* 돌 단 */}
      <ellipse cx="0" cy="-2" rx="44" ry="9" fill="#6f6a62" />
      <ellipse cx="0" cy="-5" rx="42" ry="7" fill="#8d877c" />
      {/* 줄기 */}
      <path d="M-10 -6 C-12 -30 -8 -48 -4 -62 L6 -62 C10 -46 12 -28 12 -6z" fill="#4a3526" />
      <path
        d="M-4 -60 C-20 -70 -34 -72 -44 -70 M6 -60 C22 -72 36 -74 46 -70"
        stroke="#4a3526"
        stroke-width="5"
        fill="none"
        stroke-linecap="round"
      />
      {/* 금줄 */}
      <path d="M-11 -30 Q1 -24 12 -30" stroke="#c9a86a" stroke-width="2.4" fill="none" />
      {[-6, 0, 6].map((x) => (
        <rect key={x} x={x - 1.5} y="-29" width="3" height="7" fill="#f4f1ea" />
      ))}
      {/* 수관 */}
      <ellipse cx="0" cy="-92" rx="58" ry="34" fill="#2f5a33" />
      <ellipse cx="-30" cy="-80" rx="32" ry="22" fill="#3b6c3c" />
      <ellipse cx="30" cy="-82" rx="32" ry="22" fill="#3b6c3c" />
      <ellipse cx="0" cy="-108" rx="38" ry="22" fill="#46783f" />
      {/* 오색 천 */}
      {strips.map((s, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 장식 목록
          key={i}
          class="map-cloth"
          x={s.x}
          y={s.y}
          width="3.2"
          height="13"
          rx="1"
          fill={s.c}
          style={{ animationDelay: `${s.d}s` }}
        />
      ))}
      {/* 돌탑 */}
      <g transform="translate(48 -2)">
        <ellipse cx="0" cy="0" rx="13" ry="5" fill="#6f6a62" />
        <ellipse cx="0" cy="-7" rx="10" ry="4.5" fill="#8d877c" />
        <ellipse cx="0" cy="-13" rx="7.5" ry="3.8" fill="#7d776d" />
        <ellipse cx="0" cy="-18.5" rx="5" ry="3" fill="#9a9488" />
        <ellipse cx="0" cy="-22.5" rx="3" ry="2" fill="#8d877c" />
      </g>
      <circle cx="-30" cy="-6" r="10" fill="url(#m-glow)" opacity=".8" />
    </g>
  );
}

/** 점집별 외관 (08 §1 점집별 외관, D-075) */
function ShopDecor(props: { shop: ShopId }) {
  switch (props.shop) {
    case "saju":
      return <SajuHanok />;
    case "tarot":
      return <TarotCottage />;
    case "dolyeong":
      return <DolyeongShrine />;
    case "dream":
      return <DreamTeaHouse />;
    case "jokjipge":
      return <JokjipgeShop />;
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

/** 지도에서 고를 수 있는 곳: 점집 다섯 + 당산나무 (F18) */
export type MapSpot = ShopId | "tree";

/** 당산나무 자리: 길 끝, 사주집과 타로집 사이 언덕 (멀어서 작게) */
const TREE_SPOT = { x: 210, y: 206, s: 0.62 };

export function MapArt(props: {
  selected: MapSpot | null;
  onSelect: (s: MapSpot) => void;
  /** 흐리게 두는 곳 (같이 보기 중 족집게집, F19). 눌리기는 한다 (안내는 MapScreen이 띄운다) */
  locked?: MapSpot[];
}) {
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
    const locked = props.locked?.includes(sp.id) ?? false;
    items.push({
      y: sp.y,
      el: (
        <g
          key={sp.id}
          class={`shop ${on ? "on" : ""} ${dim ? "dim" : ""} ${locked ? "locked" : ""}`}
          // biome-ignore lint/a11y/useSemanticElements: SVG 안에는 <button>을 둘 수 없다
          role="button"
          tabIndex={0}
          aria-label={`${info.name}, ${info.master}${locked ? " (혼자 들어가는 곳)" : ""}`}
          aria-disabled={locked}
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
  {
    const on = props.selected === "tree";
    const dim = props.selected !== null && !on;
    items.push({
      y: TREE_SPOT.y,
      el: (
        <g
          key="tree"
          class={`shop ${on ? "on" : ""} ${dim ? "dim" : ""}`}
          // biome-ignore lint/a11y/useSemanticElements: SVG 안에는 <button>을 둘 수 없다
          role="button"
          tabIndex={0}
          aria-label="당산나무, 소원 빌기"
          aria-pressed={on}
          onClick={() => props.onSelect("tree")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              props.onSelect("tree");
            }
          }}
          transform={`translate(${TREE_SPOT.x} ${TREE_SPOT.y})`}
        >
          <g class="shop-art" style={{ transform: `scale(${TREE_SPOT.s})` }}>
            {on && <ellipse class="ring" cx="0" cy="2" rx="70" ry="14" />}
            <WishTreeArt />
            <g class="map-plaque" transform="translate(0 12)">
              <rect
                x="-40"
                y="0"
                width="80"
                height="24"
                rx="3"
                fill="url(#m-wood)"
                stroke="#f2d38a"
                stroke-width="1.5"
              />
              <text x="0" y="17" text-anchor="middle" class="map-label">
                당산나무
              </text>
            </g>
            <rect x="-70" y="-140" width="140" height="176" fill="transparent" />
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
        {/* 족집게집: 판자벽, 황동빛 골함석 */}
        <linearGradient id="m-plank" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4a3222" />
          <stop offset=".35" stop-color="#7a5438" />
          <stop offset="1" stop-color="#5e4030" />
        </linearGradient>
        <linearGradient id="m-tin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f4d080" />
          <stop offset=".5" stop-color="#d4a24e" />
          <stop offset="1" stop-color="#9a7234" />
        </linearGradient>
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
        {/* 사주집: 먹색 기와 + 한지 벽 */}
        <linearGradient id="m-roof-saju" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={SHOP_INFO.saju.tint} stop-opacity=".9" />
          <stop offset=".18" stop-color={SHOP_INFO.saju.roof} />
          <stop offset="1" stop-color={SHOP_INFO.saju.roof} stop-opacity=".85" />
        </linearGradient>
        <linearGradient id="m-wall-saju" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#a99b84" />
          <stop offset=".3" stop-color="#e9dcc0" />
          <stop offset="1" stop-color="#d9c9a6" />
        </linearGradient>
        {/* 아기도령: 짚 지붕, 흙벽, 붉은 횃불, 붉은 보라 안개 */}
        <linearGradient id="m-thatch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c4a466" />
          <stop offset=".5" stop-color="#94743f" />
          <stop offset="1" stop-color="#5e472a" />
        </linearGradient>
        <linearGradient id="m-mud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#5e4836" />
          <stop offset=".35" stop-color="#94785a" />
          <stop offset="1" stop-color="#7a5f46" />
        </linearGradient>
        <radialGradient id="m-redglow">
          <stop offset="0" stop-color="#ff5a3a" stop-opacity=".55" />
          <stop offset=".5" stop-color="#d0304a" stop-opacity=".2" />
          <stop offset="1" stop-color="#a0206a" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="m-torch">
          <stop offset="0" stop-color="#ffd2a0" stop-opacity=".9" />
          <stop offset=".3" stop-color="#ff5a3a" stop-opacity=".45" />
          <stop offset="1" stop-color="#c02050" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="m-fog">
          <stop offset="0" stop-color="#b0407a" stop-opacity=".5" />
          <stop offset=".6" stop-color="#7a2a7a" stop-opacity=".2" />
          <stop offset="1" stop-color="#5a2070" stop-opacity="0" />
        </radialGradient>
        {/* 타로집: 보라 슬레이트, 회벽 */}
        <linearGradient id="m-slate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8a64cc" />
          <stop offset=".4" stop-color="#5f3f9e" />
          <stop offset="1" stop-color="#3a2668" />
        </linearGradient>
        <linearGradient id="m-plaster" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#a89c8c" />
          <stop offset=".3" stop-color="#e8dcc4" />
          <stop offset="1" stop-color="#cdbda2" />
        </linearGradient>
        {/* 꿈해몽: 연청 지붕, 라벤더 벽, 달문 빛, 연못 */}
        <linearGradient id="m-dreamroof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d8ecfa" />
          <stop offset=".45" stop-color="#9cc2e4" />
          <stop offset="1" stop-color="#6f92c4" />
        </linearGradient>
        <linearGradient id="m-dreamwall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#a49cc0" />
          <stop offset=".3" stop-color="#ece4f6" />
          <stop offset="1" stop-color="#d4cae6" />
        </linearGradient>
        <radialGradient id="m-moongate" cy=".6">
          <stop offset="0" stop-color="#fff4d8" />
          <stop offset=".6" stop-color="#ffd2dc" />
          <stop offset="1" stop-color="#c8a6ea" />
        </radialGradient>
        <radialGradient id="m-water" cx=".6" cy=".4">
          <stop offset="0" stop-color="#a8dcf0" />
          <stop offset="1" stop-color="#4a6a9e" />
        </radialGradient>
        <radialGradient id="m-pastel">
          <stop offset="0" stop-color="#ffc8e4" stop-opacity=".45" />
          <stop offset=".5" stop-color="#c8b4ff" stop-opacity=".2" />
          <stop offset="1" stop-color="#a8c8ff" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="m-dreamaura">
          <stop offset="0" stop-color="#d8c8ff" stop-opacity=".3" />
          <stop offset=".5" stop-color="#a8d0f0" stop-opacity=".12" />
          <stop offset="1" stop-color="#a8d0f0" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="m-moonglow">
          <stop offset="0" stop-color="#fff6d0" stop-opacity=".9" />
          <stop offset=".35" stop-color="#ffe6a8" stop-opacity=".4" />
          <stop offset="1" stop-color="#c9b8ff" stop-opacity="0" />
        </radialGradient>
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
            fill={sp.yard}
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
