/**
 * 점집 네 곳과 점술가 (docs/04a 캐릭터 한눈에 보기, 08 §1 점집별 외관).
 * 얼굴 그림은 코드로 그린 SVG (D-030).
 */
import type { ShopId } from "@fortune/shared-types";
import type { JSX } from "preact";

export interface ShopInfo {
  name: string;
  master: string;
  /** 점술가 한 줄 소개 (그 캐릭터 말투) */
  intro: string;
  /** 지붕색 (08 §1) */
  roof: string;
  /** 밝은 강조색 */
  tint: string;
}

export const SHOP_INFO: Record<ShopId, ShopInfo> = {
  saju: {
    name: "사주집",
    master: "청운 선생",
    intro: "타고난 사주팔자를 차근차근 풀어 드리리다.",
    roof: "#3c4250",
    tint: "#9fb0d4",
  },
  tarot: {
    name: "타로집",
    master: "달님 언니",
    intro: "카드 한 장에 오늘 마음을 비춰 볼까요?",
    roof: "#5a3f8f",
    tint: "#d9b8ff",
  },
  dolyeong: {
    name: "아기도령",
    master: "아기도령",
    intro: "쌀 한 줌 던져서 할아버지한테 물어볼게! 내가 다 맞혀 줄게!",
    roof: "#a83a35",
    tint: "#ffb3a0",
  },
  dream: {
    name: "꿈해몽",
    master: "몽실 할매",
    intro: "간밤에 무슨 꿈 꿨누? 할매한테 얘기해 봐.",
    roof: "#2f7470",
    tint: "#9fe3d6",
  },
};

const SKIN = "#ffdcc2";
const CHEEK = "#ff9f9a";

/** 눈웃음 (닫힌 눈) */
const Smile = ({ x, y }: { x: number; y: number }) => (
  <path
    d={`M${x - 3} ${y} q3 -3 6 0`}
    stroke="#3a2418"
    stroke-width="1.6"
    fill="none"
    stroke-linecap="round"
  />
);
/** 동그란 눈 + 반짝이 */
const Eye = ({ x, y }: { x: number; y: number }) => (
  <>
    <ellipse cx={x} cy={y} rx="2" ry="2.5" fill="#2b1b14" />
    <circle cx={x + 0.7} cy={y - 0.9} r="0.7" fill="#fff" />
  </>
);

function Face(props: { shop: ShopId }) {
  switch (props.shop) {
    case "saju":
      // 청운 선생: 흰 수염, 갓
      return (
        <>
          <path d="M14 64c2-10 9-14 18-14s16 4 18 14z" fill="#e9e4f2" />
          <path d="M26 50l6 8 6-8" fill="#c9c2d6" />
          <circle cx="32" cy="34" r="14" fill={SKIN} />
          <path d="M20 37c1 10 6 16 12 18 6-2 11-8 12-18-3 3-7 4-12 4s-9-1-12-4z" fill="#fbfaf6" />
          <path d="M27 41q5 3 10 0" stroke="#d8d2c4" stroke-width="1.4" fill="none" />
          <path d="M24 30h5M35 30h5" stroke="#fbfaf6" stroke-width="2.2" stroke-linecap="round" />
          <Smile x={26.5} y={34} />
          <Smile x={37.5} y={34} />
          <ellipse cx="32" cy="21" rx="22" ry="4" fill="#1d1b1f" />
          <path d="M24 21v-9q8-4 16 0v9z" fill="#1d1b1f" />
          <path d="M24 17h16" stroke="#3a3540" stroke-width="1.2" />
          <path
            d="M18 23q14 4 28 0"
            stroke="#000"
            stroke-opacity=".25"
            stroke-width="1"
            fill="none"
          />
        </>
      );
    case "tarot":
      // 달님 언니: 긴 머리, 별무늬 숄, 초승달 머리핀
      return (
        <>
          <path d="M16 36c0-14 7-21 16-21s16 7 16 21v20H16z" fill="#2c1f3f" />
          <path d="M12 64c2-10 10-14 20-14s18 4 20 14z" fill="#7b57c2" />
          <path d="M20 58l1.4 2.8 3 .4-2.2 2 .6 3-2.8-1.5-2.7 1.5.5-3-2.2-2 3-.4z" fill="#f2d38a" />
          <path
            d="M42 55l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z"
            fill="#f2d38a"
          />
          <circle cx="32" cy="35" r="13.5" fill={SKIN} />
          <path
            d="M18.5 33c1-10 7-15 13.5-15s12.5 5 13.5 15c-5-6-9-8-13.5-8 0 3-5 6-13.5 8z"
            fill="#2c1f3f"
          />
          <path d="M41 21a5 5 0 1 0 4 7 4 4 0 1 1-4-7z" fill="#f2d38a" />
          <Eye x={27} y={36} />
          <Eye x={37} y={36} />
          <ellipse cx="23.5" cy="40.5" rx="2.6" ry="1.6" fill={CHEEK} opacity=".55" />
          <ellipse cx="40.5" cy="40.5" rx="2.6" ry="1.6" fill={CHEEK} opacity=".55" />
          <path
            d="M30 42q2 1.6 4 0"
            stroke="#b5524a"
            stroke-width="1.3"
            fill="none"
            stroke-linecap="round"
          />
        </>
      );
    case "dolyeong":
      // 아기도령: 상투 + 붉은 댕기, 색동 저고리
      return (
        <>
          <clipPath id="saekdong">
            <path d="M13 64c2-10 10-13 19-13s17 3 19 13z" />
          </clipPath>
          <g clip-path="url(#saekdong)">
            {["#e5483d", "#f6c344", "#4f8fd8", "#5fb36a", "#f7f3ea", "#e5483d", "#f6c344"].map(
              (c, i) => (
                <rect
                  key={c + String(i)}
                  x={10 + i * 6.4}
                  y="48"
                  width="6.4"
                  height="18"
                  fill={c}
                />
              ),
            )}
          </g>
          <path d="M27 51l5 6 5-6z" fill="#f7f3ea" />
          <circle cx="32" cy="36" r="15" fill={SKIN} />
          <path
            d="M17.5 33c1-9 7-13.5 14.5-13.5S45.5 24 46.5 33c-4-4-9-5.5-14.5-5.5S21.5 29 17.5 33z"
            fill="#2b1d16"
          />
          <circle cx="32" cy="17" r="4.6" fill="#2b1d16" />
          <path d="M28 19.5h8" stroke="#e5483d" stroke-width="2.4" stroke-linecap="round" />
          <Eye x={26.5} y={37} />
          <Eye x={37.5} y={37} />
          <circle cx="22.5" cy="42" r="2.8" fill={CHEEK} opacity=".75" />
          <circle cx="41.5" cy="42" r="2.8" fill={CHEEK} opacity=".75" />
          <path
            d="M29 43q3 3 6 0"
            stroke="#b5524a"
            stroke-width="1.5"
            fill="#d9645a"
            stroke-linecap="round"
          />
        </>
      );
    case "dream":
      // 몽실 할매: 쪽진 흰머리, 털실 숄
      return (
        <>
          <path d="M12 64c2-10 10-14 20-14s18 4 20 14z" fill="#c9773f" />
          <path
            d="M14 60q9-5 18-5t18 5"
            stroke="#e09a5c"
            stroke-width="2"
            fill="none"
            stroke-dasharray="2 2"
          />
          <path d="M19 55q13 7 26 0" stroke="#a65f2f" stroke-width="2" fill="none" />
          <circle cx="45" cy="22" r="5.5" fill="#dcd8d2" />
          <path d="M43 18l6 8" stroke="#e8c46a" stroke-width="1.6" stroke-linecap="round" />
          <circle cx="32" cy="35" r="14" fill={SKIN} />
          <path d="M18 34c0-10 6.5-15 14-15s14 5 14 15c-3-5-7-8-14-8s-11 3-14 8z" fill="#dcd8d2" />
          <path d="M32 20v6" stroke="#b9b4ad" stroke-width="1.2" />
          <Smile x={26.5} y={36} />
          <Smile x={37.5} y={36} />
          <path
            d="M23 39.5q1.5 1 3 0M38 39.5q1.5 1 3 0"
            stroke="#d8a58e"
            stroke-width=".9"
            fill="none"
          />
          <ellipse cx="23.5" cy="41.5" rx="2.6" ry="1.6" fill={CHEEK} opacity=".5" />
          <ellipse cx="40.5" cy="41.5" rx="2.6" ry="1.6" fill={CHEEK} opacity=".5" />
          <path
            d="M29 43.5q3 2.4 6 0"
            stroke="#9c4c42"
            stroke-width="1.4"
            fill="none"
            stroke-linecap="round"
          />
        </>
      );
  }
}

