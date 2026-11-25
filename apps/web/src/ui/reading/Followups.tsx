/**
 * 이어 묻기 (F15). 결과 아래에 문답을 대화처럼 쌓고, 한 풀이에 3번까지 묻는다.
 * 답은 받은 뒤 한 글자씩 보여 준다 (D-044). 위험 글은 위기 안내, 차단은 점술가 말투 문장.
 */
import type { FollowupView, ReadingResult, ShopId } from "@fortune/shared-types";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ApiFailure, api, newRequestId } from "../../api/client";
import { CHARACTERS } from "../shop/characters";

const MAX_CHARS = 100;
const MS_PER_CHAR = 32;

/** 생각하는 동안 점술가가 하는 말 (미리 써 둔 문장, LLM 아님) */
const THINKING: Record<ShopId, string> = {
  saju: "흠… 그대의 여덟 글자를 다시 살펴보는 중이오.",
  tarot: "음… 카드를 다시 들여다보고 있어요.",
  dolyeong: "딸랑딸랑… 깃발한테 물어보는 중!",
  dream: "아이고, 차 한 모금 마시고 생각 좀 해 보자.",
};

const PLACEHOLDER: Record<ShopId, string> = {
  saju: "예: 올해 이직해도 괜찮겠소?",
  tarot: "예: 그 사람이 먼저 연락할까요?",
  dolyeong: "예: 이번 달 안에 좋은 소식 있을까?",
  dream: "예: 이 꿈이 시험이랑도 관련 있을까요?",
};

function TypedAnswer(props: { text: string; animate: boolean; onTick?: () => void }) {
  const chars = [...props.text];
  const [n, setN] = useState(props.animate ? 0 : chars.length);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 답이 바뀔 때만 다시 시작한다
  useEffect(() => {
    if (!props.animate) return;
    const id = setInterval(() => {
      setN((v) => {
        if (v >= chars.length) {
          clearInterval(id);
          return v;
        }
        props.onTick?.();
        return v + 1;
      });
    }, MS_PER_CHAR);
    return () => clearInterval(id);
  }, [props.text]);
  return (
    <>
      {chars.slice(0, n).join("")}
      {n < chars.length && <span class="rd-caret" />}
    </>
  );
}

export function Followups(props: {
  result: ReadingResult;
  onCrisis: () => void;
  onCallsLeft?: (n: number) => void;
}): JSX.Element {
  const shop = props.result.shop;
  const who = CHARACTERS[shop].name;
  const [items, setItems] = useState<FollowupView[]>(props.result.followups ?? []);
  const [left, setLeft] = useState(props.result.followupsLeft ?? 0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const requestId = useRef(newRequestId());

  const follow = () => bottom.current?.scrollIntoView({ block: "nearest" });
  const count = [...text].length;

  async function ask(e: Event) {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy || count > MAX_CHARS) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.followup(props.result.id, {
        question: q,
        requestId: requestId.current,
      });
      requestId.current = newRequestId();
      setItems((xs) => [...xs, res.followup]);
      setLeft(res.followupsLeft);
      setFresh(res.followup.id);
      setText("");
      props.onCallsLeft?.(res.todayCallsLeft);
    } catch (err) {
      requestId.current = newRequestId();
      if (err instanceof ApiFailure && err.code === "CRISIS") {
        props.onCrisis();
      } else {
        setNotice(err instanceof ApiFailure ? err.message : "잠시 후 다시 물어봐 주세요");
      }
    } finally {
      setBusy(false);
      setTimeout(follow, 30);
    }
  }

  return (
    <section class="rd-fu" aria-label="이어 묻기">
      {items.length > 0 && (
        <ol class="rd-fu-list">
          {items.map((f) => (
            <li key={f.id} class="rd-fu-turn">
              <p class="rd-fu-q">{f.question}</p>
              <div class="rd-fu-a">
                <span class="rd-fu-who">{who}</span>
                <p>
                  <TypedAnswer text={f.answer} animate={f.id === fresh} onTick={follow} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {busy && (
        <div class="rd-fu-a rd-fu-thinking">
          <span class="rd-fu-who">{who}</span>
          <p>{THINKING[shop]}</p>
        </div>
      )}
      {notice && !busy && (
        <div class="rd-fu-a rd-fu-notice" aria-live="polite">
          <span class="rd-fu-who">{who}</span>
          <p>{notice}</p>
        </div>
      )}

      {left > 0 ? (
        <form class="rd-fu-form" onSubmit={ask}>
          <label class="rd-fu-label" for="rd-fu-input">
            더 물어보기 <span>{left}번 남았어요</span>
          </label>
          <div class="rd-fu-row">
            <textarea
              id="rd-fu-input"
              class="rd-fu-input"
              rows={2}
              maxLength={MAX_CHARS + 20}
              placeholder={PLACEHOLDER[shop]}
              value={text}
              disabled={busy}
              onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
            />
            <button
              type="submit"
              class="rd-fu-send"
              disabled={busy || !text.trim() || count > MAX_CHARS}
            >
              물어보기
            </button>
          </div>
          <span class={count > MAX_CHARS ? "rd-fu-count rd-fu-over" : "rd-fu-count"}>
            {count}/{MAX_CHARS}
          </span>
        </form>
      ) : (
        <p class="rd-fu-done">이 풀이에는 다 물어봤어요. 더 궁금한 건 새로 점을 봐요.</p>
      )}
      <div ref={bottom} />
    </section>
  );
}
