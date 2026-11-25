/**
 * 공통 UI 조각 (08 §1 UI 규칙): 한지 카드 + 목재 현판, 강조 버튼만 등불색, 버튼 높이 48px 이상.
 */
import type { ComponentChildren, JSX } from "preact";
import { useEffect } from "preact/hooks";
import { setSoundOn, soundOn } from "../../audio/sound";
import { toasts } from "./state";

type IconProps = { size?: number };
const svg = (children: ComponentChildren, sw = 2.2) =>
  function Icon({ size }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        stroke-width={sw}
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  };

export const Icon = {
  back: svg(<path d="M15 5l-7 7 7 7" />, 2.4),
  close: svg(<path d="M6 6l12 12M18 6L6 18" />, 2.4),
  door: svg(
    <>
      <path d="M3 9l9-5 9 5" />
      <path d="M5 9v11h14V9" />
      <path d="M10 20v-6h4v6" />
    </>,
    2,
  ),
  /** 내 캐릭터 */
  person: svg(
    <>
      <circle cx="12" cy="8.5" r="4.5" />
      <path d="M4.5 21c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" />
    </>,
    2,
  ),
  /** 오늘의 운세: 해 */
  sun: svg(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </>,
    2,
  ),
  /** 점 기록: 두루마리 */
  scroll: svg(
    <>
      <path d="M7 4h11a2 2 0 0 1 2 2v1H9" />
      <path d="M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
      <path d="M9 11h6M9 15h4" />
    </>,
    2,
  ),
  trash: svg(
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>,
    2,
  ),
  share: svg(
    <>
      <path d="M12 15V3M7 8l5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </>,
    2,
  ),
  edit: svg(
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>,
    2,
  ),
  chevron: svg(<path d="M9 5l7 7-7 7" />, 2.4),
  /** 소리 켜짐: 스피커와 소리 물결 */
  soundOn: svg(
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a7.8 7.8 0 0 1 0 11" />
    </>,
    2,
  ),
  /** 소리 꺼짐: 스피커와 X */
  soundOff: svg(
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>,
    2,
  ),
};

/** 소리 켜기/끄기 (08 §5). 위쪽 막대 오른쪽에 둔다 */
export function SoundButton() {
  const on = soundOn.value;
  return (
    <button
      type="button"
      class={on ? "btn-sound" : "btn-sound off"}
      aria-label={on ? "소리 끄기" : "소리 켜기"}
      aria-pressed={!on}
      onClick={() => setSoundOn(!on)}
    >
      {on ? <Icon.soundOn /> : <Icon.soundOff />}
    </button>
  );
}

/** 목재 현판 (제목) */
export function Plaque(props: { children: ComponentChildren; class?: string }) {
  return <div class={`plaque ${props.class ?? ""}`}>{props.children}</div>;
}

/** 위쪽 막대: 왼쪽 한지 둥근 버튼, 가운데 현판 */
export function TopBar(props: {
  title: string;
  backLabel?: string;
  onBack: () => void;
  right?: ComponentChildren;
}) {
  return (
    <div class="hud-top">
      <button type="button" class="btn-map" onClick={props.onBack}>
        <Icon.back />
        {props.backLabel ?? "지도"}
      </button>
      <Plaque>{props.title}</Plaque>
      {props.right && <div class="hud-right">{props.right}</div>}
    </div>
  );
}

/** 등불이 숨쉬는 로딩 표시 */
export function Loading(props: { text?: string }) {
  return (
    <div class="loading" aria-live="polite">
      <span class="lamp" aria-hidden="true">
        <span />
      </span>
      {props.text ?? "불을 밝히는 중이에요"}
    </div>
  );
}

/** 확인 창 (되돌릴 수 없는 동작 앞에, D-055) */
export function Confirm(props: {
  title: string;
  children: ComponentChildren;
  okLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onOk: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onCancel]);
  return (
    // biome-ignore lint/a11y/useSemanticElements: <dialog>의 기본 모양·포커스 동작 대신 한지 카드를 쓴다
    <div class="veil" role="dialog" aria-modal="true" aria-label={props.title}>
      <div class="card confirm">
        <Plaque>{props.title}</Plaque>
        <div class="confirm-body">{props.children}</div>
        <div class="row">
          <button type="button" class="btn-quiet" onClick={props.onCancel} disabled={props.busy}>
            {props.cancelLabel ?? "그만두기"}
          </button>
          <button
            type="button"
            class={props.danger ? "btn-danger" : "btn-primary"}
            onClick={props.onOk}
            disabled={props.busy}
          >
            {props.busy ? "잠시만요…" : props.okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastHost() {
  if (toasts.value.length === 0) return null;
  return (
    <div class="toasts" aria-live="polite">
      {toasts.value.map((t) => (
        <div key={t.id} class="toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** 별이 반짝이는 밤하늘 배경 (프로필·기록·운세 화면 뒤) */
const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return { x: r(1) * 100, y: r(2) * 62, s: 0.6 + r(3) * 1.6, d: r(4) * 4 };
});

export function NightSky(): JSX.Element {
  return (
    <div class="night" aria-hidden="true">
      {STARS.map((s) => (
        <i
          key={`${s.x}`}
          class="star"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.s * 1.6}px`,
            height: `${s.s * 1.6}px`,
            animationDelay: `${s.d}s`,
          }}
        />
      ))}
      <div class="night-moon" />
      <div class="night-hills" />
    </div>
  );
}
