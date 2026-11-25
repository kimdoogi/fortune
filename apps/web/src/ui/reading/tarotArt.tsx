/**
 * 메이저 아르카나 22장 카드 그림 (D-030: 코드로 만든 SVG).
 * 모든 카드가 같은 틀(남보라 바탕 + 금박 테두리 + 로마 숫자 + 한글 이름)을 쓰고,
 * 가운데 상징만 기본 도형으로 그린다. 좌표계는 100×160.
 */
import type { JSX } from "preact";
import { useId } from "preact/hooks";

/** 카드 이름 (packages/fortune-engine/data/meanings/tarot.json과 같은 순서) */
export const TAROT_NAMES = [
  "바보",
  "마법사",
  "여사제",
  "여황제",
  "황제",
  "교황",
  "연인",
  "전차",
  "힘",
  "은둔자",
  "운명의 수레바퀴",
  "정의",
  "매달린 사람",
  "죽음",
  "절제",
  "악마",
  "탑",
  "별",
  "달",
  "태양",
  "심판",
  "세계",
] as const;

const GOLD = "#ecca7c";
const GOLD_SOFT = "#f7e6b5";

/** 0은 "0", 그 밖은 로마 숫자 */
export function toRoman(n: number): string {
  if (n <= 0) return "0";
  const table: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let rest = n;
  for (const [v, s] of table) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

/** 꼭짓점 n개 별 */
export function starPath(cx: number, cy: number, r: number, inner: number, n = 5): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const rr = i % 2 === 0 ? r : inner;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

const heartPath = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy + s * 0.9}C${cx - s * 1.4} ${cy - s * 0.1} ${cx - s * 0.7} ${cy - s * 1.1} ${cx} ${cy - s * 0.35}C${cx + s * 0.7} ${cy - s * 1.1} ${cx + s * 1.4} ${cy - s * 0.1} ${cx} ${cy + s * 0.9}Z`;

const infinity = (cx: number, cy: number, w: number) =>
  `M${cx} ${cy}c${-w * 0.25} ${-w * 0.32} ${-w * 0.5} ${-w * 0.32} ${-w * 0.5} 0s${w * 0.25} ${w * 0.32} ${w * 0.5} 0 ${w * 0.25} ${-w * 0.32} ${w * 0.5} 0 ${-w * 0.25} ${w * 0.32} ${-w * 0.5} 0Z`;

/** 왼쪽으로 부푼 초승달: 바깥 반원 + 더 큰 반지름의 안쪽 호 */
const crescent = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r}A${r} ${r} 0 0 0 ${cx} ${cy + r}A${r * 1.25} ${r * 1.25} 0 0 1 ${cx} ${cy - r}Z`;

/** 해살: 긴 살과 짧은 살을 번갈아 */
function rays(cx: number, cy: number, r1: number, r2: number, r3: number, n: number) {
  const out: JSX.Element[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const r = i % 2 === 0 ? r2 : r3;
    out.push(
      <line
        key={i}
        x1={cx + r1 * Math.cos(a)}
        y1={cy + r1 * Math.sin(a)}
        x2={cx + r * Math.cos(a)}
        y2={cy + r * Math.sin(a)}
      />,
    );
  }
  return out;
}

const fill = { fill: GOLD, stroke: "none" };
const soft = { fill: GOLD, "fill-opacity": 0.22 };

