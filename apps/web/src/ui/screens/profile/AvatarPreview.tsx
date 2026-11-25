/**
 * 캐릭터 미리보기 캔버스. 3D 코드는 이 컴포넌트가 처음 뜰 때 받는다 (07 §2).
 * WebGL2가 없으면 불빛만 보여 준다 (F01: 3D 없이도 나머지 기능은 쓸 수 있다).
 * 외모(꾸미기, F17)가 바뀌면 렌더러는 그대로 두고 캐릭터만 갈아 끼운다.
 */
import { type AgeBand, type AvatarStyle, type Gender, encodeStyle } from "@fortune/shared-types";
import { useEffect, useRef, useState } from "preact/hooks";
import { hasWebGL2 } from "../../app/preload";
import type { AvatarView } from "./avatarScene";

export function AvatarPreview(props: {
  gender: Gender;
  ageBand: AgeBand;
  /** 꾸미기 (F17). 없으면 기본 모습 */
  style?: AvatarStyle | null;
  size?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<AvatarView | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none">(
    hasWebGL2() ? "loading" : "none",
  );
  /** 컨텍스트를 못 얻으면 새 캔버스로 두 번까지 다시 해 본다 (페이지를 막 연 직후 가끔 실패) */
  const [tries, setTries] = useState(0);
  const look = { gender: props.gender, ageBand: props.ageBand, style: props.style ?? null };
  const lookRef = useRef(look);
  lookRef.current = look;
  const lookKey = `${props.gender}:${props.ageBand}:${props.style ? encodeStyle(props.style) : ""}`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 캔버스를 다시 만들 때만 새로 띄운다
  useEffect(() => {
    if (state === "none" || !canvas.current) return;
    let alive = true;
    import("./avatarScene")
      .then(({ mountAvatar }) => {
        if (!alive || !canvas.current) return;
        view.current = mountAvatar(canvas.current, lookRef.current);
        setState("ready");
      })
      .catch(() => {
        if (!alive) return;
        if (tries < 2) setTimeout(() => alive && setTries(tries + 1), 300);
        else setState("none");
      });
    return () => {
      alive = false;
      view.current?.dispose();
      view.current = null;
    };
  }, [tries]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 외모 문자열이 바뀔 때만 갈아 끼운다
  useEffect(() => {
    view.current?.setLook(lookRef.current);
  }, [lookKey]);

  return (
    <div
      class={`avatar-stage ${state}`}
      style={{ width: `${props.size ?? 220}px`, height: `${props.size ?? 220}px` }}
    >
      <div class="avatar-halo" />
      {state !== "none" && (
        <button
          type="button"
          class="avatar-btn"
          onClick={() => view.current?.wave()}
          aria-label="내 캐릭터. 누르면 손을 흔들어요"
        >
          <canvas key={tries} ref={canvas} class="avatar-canvas" />
        </button>
      )}
      {state === "loading" && <span class="avatar-wait">캐릭터를 부르는 중…</span>}
    </div>
  );
}
