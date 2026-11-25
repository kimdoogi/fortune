/**
 * 결과 위쪽에 그리는 점집별 그림 (F05 사주판, F06 카드, F07 깃발, F08 꿈 상징).
 * 다시 보기(F10)에서도 같은 그림을 그대로 쓴다.
 */
import type { FlagColor, FlagGrade, SajuBoard, TarotCardView } from "@fortune/shared-types";
import type { JSX } from "preact";
import { useId } from "preact/hooks";
import { ELEMENTS, ELEMENT_COLOR, type GlyphInfo, pillarInfo } from "./format";
import { TarotFace } from "./tarotArt";

// ── 사주판 (F05) ─────────────────────────────────────────

function Glyph(props: { g: GlyphInfo; me?: boolean }) {
  const color = props.g.element ? ELEMENT_COLOR[props.g.element] : "#8a7a66";
  return (
    <div class={props.me ? "rd-glyph rd-glyph-me" : "rd-glyph"} style={{ "--el": color }}>
      <span class="rd-glyph-ko">{props.g.ko}</span>
      <span class="rd-glyph-sub">
        {props.g.hanja}
        {props.g.element && <i>{props.g.element}</i>}
      </span>
    </div>
  );
}

const PILLAR_ORDER = [
  ["hour", "시주"],
  ["day", "일주"],
  ["month", "월주"],
  ["year", "년주"],
] as const;