/** 카드별 상징. 가운데 (50, 80) 둘레 지름 60 안에 그린다 */
export const EMBLEMS: (() => JSX.Element)[] = [
  // 0 바보: 새벽 해, 벼랑 끝, 봇짐 지팡이, 작은 꽃
  () => (
    <g>
      <circle cx="67" cy="58" r="7" {...fill} />
      <g>{rays(67, 58, 10, 15, 12, 12)}</g>
      <path d="M22 112V98q18-6 36 1l8 13" />
      <path d="M34 98L54 64" />
      <circle cx="56" cy="62" r="4.5" {...soft} />
      <path d="M28 92c2-4 6-4 6 0-3 1-5 2-6 0z" />
      <path d="M31 92v6" />
    </g>
  ),
  // 1 마법사: 무한대, 지팡이, 탁자 위 잔·동전·칼
  () => (
    <g>
      <path d={infinity(50, 56, 24)} />
      <path d="M50 66v32" />
      <circle cx="50" cy="66" r="2.4" {...fill} />
      <path d="M26 106h48" />
      <path d="M30 98h8l-1 6h-6z" />
      <circle cx="50" cy="102" r="3.2" {...soft} />
      <path d="M62 104l10-10M66 96l4 4" />
    </g>
  ),
  // 2 여사제: 두 기둥과 초승달, 두루마리
  () => (
    <g>
      <rect x="25" y="54" width="8" height="56" rx="1" {...fill} fill-opacity="0.85" />
      <rect x="67" y="54" width="8" height="56" rx="1" />
      <path d="M23 54h12M65 54h12" />
      <path d={crescent(55, 70, 11)} {...fill} />
      <rect x="42" y="88" width="16" height="14" rx="2" />
      <path d="M45 93h10M45 97h7" />
    </g>
  ),
  // 3 여황제: 별 왕관과 금성 표식
  () => (
    <g>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const a = Math.PI + (Math.PI * (i + 0.5)) / 7;
        return (
          <path
            key={i}
            d={starPath(50 + 22 * Math.cos(a), 72 + 22 * Math.sin(a), 3, 1.2)}
            {...fill}
          />
        );
      })}
      <circle cx="50" cy="78" r="11" {...soft} />
      <path d="M50 89v18M43 99h14" />
      <path d="M30 110q20-8 40 0" />
    </g>
  ),
  // 4 황제: 숫양 뿔 옥좌와 왕관
  () => (
    <g>
      <rect x="35" y="66" width="30" height="42" rx="2" />
      <path d="M35 74c-8 0-10-10-4-12 4-1 6 3 3 5M65 74c8 0 10-10 4-12-4-1-6 3-3 5" />
      <path d="M41 66v-8l4.5 4 4.5-8 4.5 8 4.5-4v8" {...soft} />
      <circle cx="50" cy="86" r="6" />
      <path d="M50 80v-4M47 77h6" />
      <path d="M30 108h40" />
    </g>
  ),
  // 5 교황: 삼중 십자가와 엇갈린 열쇠 둘
  () => (
    <g>
      <path d="M50 50v50M44 58h12M41 65h18M38 72h24" />
      <path d="M34 112l16-12 16 12" />
      <circle cx="32" cy="113" r="3.5" />
      <circle cx="68" cy="113" r="3.5" />
      <circle cx="50" cy="86" r="18" stroke-dasharray="2 3" opacity="0.6" />
    </g>
  ),
  // 6 연인: 해 아래 두 하트
  () => (
    <g>
      <circle cx="50" cy="56" r="5.5" {...fill} />
      <g>{rays(50, 56, 8, 13, 10, 12)}</g>
      <path d={heartPath(41, 86, 11)} {...soft} />
      <path d={heartPath(59, 86, 11)} />
      <path d="M30 110q20-6 40 0" />
    </g>
  ),
  // 7 전차: 별 덮개, 수레, 두 바퀴
  () => (
    <g>
      <path d="M32 72q18-20 36 0" />
      <path d={starPath(42, 66, 2.6, 1)} {...fill} />
      <path d={starPath(50, 62, 3, 1.2)} {...fill} />
      <path d={starPath(58, 66, 2.6, 1)} {...fill} />
      <path d="M32 72v24h36V72" />
      <rect x="40" y="78" width="20" height="10" rx="2" {...soft} />
      <circle cx="38" cy="102" r="7" />
      <circle cx="62" cy="102" r="7" />
      <path d="M38 95v14M31 102h14M62 95v14M55 102h14" opacity="0.7" />
    </g>
  ),
  // 8 힘: 무한대와 사자 갈기
  () => (
    <g>
      <path d={infinity(50, 54, 20)} />
      <circle cx="50" cy="88" r="10" {...soft} />
      <g>{rays(50, 88, 13, 21, 18, 16)}</g>
      <circle cx="46" cy="86" r="1.2" {...fill} />
      <circle cx="54" cy="86" r="1.2" {...fill} />
      <path d="M47 92q3 2 6 0" />
    </g>
  ),
  // 9 은둔자: 육각별을 품은 등불과 지팡이
  () => (
    <g>
      <path d="M66 50v62" />
      <path d="M66 56q-10 0-18 10" />
      <circle cx="46" cy="82" r="17" {...soft} stroke="none" />
      <path d="M38 70h16l4 6v14l-4 6H38l-4-6V76z" />
      <path d={starPath(46, 83, 6.5, 3.6, 6)} {...fill} />
      <path d="M40 70l6-4 6 4" />
    </g>
  ),
  // 10 운명의 수레바퀴
  () => (
    <g>
      <circle cx="50" cy="80" r="27" />
      <circle cx="50" cy="80" r="19" />
      <circle cx="50" cy="80" r="5" {...fill} />
      <g>{rays(50, 80, 5, 27, 27, 8)}</g>
      {[0, 1, 2, 3].map((i) => {
        const a = (Math.PI / 2) * i + Math.PI / 4;
        return (
          <circle key={i} cx={50 + 23 * Math.cos(a)} cy={80 + 23 * Math.sin(a)} r="2" {...fill} />
        );
      })}
    </g>
  ),
  // 11 정의: 세운 칼과 저울
  () => (
    <g>
      <path d="M50 50v54M43 62h14" />
      <circle cx="50" cy="106" r="2.5" {...fill} />
      <path d="M28 70h44" />
      <path d="M32 70l-6 18M32 70l6 18M68 70l-6 18M68 70l6 18" opacity="0.8" />
      <path d="M24 88q8 7 16 0zM60 88q8 7 16 0z" {...soft} />
      <path d={starPath(50, 50, 3, 1.3)} {...fill} />
    </g>
  ),
  // 12 매달린 사람: T자 나무에 거꾸로, 머리 둘레 후광
  () => (
    <g>
      <path d="M26 54h48M30 54v-4M70 54v-4" />
      <path d="M50 54v10" />
      <path d="M50 64v20M50 70l8 5-8 5" />
      <path d="M42 84h16l-8 6z" {...soft} />
      <circle cx="50" cy="96" r="5" {...fill} />
      <circle cx="50" cy="96" r="10" stroke-dasharray="2 2.5" />
    </g>
  ),
  // 13 죽음: 두 탑 사이로 떠오르는 해와 흰 장미 (끝이 아닌 바뀜)
  () => (
    <g>
      <path d="M22 104h56" />
      <path d="M38 104a12 12 0 0 1 24 0" {...soft} />
      <rect x="26" y="88" width="7" height="16" />
      <rect x="67" y="88" width="7" height="16" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        return <circle key={i} cx={50 + 6 * Math.cos(a)} cy={68 + 6 * Math.sin(a)} r="5.2" />;
      })}
      <circle cx="50" cy="68" r="3" {...fill} />
    </g>
  ),
  // 14 절제: 두 잔 사이로 흐르는 물, 위에 삼각
  () => (
    <g>
      <path d="M44 58l6-10 6 10z" />
      <path d="M28 68h14l-2 12h-10z" {...soft} />
      <path d="M58 92h14l-2 12h-10z" {...soft} />
      <path d="M40 72q16 2 22 20" stroke-dasharray="1 3" stroke-width="2.4" />
      <path d="M26 112q12-6 24 0t24 0" opacity="0.7" />
    </g>
  ),
  // 15 악마: 굽은 두 뿔과 사슬
  () => (
    <g>
      <path d="M38 66c-10-4-12-14-8-18 0 8 6 10 12 10M62 66c10-4 12-14 8-18 0 8-6 10-12 10" />
      <circle cx="50" cy="72" r="11" {...soft} />
      <path d={starPath(50, 72, 5, 2)} {...fill} />
      <rect x="36" y="90" width="28" height="7" rx="1" />
      <ellipse cx="40" cy="103" rx="3" ry="4.5" />
      <ellipse cx="40" cy="111" rx="3" ry="4.5" />
      <ellipse cx="60" cy="103" rx="3" ry="4.5" />
      <ellipse cx="60" cy="111" rx="3" ry="4.5" />
    </g>
  ),
  // 16 탑: 번개 맞은 탑과 떨어지는 왕관
  () => (
    <g>
      <path d="M40 112l3-46h14l3 46z" {...soft} />
      <path d="M46 78h3v6h-3zM52 92h3v6h-3z" {...fill} />
      <path d="M58 60l5-7 3 4 4-6 1 8 3-2-2 8z" />
      <path d="M26 46l12 10-6 2 12 10" stroke-width="2.2" />
      <circle cx="30" cy="80" r="1.4" {...fill} />
      <circle cx="70" cy="86" r="1.4" {...fill} />
      <circle cx="34" cy="96" r="1.2" {...fill} />
      <circle cx="66" cy="102" r="1.2" {...fill} />
    </g>
  ),
  // 17 별: 큰 팔각별과 작은 별 일곱, 아래 물결
  () => (
    <g>
      <path d={starPath(50, 70, 17, 6, 8)} {...fill} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const a = Math.PI + (Math.PI * (i + 0.5)) / 7;
        return (
          <path
            key={i}
            d={starPath(50 + 30 * Math.cos(a), 74 + 26 * Math.sin(a), 3, 1.1, 8)}
            {...fill}
          />
        );
      })}
      <path d="M24 102q6-4 13 0t13 0 13 0 13 0M28 110q5-3 11 0t11 0 11 0 11 0" />
    </g>
  ),
  // 18 달: 초승달, 두 탑, 이어지는 길
  () => (
    <g>
      <circle cx="50" cy="64" r="15" {...soft} />
      <path d={crescent(57, 64, 13)} {...fill} />
      <path d="M26 112V90h7v22M67 112V90h7v22" />
      <path d="M26 90l3.5-4 3.5 4M67 90l3.5-4 3.5 4" />
      <path d="M50 112q-6-6 0-12t0-12" stroke-dasharray="2 2.5" />
      <path d="M40 84v2M60 82v2M50 86v2" />
    </g>
  ),
  // 19 태양
  () => (
    <g>
      <circle cx="50" cy="78" r="13" {...fill} />
      <g>{rays(50, 78, 17, 30, 23, 16)}</g>
      <circle cx="50" cy="78" r="17" opacity="0.6" />
      <path d="M26 112q24-8 48 0" />
    </g>
  ),
  // 20 심판: 깃발 단 나팔과 일어나는 빛
  () => (
    <g>
      <path d="M28 54l30 12-2 5-30-12z" {...soft} />
      <path d="M58 66l8 2-3 8-7-5" />
      <rect x="36" y="64" width="10" height="10" />
      <path d="M41 66v6M38 69h6" />
      <path d="M34 112h32v-8H34z" />
      <path d="M40 102V88M50 102V82M60 102V88" />
      <path d="M37 91l3-3 3 3M47 85l3-3 3 3M57 91l3-3 3 3" />
    </g>
  ),
  // 21 세계: 월계관 고리와 네 귀퉁이
  () => (
    <g>
      <ellipse cx="50" cy="80" rx="19" ry="27" />
      {Array.from({ length: 18 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 18;
        const x = 50 + 19 * Math.cos(a);
        const y = 80 + 27 * Math.sin(a);
        const deg = (a * 180) / Math.PI + 90;
        return (
          <ellipse
            // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 장식 목록
            key={i}
            cx={x}
            cy={y}
            rx="2"
            ry="4.4"
            transform={`rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})`}
            {...soft}
          />
        );
      })}
      <path d={starPath(50, 80, 7, 3)} {...fill} />
      <circle cx="24" cy="54" r="2.4" {...fill} />
      <circle cx="76" cy="54" r="2.4" {...fill} />
      <circle cx="24" cy="108" r="2.4" {...fill} />
      <circle cx="76" cy="108" r="2.4" {...fill} />
    </g>
  ),
];

