/**
 * 점술가 대화 상자 (F04). 목재 이름표 + 한지 말풍선, 대사는 한 글자씩 (탭하면 바로 다 보임).
 */
import type { JSX } from "preact";
import { useTyping } from "../reading/typing";

export function Dialogue(props: {
  name: string;
  line: string;
  /** 기다리는 중 (점 셋이 깜빡임) */
  busy?: boolean;
}): JSX.Element {
  const typing = useTyping([{ text: props.line, ms: 34 }], true, 120);
  const chars = typing.tl.chars[0] ?? [];
  return (
    <div
      class="sh-dialogue"
      onClick={typing.skip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") typing.skip();
      }}
      aria-live="polite"
      aria-label={`${props.name}: ${props.line}`}
    >
      <span class="sh-name">{props.name}</span>
      <p class="sh-line" aria-hidden="true">
        {chars.slice(0, typing.shown).join("")}
        <span class="rd-ghost">{chars.slice(typing.shown).join("")}</span>
        {props.busy && typing.done && (
          <span class="sh-dots">
            <i />
            <i />
            <i />
          </span>
        )}
      </p>
      {typing.done && !props.busy && <span class="sh-more" />}
    </div>
  );
}