export function SajuBoardView(props: { board: SajuBoard }): JSX.Element {
  const { board } = props;
  const total = ELEMENTS.reduce((s, e) => s + (board.elements[e] ?? 0), 0) || 1;
  const max = Math.max(1, ...ELEMENTS.map((e) => board.elements[e] ?? 0));
  const dm = board.dayMaster;
  return (
    <div class="rd-board">
      <div class="rd-pillars">
        {PILLAR_ORDER.map(([key, label], i) => {
          const p = board.pillars[key];
          const empty = key === "hour" && (board.hourUnknown || !p);
          const [s, b] = p ? pillarInfo(p) : [null, null];
          return (
            <div class="rd-pillar" key={key} style={{ "--i": i }}>
              <span class="rd-pillar-label">{label}</span>
              {empty || !s || !b ? (
                <>
                  <div class="rd-glyph rd-glyph-empty">?</div>
                  <div class="rd-glyph rd-glyph-empty">?</div>
                </>
              ) : (
                <>
                  <Glyph g={s} me={key === "day"} />
                  <Glyph g={b} />
                </>
              )}
            </div>
          );
        })}
      </div>
      {board.hourUnknown && <p class="rd-board-note">시간을 모르면 시주 없이 보오</p>}

      <div class="rd-board-meta">
        <span class="rd-chip rd-chip-ink">
          일간 <b>{dm.stem}</b>
          {dm.element} · {dm.yinYang}
        </span>
        <span class="rd-chip">{board.strength}</span>
        <span class="rd-chip">용신 {board.yongsin}</span>
      </div>

      <div class="rd-elements" role="img" aria-label="오행 분포">
        {ELEMENTS.map((e, i) => {
          const n = board.elements[e] ?? 0;
          return (
            <div class="rd-el" key={e} style={{ "--el": ELEMENT_COLOR[e], "--i": i }}>
              <span class="rd-el-n">{n}</span>
              <div class="rd-el-track">
                <div
                  class="rd-el-bar"
                  style={{ height: `${Math.max(n === 0 ? 0 : 12, (n / max) * 100)}%` }}
                  title={`${Math.round((n / total) * 100)}%`}
                />
              </div>
              <span class="rd-el-name">{e}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 타로 (F06) ──────────────────────────────────────────

export function TarotSpreadView(props: { cards: TarotCardView[] }): JSX.Element {
  const three = props.cards.length > 1;
  return (
    <div class={three ? "rd-spread rd-spread-3" : "rd-spread"}>
      {props.cards.map((c, i) => (
        <figure class="rd-tcard" key={`${c.position}-${c.id}`} style={{ "--i": i }}>
          <span class="rd-tcard-pos">{c.position}</span>
          <div class={c.reversed ? "rd-tcard-art rd-rev" : "rd-tcard-art"}>
            <TarotFace id={c.id} name={c.name} />
          </div>
          <figcaption>
            {c.name}
            {c.reversed && <em>역방향</em>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

// ── 오방기 (F07) ─────────────────────────────────────────

export const FLAG_HEX: Record<FlagColor, [string, string]> = {
  빨강: ["#d8463a", "#a82a22"],
  노랑: ["#f0c447", "#c9921f"],
  파랑: ["#3f6fc0", "#25488a"],
  하양: ["#fbf7ee", "#d9d0bd"],
  초록: ["#4f9a58", "#2f6c3b"],
};

/** "빨강" → "빨간" (깃발 앞에 붙일 때) */
export const FLAG_ADJ: Record<FlagColor, string> = {
  빨강: "빨간",
  노랑: "노란",
  파랑: "파란",
  하양: "하얀",
  초록: "초록",
};

/** 펼쳐진 깃발. 천은 깃대 쪽을 축으로 펼쳐진다 */
export function FlagArt(props: { color: FlagColor; class?: string }): JSX.Element {
  const uid = `fl${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [hi, lo] = FLAG_HEX[props.color] ?? FLAG_HEX.노랑;
  return (
    <svg class={props.class} viewBox="0 0 170 210" aria-label={`${props.color} 깃발`} role="img">
      <defs>
        <linearGradient id={`${uid}c`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color={hi} />
          <stop offset="1" stop-color={lo} />
        </linearGradient>
        <linearGradient id={`${uid}p`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#8a5a34" />
          <stop offset="0.5" stop-color="#c08a55" />
          <stop offset="1" stop-color="#6e4429" />
        </linearGradient>
      </defs>
      <rect x="20" y="14" width="7" height="194" rx="3" fill={`url(#${uid}p)`} />
      <circle cx="23.5" cy="12" r="7" fill="#f2d38a" stroke="#a87a33" stroke-width="1.2" />
      <g class="rd-flag-cloth">
        <path
          d="M27 24C62 12 104 36 158 22V122C104 136 62 110 27 122Z"
          fill={`url(#${uid}c)`}
          stroke="rgba(40,20,10,0.25)"
          stroke-width="1"
        />
        {/* 천 주름: 물결을 따라 어두운 골과 밝은 등 */}
        <path d="M70 21C76 50 74 90 80 127L96 129C90 92 92 52 86 24Z" fill="#000" opacity="0.1" />
        <path
          d="M112 30C118 58 116 96 122 128L134 126C128 96 130 58 124 28Z"
          fill="#000"
          opacity="0.08"
        />
        <path d="M48 19C53 50 51 88 56 120L64 117C59 86 61 50 56 20Z" fill="#fff" opacity="0.12" />
        <path d="M27 24C62 12 104 36 158 22V34C104 48 62 24 27 36Z" fill="#fff" opacity="0.2" />
        {/* 깃대 쪽 깃(한지색 띠) */}
        <path
          d="M27 24C31 23 35 22.4 38 22V121C35 121.2 31 121.6 27 122Z"
          fill="#f3e7cf"
          opacity="0.92"
        />
        <path d="M38 22V121" stroke="#c99a45" stroke-width="1" />
        <path d="M27 122C62 110 104 136 158 122" fill="none" stroke="#f2d38a" stroke-width="2.4" />
        {[46, 64, 82, 100, 118, 136, 152].map((x) => (
          <path
            key={x}
            d={`M${x} ${123 + Math.sin(x / 18) * 5}v9`}
            stroke="#f2d38a"
            stroke-width="2"
            stroke-linecap="round"
          />
        ))}
      </g>
      <path d="M27 30q-10 18 0 36" fill="none" stroke="#c8372d" stroke-width="2.4" />
      <circle cx="20" cy="68" r="3.5" fill="#c8372d" />
    </svg>
  );
}

/** 말아 쥔 깃발 (색동 천을 감아 색을 숨긴다) */
export function RolledFlag(props: { class?: string }): JSX.Element {
  const stripes = ["#d8463a", "#f0c447", "#3f6fc0", "#fbf7ee", "#4f9a58"];
  return (
    <svg class={props.class} viewBox="0 0 40 150" aria-hidden="true">
      <rect x="17" y="6" width="5" height="142" rx="2.5" fill="#9a6a3e" />
      <circle cx="19.5" cy="6" r="5" fill="#f2d38a" stroke="#a87a33" stroke-width="1" />
      <rect x="9" y="16" width="22" height="70" rx="10" fill="#f3e7cf" />
      {stripes.map((c, i) => (
        <rect key={c} x="9" y={22 + i * 12} width="22" height="6" fill={c} opacity="0.95" />
      ))}
      <rect
        x="9"
        y="16"
        width="22"
        height="70"
        rx="10"
        fill="none"
        stroke="rgba(46,33,24,0.35)"
        stroke-width="1"
      />
      <path d="M9 50h22" stroke="#7a2a1f" stroke-width="2.2" />
      <path d="M20 50q-4 10 2 18" fill="none" stroke="#7a2a1f" stroke-width="1.6" />
      <rect x="11" y="18" width="5" height="64" rx="2.5" fill="#fff" opacity="0.25" />
    </svg>
  );
}

/** 등급 도장 (대길·길·평·주의) */
export function GradeSeal(props: { grade: FlagGrade; class?: string }): JSX.Element {
  const kind =
    props.grade === "대길" || props.grade === "길"
      ? "good"
      : props.grade === "평"
        ? "even"
        : "care";
  return (
    <span class={`rd-seal rd-seal-${kind} ${props.class ?? ""}`}>
      <span>{props.grade}</span>
    </span>
  );
}

// ── 꿈 상징 (F08) ────────────────────────────────────────

type IconKind =
  | "animal"
  | "water"
  | "fire"
  | "sky"
  | "plant"
  | "treasure"
  | "place"
  | "person"
  | "food"
  | "move"
  | "moon";

const ICON_GROUPS: Record<Exclude<IconKind, "moon">, string[]> = {
  animal: [
    "pig",
    "dragon",
    "snake",
    "tiger",
    "cow",
    "horse",
    "dog",
    "cat",
    "fish",
    "bird",
    "magpie",
    "crow",
    "phoenix",
    "crane",
    "turtle",
    "frog",
    "rat",
    "bug",
    "maggot",
    "bee",
    "butterfly",
    "chicken",
    "bear",
    "rabbit",
    "deer",
    "fox",
    "whale",
    "centipede",
    "eagle",
  ],
  water: [
    "water",
    "sea",
    "river",
    "flood",
    "rain",
    "swimming",
    "drowning",
    "well",
    "urine",
    "blue",
  ],
  fire: ["fire", "lightning", "red", "blood"],
  sky: ["sun", "star", "rainbow", "sky", "snow", "wind", "flying", "white", "yellow", "purple"],
  plant: ["tree", "flower", "mountain", "soil", "stone", "green", "fruit", "chestnut"],
  treasure: [
    "money",
    "gold",
    "jewel",
    "ring",
    "wallet",
    "gift",
    "key",
    "award",
    "watch",
    "mirror",
    "letter",
    "book",
    "poop",
  ],
  place: [
    "house",
    "old_house",
    "school",
    "office",
    "toilet",
    "hospital",
    "temple",
    "grave",
    "bridge",
    "road",
    "stairs",
    "cliff",
    "moving",
  ],
  person: [
    "deceased_person",
    "ancestor",
    "baby",
    "pregnancy",
    "childbirth",
    "ex_partner",
    "lover",
    "spouse",
    "mother",
    "father",
    "friend",
    "stranger",
    "celebrity",
    "king",
    "mountain_spirit",
    "ghost",
    "thief",
    "military",
    "wedding",
    "kiss",
    "hand",
    "foot",
    "eye",
    "hair",
    "teeth_falling",
  ],
  food: [
    "rice",
    "rice_cake",
    "meat",
    "fish_dish",
    "egg",
    "alcohol",
    "noodles",
    "sweets",
    "soup",
    "eating",
  ],
  move: [
    "car",
    "airplane",
    "train",
    "ship",
    "travel",
    "falling",
    "being_chased",
    "lost",
    "late",
    "shoes",
    "bag",
  ],
};

export function iconKind(id: string): IconKind {
  for (const [k, ids] of Object.entries(ICON_GROUPS)) if (ids.includes(id)) return k as IconKind;
  return "moon";
}

const ICON_PATHS: Record<IconKind, string> = {
  animal:
    "M7 10.5a1.7 2.1 0 1 0 0.01 0M12 7.6a1.7 2.1 0 1 0 0.01 0M17 10.5a1.7 2.1 0 1 0 0.01 0M12 12.5c-3 0-5 3.4-5 5.2 0 1.6 1.6 1.9 2.6 1.5 1-.4 1.6-.6 2.4-.6s1.4.2 2.4.6c1 .4 2.6.1 2.6-1.5 0-1.8-2-5.2-5-5.2z",
  water: "M12 3.5c3 4 6 7.4 6 10.6a6 6 0 0 1-12 0c0-3.2 3-6.6 6-10.6z",
  fire: "M12 3c1 3.4 5.5 5.6 5.5 10.4A5.5 5.5 0 0 1 6.5 13.4c0-2.2 1-3.6 2.4-4.8-.1 2 .9 3.2 2 3.4-.6-3.2.4-6.2 1.1-9z",
  sky: "M12 3.5l2.2 5.3 5.6.4-4.3 3.6 1.4 5.5L12 15.3l-4.9 3 1.4-5.5-4.3-3.6 5.6-.4z",
  plant:
    "M12 20.5v-8M12 12.5c0-4 2.6-7 7-7.5-.2 4.6-3 7.5-7 7.5zM12 15c0-3-2.2-5.3-5.8-5.6.1 3.4 2.4 5.6 5.8 5.6z",
  treasure:
    "M12 4.5a7.5 7.5 0 1 0 0.01 0M12 8.5v7M9.8 10.2c0-1 1-1.5 2.2-1.5s2.2.5 2.2 1.5-1 1.3-2.2 1.6-2.2.7-2.2 1.7 1 1.5 2.2 1.5 2.2-.6 2.2-1.5",
  place: "M4 11l8-6.5 8 6.5M6 9.6V19.5h12V9.6M10 19.5v-5h4v5",
  person: "M12 4.5a3.4 3.4 0 1 0 0.01 0M5.5 19.5c.6-3.8 3.2-6 6.5-6s5.9 2.2 6.5 6z",
  food: "M4 11.5h16a8 8 0 0 1-16 0zM8.5 8.5c0-1.4 1-1.4 1-2.8M12 8.5c0-1.4 1-1.4 1-2.8M15.5 8.5c0-1.4 1-1.4 1-2.8",
  move: "M4 14.5q4-6 8-1t8-3M14 8l6 2.5-2.5 5.5",
  moon: "M15.5 4.2A8 8 0 1 0 19.8 15 6.4 6.4 0 0 1 15.5 4.2z",
};

export function SymbolIcon(props: { id: string }): JSX.Element {
  const kind = iconKind(props.id);
  const filled =
    kind === "water" || kind === "fire" || kind === "sky" || kind === "moon" || kind === "animal";
  return (
    <svg viewBox="0 0 24 24" class="rd-sym-icon" aria-hidden="true">
      <path
        d={ICON_PATHS[kind]}
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        stroke-width={filled ? 0.8 : 1.8}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export function DreamSymbols(props: { symbols: { id: string; name: string }[] }): JSX.Element {
  return (
    <ul class="rd-syms">
      {props.symbols.map((s, i) => (
        <li key={s.id} class="rd-sym" style={{ "--i": i }}>
          <SymbolIcon id={s.id} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

// ── 카테고리 아이콘 (F06·F07 고르기) ───────────────────────

const CATEGORY_PATHS: Record<string, string> = {
  연애: "M12 19.5C6 15.6 4 12.4 4 9.6 4 7.2 5.9 5.5 8 5.5c1.7 0 3.1.9 4 2.4.9-1.5 2.3-2.4 4-2.4 2.1 0 4 1.7 4 4.1 0 2.8-2 6-8 9.9z",
  재물: ICON_PATHS.treasure,
  직장: "M4 8.5h16v10.5H4zM9 8.5V6h6v2.5M4 13h16",
  오늘: "M12 7.5a4.5 4.5 0 1 0 .01 0M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  건강: ICON_PATHS.plant,
  기타: "M6 12h.01M12 12h.01M18 12h.01",
};

export function CategoryIcon(props: { category: string }): JSX.Element {
  const dots = props.category === "기타";
  return (
    <svg viewBox="0 0 24 24" class="sh-cat-icon" aria-hidden="true">
      <path
        d={CATEGORY_PATHS[props.category] ?? CATEGORY_PATHS.기타}
        fill="none"
        stroke="currentColor"
        stroke-width={dots ? 3.4 : 1.8}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