/** 바탕에 흩뿌린 작은 별 (모든 카드 같은 자리) */
const DUST: [number, number, number][] = [
  [18, 34, 0.9],
  [82, 30, 1.1],
  [16, 120, 0.8],
  [86, 116, 1],
  [26, 44, 0.6],
  [76, 128, 0.7],
  [84, 72, 0.6],
  [14, 82, 0.7],
];

function Frame(props: { uid: string; children: JSX.Element | JSX.Element[] }) {
  const { uid } = props;
  return (
    <>
      <defs>
        <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#262a63" />
          <stop offset="0.55" stop-color="#1b1c47" />
          <stop offset="1" stop-color="#2c1d4d" />
        </linearGradient>
        <radialGradient id={`${uid}halo`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color={GOLD} stop-opacity="0.32" />
          <stop offset="1" stop-color={GOLD} stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="98"
        height="158"
        rx="7"
        fill={`url(#${uid}bg)`}
        stroke={GOLD}
        stroke-width="1.6"
      />
      <rect
        x="5.5"
        y="5.5"
        width="89"
        height="149"
        rx="4"
        fill="none"
        stroke={GOLD}
        stroke-width="0.6"
        opacity="0.75"
      />
      {[
        [5.5, 5.5],
        [94.5, 5.5],
        [5.5, 154.5],
        [94.5, 154.5],
      ].map(([x = 0, y = 0]) => (
        <path
          key={`${x}-${y}`}
          d={`M${x} ${y - 3}L${x + 3} ${y}L${x} ${y + 3}L${x - 3} ${y}Z`}
          fill={GOLD}
        />
      ))}
      {DUST.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={GOLD_SOFT} opacity="0.7" />
      ))}
      {props.children}
    </>
  );
}

