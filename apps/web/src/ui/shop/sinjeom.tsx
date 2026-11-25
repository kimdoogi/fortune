/**
 * 아기도령 신점 (F07, D-073·D-087). 진짜 신점 순서: 띠 묻기 → 방울 흔들고 쌀 던지기(쌀점) → 공수 → 문답 →
 * 마지막에 처방과 복 약속. 문답은 빠른 답 칩 또는 직접 입력, 사용자 말 5번까지.
 * 대화 한 번 = 이어 묻기 API 한 번 (F15 구조: 캐시·위험 검사).
 */
import type { FlagGrade, ReadingResult } from "@fortune/shared-types";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ApiFailure, api, newRequestId } from "../../api/client";
import { sfx } from "../../audio/sound";
import type { FlowProps } from "./flows";
import { atLeast, josaA } from "./helpers";

/** 빠른 답: 신점 문답처럼 처방과 주제별 점괘로 이어지게 (F07, D-074·D-087) */
const CHIPS = ["맞아! 어떻게 해?", "음… 그건 아닌데", "연애는?", "돈은?", "일은?", "조심할 건?"];
/** 띠 묻기 → 방울·쌀 던지기 사이 시간 */
const ASK_MS = 2200;
/** 쌀알이 다 떨어지는 시간 */
const RICE_MS = 1500;

type Rice = { count: number; grade: FlagGrade };
const RICE_LABEL: Record<FlagGrade, string> = {
  대길: "제일 좋은 수",
  길: "좋은 수",
  평: "보통 수",
  주의: "조심하라는 수",
};

/** 쌀알 열 개의 고정 이름 (목록 키) */
const GRAIN_IDS = ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8", "g9", "g10"];

/** 놋 쟁반에 떨어진 쌀알 (쌀점, D-087). 자리는 해바라기 배치로 고정 */
export function RiceTray(props: { rice: Rice }) {
  const { count, grade } = props.rice;
  return (
    <div class="sh-rice" role="img" aria-label={`쌀알 ${count}개, ${RICE_LABEL[grade]}`}>
      <div class="sh-rice-tray">
        {GRAIN_IDS.slice(0, count).map((id, i) => {
          const a = i * 2.39996;
          const r = 9 + Math.sqrt(i) * 9;
          return (
            <i
              key={id}
              class="sh-rice-grain"
              style={{
                left: `calc(50% + ${Math.cos(a) * r}px)`,
                top: `calc(50% + ${Math.sin(a) * r * 0.55}px)`,
                transform: `rotate(${(i * 47) % 180}deg)`,
                animationDelay: `${(i * RICE_MS) / Math.max(count, 1) / 1.4}ms`,
              }}
            />
          );
        })}
      </div>
      <p class={`sh-rice-label sh-rice-${grade === "주의" ? "care" : "good"}`}>
        쌀 <b>{count}</b>알 · {RICE_LABEL[grade]}
      </p>
    </div>
  );
}
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
  const [rice, setRice] = useState<Rice | null>(null);
  const alive = useRef(true);
  const requestId = useRef(newRequestId());
  const timers = useRef<number[]>([]);
  const nick = props.profile.nickname;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(() => alive.current && fn(), ms));
  };

  // 진짜 신점 순서 (D-087): 띠 묻기 → 방울 흔들고 쌀 던지기 → 쌀알 → 공수. 그동안 서버가 공수를 만든다
  // biome-ignore lint/correctness/useExhaustiveDependencies: 처음 한 번만
  useEffect(() => {
    const zodiac = props.profile.zodiac;
    props.npc("greet");
    props.say(
      `왔어? ${nick}${josaA(nick)}, 몇 살이야? …아${zodiac ? `, ${zodiac}띠구나` : ""}! 잠깐만, 할아버지한테 물어볼게!`,
    );
    later(() => {
      props.npc("present");
      props.say("딸랑딸랑… 어디 보자, 쌀 던진다!", true);
      sfx("bell");
    }, ASK_MS);
    atLeast(
      api.read({ shop: "dolyeong", product: "sinjeom", requestId: newRequestId() }),
      ASK_MS + 1600,
    ).then(
      (r) => {
        if (!alive.current) return;
        setResult(r);
        setLeft(r.followupsLeft);
        props.onCallsLeft?.(r.todayCallsLeft);
        const thrown = r.visual.shop === "dolyeong" ? r.visual.rice : undefined;
        if (thrown) setRice(thrown);
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
        // 쌀알이 다 떨어진 뒤 공수를 시작한다
        let at = thrown ? RICE_MS : 0;
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
        {rice ? (
          <RiceTray rice={rice} />
        ) : (
          <span class="sh-sj-bell" aria-hidden="true">
            🔔
          </span>
        )}
      </div>
    );
  }

  const count = [...text].length;
  return (
    <div class="sh-block sh-sj">
      {rice && !mine && <RiceTray rice={rice} />}
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
