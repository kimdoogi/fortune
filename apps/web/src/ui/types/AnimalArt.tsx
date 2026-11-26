/**
 * 60유형 동물 그림 (F19, D-101). 동물은 많은 기운·기운 세기로, 색은 나의 기운(오행)으로 정한다 (엔진 types60).
 * 2등신 톤의 둥근 얼굴을 코드로 그린 SVG (D-030). 64×64 안에 얼굴 하나.
 */
import type { JSX } from "preact";
import { typeInfo } from "./typeData";

type El = "목" | "화" | "토" | "금" | "수";

/** 오행 색 (푸른·붉은·노란·흰·검은). 몸, 진한 선, 밝은 주둥이 */
const PALETTE: Record<El, { body: string; dark: string; light: string }> = {
  목: { body: "#86cf98", dark: "#3f8a55", light: "#dff3e2" },
  화: { body: "#f59a86", dark: "#c0503f", light: "#fde3db" },
  토: { body: "#f5c862", dark: "#b88a1e", light: "#fdf0cc" },
  금: { body: "#f1eee8", dark: "#a39d92", light: "#ffffff" },
  수: { body: "#62739a", dark: "#38446a", light: "#c9d3ea" },
};

const INK = "#3a2418";
const CHEEK = "#ff8f8a";

/** 눈 둘 + 볼 + 입 (공통) */
function Face(props: { y?: number; spread?: number; dark?: boolean; mouth?: boolean }) {
  const y = props.y ?? 36;
  const d = props.spread ?? 7;
  const eye = props.dark ? "#fff" : INK;
  return (
    <>
      <ellipse cx={32 - d} cy={y} rx="2.1" ry="2.6" fill={eye} />
      <ellipse cx={32 + d} cy={y} rx="2.1" ry="2.6" fill={eye} />
      <circle cx={32 - d + 0.7} cy={y - 1} r="0.7" fill={props.dark ? INK : "#fff"} />
      <circle cx={32 + d + 0.7} cy={y - 1} r="0.7" fill={props.dark ? INK : "#fff"} />
      <ellipse cx={32 - d - 4} cy={y + 5} rx="3" ry="1.8" fill={CHEEK} opacity=".6" />
      <ellipse cx={32 + d + 4} cy={y + 5} rx="3" ry="1.8" fill={CHEEK} opacity=".6" />
      {props.mouth !== false && (
        <path
          d={`M${29.5} ${y + 6} q1.25 1.6 2.5 0 q1.25 1.6 2.5 0`}
          stroke={props.dark ? "#fff" : INK}
          stroke-width="1.2"
          fill="none"
          stroke-linecap="round"
        />
      )}
    </>
  );
}