export function TarotFace(props: { id: number; name?: string; class?: string }): JSX.Element {
  const uid = `tf${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const id = Math.max(0, Math.min(21, Math.round(props.id)));
  const name = props.name ?? TAROT_NAMES[id] ?? "";
  const Emblem = EMBLEMS[id] ?? EMBLEMS[0];
  const len = Array.from(name).length;
  const fontSize = len >= 7 ? 7.8 : len >= 5 ? 8.6 : 10;
  return (
    <svg class={props.class} viewBox="0 0 100 160" role="img" aria-label={name}>
      <Frame uid={uid}>
        <circle cx="50" cy="80" r="36" fill={`url(#${uid}halo)`} />
        <circle
          cx="50"
          cy="80"
          r="34"
          fill="none"
          stroke={GOLD}
          stroke-width="0.5"
          opacity="0.45"
        />
        <text
          x="50"
          y="21"
          text-anchor="middle"
          fill={GOLD}
          font-family="Gowun Batang, serif"
          font-size="10"
          font-weight="700"
          letter-spacing="1"
        >
          {toRoman(id)}
        </text>
        <path d="M34 26h32" stroke={GOLD} stroke-width="0.5" opacity="0.6" />
        <g
          fill="none"
          stroke={GOLD}
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          {Emblem ? <Emblem /> : <g />}
        </g>
        <path d="M14 132h72l-4 7 4 7H14l4-7z" fill="#121334" stroke={GOLD} stroke-width="0.8" />
        <text
          x="50"
          y={139 + fontSize * 0.36}
          text-anchor="middle"
          fill={GOLD_SOFT}
          font-family="Gowun Batang, serif"
          font-size={fontSize}
          font-weight="700"
          letter-spacing="0.4"
        >
          {name}
        </text>
      </Frame>
    </svg>
  );
}