/** 점술가 얼굴 (지도 카드, 운세 화면) */
export function Portrait(props: { shop: ShopId; size?: number }): JSX.Element {
  const info = SHOP_INFO[props.shop];
  const id = `pg-${props.shop}`;
  return (
    <svg
      class="portrait"
      viewBox="0 0 64 64"
      width={props.size ?? 64}
      height={props.size ?? 64}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={id} cx="50%" cy="38%" r="70%">
          <stop offset="0" stop-color={info.tint} stop-opacity=".55" />
          <stop offset="1" stop-color={info.roof} />
        </radialGradient>
        <clipPath id={`${id}-c`}>
          <circle cx="32" cy="32" r="31" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="31" fill={`url(#${id})`} />
      <g clip-path={`url(#${id}-c)`}>
        <Face shop={props.shop} />
      </g>
      <circle cx="32" cy="32" r="30.5" fill="none" stroke="#f2d38a" stroke-width="1.6" />
    </svg>
  );
}

/** 작은 점집 표시 (기록 목록): 지붕색 기와 지붕 + 등불 창 */
export function ShopMark(props: { shop: ShopId; size?: number }): JSX.Element {
  const info = SHOP_INFO[props.shop];
  return (
    <svg
      class="shop-mark"
      viewBox="0 0 48 48"
      width={props.size ?? 44}
      height={props.size ?? 44}
      aria-hidden="true"
    >
      <rect x="1" y="1" width="46" height="46" rx="12" fill="#221a3a" />
      <ellipse cx="24" cy="38" rx="16" ry="4" fill="#ffb85c" opacity=".25" />
      <rect x="12" y="24" width="24" height="13" fill="#f3e7cf" />
      <rect x="19" y="27" width="10" height="10" fill="#ffcf86" />
      <path d="M24 27v10M19 32h10" stroke="#6e4429" stroke-width="1" />
      <rect x="11" y="23" width="2.4" height="14" fill="#6e4429" />
      <rect x="34.6" y="23" width="2.4" height="14" fill="#6e4429" />
      <path d="M5 23.5q19 -4 38 0l-6-9q-13-3-26 0z" fill={info.roof} />
      <path
        d="M5 23.5q19 -4 38 0"
        stroke="#000"
        stroke-opacity=".3"
        stroke-width="1.4"
        fill="none"
      />
      <path
        d="M10 14.5q14-3 28 0"
        stroke={info.tint}
        stroke-opacity=".7"
        stroke-width="1.6"
        fill="none"
        stroke-linecap="round"
      />
    </svg>
  );
}