function Animal(props: { animal: string; c: (typeof PALETTE)[El]; dark: boolean }) {
  const { c, dark } = props;
  const head = (r = 17, cy = 37) => (
    <circle cx="32" cy={cy} r={r} fill={c.body} stroke={c.dark} stroke-width="1.4" />
  );
  switch (props.animal) {
    case "tiger": // 호랑이: 둥근 귀, 이마 줄무늬
      return (
        <>
          <circle cx="18" cy="23" r="6.5" fill={c.body} stroke={c.dark} stroke-width="1.4" />
          <circle cx="46" cy="23" r="6.5" fill={c.body} stroke={c.dark} stroke-width="1.4" />
          <circle cx="18" cy="23" r="3" fill={c.light} />
          <circle cx="46" cy="23" r="3" fill={c.light} />
          {head(18, 37)}
          <path
            d="M32 21v6M27 22.5l1.5 4M37 22.5l-1.5 4M15.5 34h5M15.5 39h4.5M48.5 34h-5M48.5 39h-4.5"
            stroke={INK}
            stroke-width="1.8"
            stroke-linecap="round"
            opacity=".75"
          />
          <ellipse cx="32" cy="44" rx="7.5" ry="5" fill={c.light} />
          <Face y={36} dark={false} />
          <ellipse cx="32" cy="41" rx="1.8" ry="1.3" fill={INK} />
        </>
      );
    case "sheep": // 양: 몽실한 털, 말린 뿔
      return (
        <>
          {[
            [18, 26],
            [24, 19],
            [32, 17],
            [40, 19],
            [46, 26],
            [15, 34],
            [49, 34],
          ].map(([x, y]) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="7"
              fill="#fffaf0"
              stroke="#d8cdb8"
              stroke-width="1"
            />
          ))}
          <path
            d="M16 36q-6 2-4 8 4 2 6-3"
            fill="none"
            stroke="#b89a5a"
            stroke-width="2.4"
            stroke-linecap="round"
          />
          <path
            d="M48 36q6 2 4 8-4 2-6-3"
            fill="none"
            stroke="#b89a5a"
            stroke-width="2.4"
            stroke-linecap="round"
          />
          <ellipse
            cx="32"
            cy="39"
            rx="13"
            ry="14"
            fill={c.body}
            stroke={c.dark}
            stroke-width="1.4"
          />
          <circle cx="27" cy="27" r="5" fill="#fffaf0" />
          <circle cx="37" cy="27" r="5" fill="#fffaf0" />
          <Face y={38} spread={6} dark={dark} />
        </>
      );
    case "monkey": // 원숭이: 옆으로 큰 귀, 하트 얼굴판
      return (
        <>
          <circle cx="13" cy="37" r="6.5" fill={c.body} stroke={c.dark} stroke-width="1.4" />
          <circle cx="51" cy="37" r="6.5" fill={c.body} stroke={c.dark} stroke-width="1.4" />
          <circle cx="13" cy="37" r="3.4" fill="#f7d2b6" />
          <circle cx="51" cy="37" r="3.4" fill="#f7d2b6" />
          {head(17, 37)}
          <path
            d="M32 30q-4-6-9-3-5 4-1 11-1 9 10 11 11-2 10-11 4-7-1-11-5-3-9 3z"
            fill="#f7d2b6"
          />
          <Face y={36} spread={5.5} dark={false} />
        </>
      );
    case "dog": // 강아지: 늘어진 귀, 코
      return (
        <>
          {head(17, 36)}
          <path d="M17 25q-8 2-6 16 5 2 8-4z" fill={c.dark} />
          <path d="M47 25q8 2 6 16-5 2-8-4z" fill={c.dark} />
          <ellipse cx="32" cy="43" rx="8" ry="6" fill={c.light} />
          <Face y={34} dark={dark} mouth={false} />
          <ellipse cx="32" cy="40.5" rx="2.6" ry="2" fill={INK} />
          <path
            d="M32 42.5v2M32 44.5q-2.2 1.8-3.8 0M32 44.5q2.2 1.8 3.8 0"
            stroke={INK}
            stroke-width="1"
            fill="none"
          />
          <path d="M30.5 46.5q1.5 3 3 0z" fill="#ff8f8a" />
        </>
      );
    case "lion": // 사자: 둥근 갈기
      return (
        <>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <circle
                key={a}
                cx={32 + Math.cos(a) * 19}
                cy={37 + Math.sin(a) * 19}
                r="7"
                fill={c.dark}
              />
            );
          })}
          <circle cx="20" cy="23" r="4.5" fill={c.body} stroke={c.dark} stroke-width="1.2" />
          <circle cx="44" cy="23" r="4.5" fill={c.body} stroke={c.dark} stroke-width="1.2" />
          {head(16, 37)}
          <ellipse cx="32" cy="43" rx="7" ry="5" fill={c.light} />
          <Face y={35} dark={false} mouth={false} />
          <path d="M30 40.5h4l-2 2z" fill={INK} />
          <path
            d="M32 42.5v1.5M32 44q-2 1.6-3.4 0M32 44q2 1.6 3.4 0"
            stroke={INK}
            stroke-width="1"
            fill="none"
          />
        </>
      );
    case "bear": // 곰: 둥근 귀, 밝은 주둥이
      return (
        <>
          <circle cx="17" cy="23" r="7" fill={c.body} stroke={c.dark} stroke-width="1.4" />
          <circle cx="47" cy="23" r="7" fill={c.body} stroke={c.dark} stroke-width="1.4" />
          <circle cx="17" cy="23" r="3.6" fill={c.light} />
          <circle cx="47" cy="23" r="3.6" fill={c.light} />
          {head(18, 37)}
          <ellipse cx="32" cy="44" rx="8" ry="6" fill={c.light} />
          <Face y={35} dark={dark} mouth={false} />
          <ellipse cx="32" cy="41.5" rx="2.8" ry="2" fill={INK} />
          <path
            d="M32 43.5v1.5M32 45q-2 1.6-3.4 0M32 45q2 1.6 3.4 0"
            stroke={INK}
            stroke-width="1"
            fill="none"
          />
        </>
      );
    case "fox": // 여우: 뾰족 귀, 흰 볼
      return (
        <>
          <path
            d="M14 30l2-19 12 11zM50 30l-2-19-12 11z"
            fill={c.body}
            stroke={c.dark}
            stroke-width="1.4"
          />
          <path d="M17 26l1-10 6 6zM47 26l-1-10-6 6z" fill={c.light} />
          <path
            d="M14 33q18-14 36 0-2 16-18 20-16-4-18-20z"
            fill={c.body}
            stroke={c.dark}
            stroke-width="1.4"
          />
          <path d="M16 38q8 1 16 12 8-11 16-12-3 11-16 15-13-4-16-15z" fill={c.light} />
          <Face y={36} spread={7.5} dark={dark} mouth={false} />
          <ellipse cx="32" cy="46" rx="2" ry="1.5" fill={INK} />
        </>
      );
    case "penguin": // 펭귄: 흰 얼굴판, 부리
      return (
        <>
          <ellipse cx="32" cy="37" rx="18" ry="19" fill={c.dark} />
          <path d="M32 28q-6-6-11 0-5 8 1 17 4 5 10 5t10-5q6-9 1-17-5-6-11 0z" fill="#fffaf0" />
          <ellipse cx="32" cy="22" rx="10" ry="4" fill={c.body} opacity=".8" />
          <Face y={36} dark={false} mouth={false} />
          <path d="M29 41h6l-3 3.5z" fill="#f6b23c" stroke="#c9821a" stroke-width="1" />
        </>
      );
    case "owl": // 부엉이: 귀깃, 큰 눈테
      return (
        <>
          <path d="M16 24l1-11 8 7zM48 24l-1-11-8 7z" fill={c.dark} />
          <ellipse
            cx="32"
            cy="37"
            rx="18"
            ry="18"
            fill={c.body}
            stroke={c.dark}
            stroke-width="1.4"
          />
          <circle cx="25" cy="34" r="7" fill="#fffaf0" stroke={c.dark} stroke-width="1" />
          <circle cx="39" cy="34" r="7" fill="#fffaf0" stroke={c.dark} stroke-width="1" />
          <circle cx="25" cy="34" r="3.2" fill={INK} />
          <circle cx="39" cy="34" r="3.2" fill={INK} />
          <circle cx="26" cy="33" r="1" fill="#fff" />
          <circle cx="40" cy="33" r="1" fill="#fff" />
          <path d="M30 40h4l-2 4z" fill="#f6b23c" stroke="#c9821a" stroke-width=".9" />
          <path d="M22 48q4-3 8 0M34 48q4-3 8 0" stroke={c.dark} stroke-width="1" fill="none" />
          <ellipse cx="18" cy="42" rx="2.6" ry="1.6" fill={CHEEK} opacity=".5" />
          <ellipse cx="46" cy="42" rx="2.6" ry="1.6" fill={CHEEK} opacity=".5" />
        </>
      );
    case "otter": // 수달: 작은 귀, 넓은 주둥이, 수염
      return (
        <>
          <circle cx="17" cy="28" r="4" fill={c.body} stroke={c.dark} stroke-width="1.2" />
          <circle cx="47" cy="28" r="4" fill={c.body} stroke={c.dark} stroke-width="1.2" />
          <ellipse
            cx="32"
            cy="38"
            rx="17"
            ry="15.5"
            fill={c.body}
            stroke={c.dark}
            stroke-width="1.4"
          />
          <ellipse cx="32" cy="44" rx="10" ry="6.5" fill={c.light} />
          <Face y={34} dark={dark} mouth={false} />
          <ellipse cx="32" cy="41" rx="3" ry="2" fill={INK} />
          <path
            d="M32 43v2M32 45q-2 1.6-3.4 0M32 45q2 1.6 3.4 0"
            stroke={INK}
            stroke-width="1"
            fill="none"
          />
          <path
            d="M22 44h-7M22 46.5l-6 1.5M42 44h7M42 46.5l6 1.5"
            stroke={c.dark}
            stroke-width="1"
            stroke-linecap="round"
          />
        </>
      );
    case "panda": // 판다: 검은 귀·눈 둘레 (몸은 흰색, 무늬가 오행 색)
      return (
        <>
          <circle cx="17" cy="23" r="7" fill={c.dark} />
          <circle cx="47" cy="23" r="7" fill={c.dark} />
          <circle cx="32" cy="37" r="18" fill="#fffaf0" stroke={c.dark} stroke-width="1.4" />
          <ellipse cx="24.5" cy="36" rx="5" ry="6" fill={c.dark} transform="rotate(-25 24.5 36)" />
          <ellipse cx="39.5" cy="36" rx="5" ry="6" fill={c.dark} transform="rotate(25 39.5 36)" />
          <Face y={36} spread={7.5} dark={true} mouth={false} />
          <ellipse cx="32" cy="43" rx="2.6" ry="1.8" fill={INK} />
          <path
            d="M32 44.8v1.4M32 46.2q-2 1.6-3.4 0M32 46.2q2 1.6 3.4 0"
            stroke={INK}
            stroke-width="1"
            fill="none"
          />
        </>
      );
    case "squirrel": // 다람쥐: 작은 귀 털, 볼 주머니, 이마 줄
      return (
        <>
          <path d="M44 56q16-8 8-30-6-10-12-2 8 10 4 32z" fill={c.dark} opacity=".85" />
          <path
            d="M19 25l-1-9 7 5zM45 25l1-9-7 5z"
            fill={c.body}
            stroke={c.dark}
            stroke-width="1.3"
          />
          {head(16, 38)}
          <path
            d="M32 23v8M28 24l1.5 6M36 24l-1.5 6"
            stroke={c.dark}
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <ellipse cx="22" cy="44" rx="5" ry="4" fill={c.light} />
          <ellipse cx="42" cy="44" rx="5" ry="4" fill={c.light} />
          <Face y={37} dark={dark} />
          <ellipse cx="32" cy="41" rx="1.6" ry="1.2" fill={INK} />
        </>
      );
    default:
      return head();
  }
}

/** 60유형 동물 얼굴. size는 px */
export function AnimalArt(props: { type: string; size?: number; class?: string }): JSX.Element {
  const info = typeInfo(props.type);
  const el = info.element;
  const c = PALETTE[el];
  return (
    <svg
      class={props.class ?? "ty-animal"}
      viewBox="0 0 64 64"
      width={props.size ?? 64}
      height={props.size ?? 64}
      role="img"
      aria-label={info.name}
    >
      <Animal animal={info.animal} c={c} dark={el === "수"} />
    </svg>
  );
}