/** 카드 뒷면: 마름모 격자 + 해와 달 */
export function TarotBack(props: { class?: string }): JSX.Element {
  const uid = `tb${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const lattice: string[] = [];
  for (let k = -160; k <= 100; k += 12) {
    lattice.push(`M${k} 160L${k + 160} 0`);
    lattice.push(`M${k} 0L${k + 160} 160`);
  }
  return (
    <svg class={props.class} viewBox="0 0 100 160" aria-hidden="true">
      <Frame uid={uid}>
        <defs>
          <clipPath id={`${uid}clip`}>
            <rect x="9" y="9" width="82" height="142" rx="3" />
          </clipPath>
        </defs>
        <g
          clip-path={`url(#${uid}clip)`}
          stroke={GOLD}
          stroke-width="0.45"
          opacity="0.32"
          fill="none"
        >
          <path d={lattice.join("")} />
        </g>
        <rect
          x="9"
          y="9"
          width="82"
          height="142"
          rx="3"
          fill="none"
          stroke={GOLD}
          stroke-width="0.6"
          opacity="0.6"
        />
        <circle cx="50" cy="80" r="26" fill="#1a1b45" stroke={GOLD} stroke-width="1" />
        <circle cx="50" cy="80" r="21" fill="none" stroke={GOLD} stroke-width="0.5" opacity="0.6" />
        <g stroke={GOLD} stroke-width="1" stroke-linecap="round">
          {rays(50, 80, 27, 36, 31, 16)}
        </g>
        <path d={crescent(57, 80, 14)} fill={GOLD} />
        <path d={starPath(58, 75, 3, 1.2)} fill={GOLD_SOFT} />
        <path d={starPath(50, 22, 4, 1.6, 8)} fill={GOLD} />
        <path d={starPath(50, 138, 4, 1.6, 8)} fill={GOLD} />
      </Frame>
    </svg>
  );
}
