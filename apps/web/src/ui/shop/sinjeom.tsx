/**
 * 아기도령 신점 대화 (F07, D-073). 들어가자마자 아기도령이 방울을 흔들고 먼저 맞힌다(공수).
 * 그다음 짧게 주고받는다: 빠른 답 칩 또는 직접 입력, 사용자 말 5번까지.
 * 대화 한 번 = 이어 묻기 API 한 번 (F15 구조: 캐시·위험 검사).
 */
import type { ReadingResult } from "@fortune/shared-types";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ApiFailure, api, newRequestId } from "../../api/client";
import { sfx } from "../../audio/sound";
import type { FlowProps } from "./flows";

/** 빠른 답: 맞히기 놀이가 아니라 도움(할 일·조심할 것)으로 이어지게 (F07, D-074) */
const CHIPS = ["맞아! 어떻게 해야 돼?", "음… 그건 아닌데", "뭘 조심해야 돼?"];
const MAX_CHARS = 60;

/** 한 줄을 읽을 시간 (글자 수에 비례) */
const lineMs = (line: string) => 900 + [...line].length * 55;

export function SinjeomFlow(props: FlowProps): JSX.Element {
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [left, setLeft] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [mine, setMine] = useState<string | null>(null);
  const alive = useRef(true);
  const requestId = useRef(newRequestId());
  const timers = useRef<number[]>([]);
  const nick = props.profile.nickname;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(() => alive.current && fn(), ms));
  };

  // 공수 받기: 방울 흔드는 동안 서버가 만든다
  // biome-ignore lint/correctness/useExhaustiveDependencies: 처음 한 번만
  useEffect(() => {
    props.npc("present");
    props.say("딸랑딸랑… 잠깐만! 눈 감고 볼게!", true);
    sfx("bell");
    api.read({ shop: "dolyeong", product: "sinjeom", requestId: newRequestId() }).then(
      (r) => {
        if (!alive.current) return;
        setResult(r);
        setLeft(r.followupsLeft);
        props.onCallsLeft?.(r.todayCallsLeft);
        const last = r.followups.at(-1);
        if (r.reused && last) {
          // 같은 날 다시 왔다: 지난 대화에서 이어 간다
          props.npc("greet");
          props.say(`또 왔네, ${nick}! 아까 하던 얘기 이어서 하자. ${last.answer}`);
          setReady(true);
          return;
        }
        const lines = (r.output.sections.gongsu ?? "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        props.npc("talk");
        let at = 0;
        lines.forEach((line, i) => {
          later(() => {
            if (i === lines.length - 1) props.npc("celebrate");
            props.say(line);
          }, at);
          at += lineMs(line);
        });
        later(() => setReady(true), Math.max(0, at - 600));
      },
      (e) => alive.current && props.onFail(e, {}),
    );
    return () => {
      alive.current = false;
      for (const t of timers.current) clearTimeout(t);
    };
  }, []);

  async function send(q: string) {
    const question = q.trim();
    if (!result || busy || !question || [...question].length > MAX_CHARS) return;
    setBusy(true);
    setMine(question);
    setText("");
    props.npc("talk");
    props.say("딸랑딸랑…", true);
    sfx("bell");
    try {
      const res = await api.followup(result.id, { question, requestId: requestId.current });
      requestId.current = newRequestId();
      if (!alive.current) return;
      setLeft(res.followupsLeft);
      props.onCallsLeft?.(res.todayCallsLeft);
      props.say(res.followup.answer);
      if (/^맞아/.test(question)) props.npc("celebrate");
      if (res.followupsLeft === 0) {
        later(
          () => props.say("오늘은 여기까지! 방울이 쉬고 싶대. 내일 또 와!"),
          lineMs(res.followup.answer) + 400,
        );
      }
    } catch (err) {
      requestId.current = newRequestId();
      if (!alive.current) return;
      if (err instanceof ApiFailure && err.code === "CRISIS") {
        props.onCrisis();
        return;
      }
      props.say(
        err instanceof ApiFailure ? err.message : "으앙, 방울 소리가 안 들려! 다시 말해 줘!",
      );
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  // 대화를 다 쓰면: 전체 대화 다시 보기
  const openTranscript = async () => {
    if (!result) return;
    try {
      props.onResult(await api.get(result.id));
    } catch (e) {
      props.onFail(e, {});
    }
  };

  if (!result || !ready) {
    return (
      <div class="sh-block sh-sj-wait" aria-live="polite">
        <span class="sh-sj-bell" aria-hidden="true">
          🔔
        </span>
      </div>
    );
  }

  const count = [...text].length;
  return (
    <div class="sh-block sh-sj">
      {mine && <p class="sh-sj-mine">{mine}</p>}
      {left > 0 ? (
        <>
          <div class="sh-sj-chips">
            {CHIPS.map((c) => (
              <button
                type="button"
                key={c}
                class="sh-sj-chip"
                disabled={busy}
                onClick={() => send(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <form
            class="sh-sj-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <input
              class="sh-sj-input"
              type="text"
              maxLength={MAX_CHARS + 10}
              placeholder="아기도령한테 말하기"
              value={text}
              disabled={busy}
              onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
            />
            <button
              type="submit"
              class="sh-sj-send"
              disabled={busy || !text.trim() || count > MAX_CHARS}
            >
              말하기
            </button>
          </form>
          <p class="sh-sj-left">
            {left}번 더 말할 수 있어{" "}
            {count > 0 && (
              <span class={count > MAX_CHARS ? "sh-sj-over" : ""}>
                · {count}/{MAX_CHARS}
              </span>
            )}
          </p>
        </>
      ) : (
        <button type="button" class="sh-primary" onClick={openTranscript}>
          대화 다시 보기
        </button>
      )}
    </div>
  );
}
