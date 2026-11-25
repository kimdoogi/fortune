/**
 * 결과 화면 (S5). 점집 안(F05~F08), 점 기록 다시 보기(F10), 오늘의 운세(F13)가 같이 쓴다.
 * - 응답을 다 받은 뒤 한 글자씩 보여 준다 (D-044). 다시 보기는 바로 다 보여 준다
 * - 섹션 제목은 코드가 붙인다 (04 §5, SECTION_TITLES)
 * - 위기 안내 문구는 04a 그대로 (LLM을 거치지 않음)
 */
import {
  type InterpretOutput,
  PRODUCT_NAMES,
  type ProductId,
  type ReadingResult,
} from "@fortune/shared-types";
import type { ComponentChildren, JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { colorSwatch, orderedSections } from "./format";
import { type TypingBlock, blockCount, useTyping } from "./typing";
import {
  DreamSymbols,
  FLAG_ADJ,
  FlagArt,
  GradeSeal,
  SajuBoardView,
  TarotSpreadView,
} from "./visuals";
import "./reading.css";

// 덩어리별 한 글자 시간 (ms). 인사·요약은 천천히, 본문은 읽는 속도에 가깝게
const MS_GREETING = 44;
const MS_SUMMARY = 52;
const MS_SECTION = 22;
const MS_ADVICE = 38;

function Typed(props: { chars: string[]; n: number; active: boolean }) {
  const { chars, n } = props;
  if (n >= chars.length) return <>{chars.join("")}</>;
  return (
    <>
      {chars.slice(0, n).join("")}
      {props.active && <span class="rd-caret" />}
      <span class="rd-ghost">{chars.slice(n).join("")}</span>
    </>
  );
}

const Chevron = () => (
  <svg viewBox="0 0 24 24" class="rd-chev" aria-hidden="true">
    <path
      d="M6 9l6 6 6-6"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
    />
  </svg>
);

export function OutputView(props: {
  output: InterpretOutput;
  product: ProductId;
  animate: boolean;
  /** 글자가 다 나오면 한 번 부른다 */
  onDone?: () => void;
}): JSX.Element {
  const { output, product } = props;
  const sections = useMemo(() => orderedSections(product, output.sections), [product, output]);
  const collapsible = sections.length > 3;
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const blocks: TypingBlock[] = [
    { text: output.greeting, ms: MS_GREETING },
    { text: output.summary, ms: MS_SUMMARY },
    ...sections.map((s) => ({ text: s.text, ms: MS_SECTION })),
    { text: output.advice, ms: MS_ADVICE },
  ];
  const typing = useTyping(blocks, props.animate, props.animate ? 500 : 0);
  const { tl, shown, done } = typing;
  const count = (i: number) => blockCount(tl, i, shown);
  const started = (i: number) => !props.animate || done || shown > (tl.offsets[i] ?? 0);
  const active = (i: number) => {
    const n = count(i);
    return n > 0 && n < (tl.chars[i]?.length ?? 0);
  };

  // 다 나오면 알림
  const doneRef = useRef(false);
  useEffect(() => {
    if (done && !doneRef.current) {
      doneRef.current = true;
      props.onDone?.();
    }
  }, [done, props.onDone]);

  // 글자가 화면 아래로 내려가면 따라 내린다. 사용자가 직접 스크롤하면 멈춘다
  const root = useRef<HTMLDivElement>(null);
  const follow = useRef(props.animate);
  useEffect(() => {
    const scroller = root.current?.closest(".rd-scroll");
    if (!scroller) return;
    const stop = () => {
      follow.current = false;
    };
    scroller.addEventListener("wheel", stop, { passive: true });
    scroller.addEventListener("touchmove", stop, { passive: true });
    return () => {
      scroller.removeEventListener("wheel", stop);
      scroller.removeEventListener("touchmove", stop);
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 처음 한 번 스크롤 감지만 붙인다
  useEffect(() => {
    if (!follow.current || done) return;
    const scroller = root.current?.closest(".rd-scroll");
    const caret = root.current?.querySelector(".rd-caret");
    if (!scroller || !caret) return;
    const sb = scroller.getBoundingClientRect().bottom;
    const cb = caret.getBoundingClientRect().bottom;
    if (cb > sb - 72) scroller.scrollTop += cb - sb + 72;
  }, [shown, done]);

  const toggle = (key: string) => {
    const next = new Set(closed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setClosed(next);
  };

  const adviceIdx = sections.length + 2;
  return (
    <div class="rd-output" ref={root}>
      {output.greeting && started(0) && (
        <p class="rd-greeting">
          <Typed chars={tl.chars[0] ?? []} n={count(0)} active={active(0)} />
        </p>
      )}
      {output.summary && started(1) && (
        <h2 class="rd-summary">
          <Typed chars={tl.chars[1] ?? []} n={count(1)} active={active(1)} />
        </h2>
      )}
      {sections.map((s, k) => {
        const i = k + 2;
        if (!started(i)) return null;
        const isClosed = collapsible && closed.has(s.key);
        return (
          <section class={isClosed ? "rd-sec rd-sec-closed" : "rd-sec"} key={s.key}>
            {collapsible ? (
              <button
                type="button"
                class="rd-sec-title"
                aria-expanded={!isClosed}
                onClick={() => toggle(s.key)}
              >
                <span class="rd-sec-mark" />
                {s.title}
                <Chevron />
              </button>
            ) : (
              <h3 class="rd-sec-title">
                <span class="rd-sec-mark" />
                {s.title}
              </h3>
            )}
            {!isClosed && (
              <p class="rd-sec-text">
                <Typed chars={tl.chars[i] ?? []} n={count(i)} active={active(i)} />
              </p>
            )}
          </section>
        );
      })}
      {output.advice && started(adviceIdx) && (
        <blockquote class="rd-advice">
          <span class="rd-advice-label">마지막 한마디</span>
          <Typed
            chars={tl.chars[adviceIdx] ?? []}
            n={count(adviceIdx)}
            active={active(adviceIdx)}
          />
        </blockquote>
      )}
      {output.luckyColor && done && (
        <div class="rd-lucky">
          <i style={{ background: colorSwatch(output.luckyColor) }} />
          행운의 색 <b>{output.luckyColor}</b>
        </div>
      )}
      {!done && (
        <button type="button" class="rd-skip" onClick={typing.skip}>
          건너뛰기
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l6 6-6 6M13 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

/** 두루마리 모양 결과 판. 결과·오늘의 운세가 같이 쓴다 */
export function ResultSheet(props: {
  title: string;
  sub?: string;
  onClose: () => void;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <div class="rd-veil">
      <section class="rd-sheet" aria-label={props.title}>
        <div class="rd-roller rd-roller-top">
          <span class="rd-plaque">{props.title}</span>
          <button type="button" class="rd-x" aria-label="닫기" onClick={props.onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <div class="rd-scroll">
          {props.sub && <p class="rd-sub">{props.sub}</p>}
          {props.children}
        </div>
        <div class="rd-roller rd-roller-bottom" />
      </section>
    </div>
  );
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

function VisualHeader(props: { result: ReadingResult }) {
  const v = props.result.visual;
  switch (v.shop) {
    case "saju":
      return <SajuBoardView board={v.board} />;
    case "tarot":
      return <TarotSpreadView cards={v.cards} />;
    case "dolyeong":
      return (
        <div class="rd-flag-head">
          <FlagArt color={v.flag.color} class="rd-flag-art" />
          <div class="rd-flag-cap">
            <span>{FLAG_ADJ[v.flag.color] ?? v.flag.color} 깃발</span>
            <GradeSeal grade={v.flag.grade} />
          </div>
        </div>
      );
    case "dream":
      return (
        <div class="rd-dream-head">
          <p class="rd-dream-text">{v.dream}</p>
          <DreamSymbols symbols={v.symbols} />
        </div>
      );
  }
}

export function ResultView(props: {
  result: ReadingResult;
  animate: boolean;
  onClose: () => void;
}): JSX.Element {
  const { result } = props;
  const [footer, setFooter] = useState(!props.animate);
  const v = result.visual;
  const cat = v.shop === "tarot" || v.shop === "dolyeong" ? ` · ${v.category}` : "";
  return (
    <ResultSheet
      title={PRODUCT_NAMES[result.product]}
      sub={`${fmtDate(result.createdAt)}${cat}${result.reused && !props.animate ? " · 지난 풀이" : ""}`}
      onClose={props.onClose}
    >
      <div class="rd-visual">
        <VisualHeader result={result} />
      </div>
      <OutputView
        output={result.output}
        product={result.product}
        animate={props.animate}
        onDone={() => setFooter(true)}
      />
      <footer class={footer ? "rd-foot rd-foot-on" : "rd-foot"}>
        <p class="rd-disclaimer">{result.disclaimer}</p>
        <button type="button" class="rd-btn-close" onClick={props.onClose}>
          닫기
        </button>
      </footer>
    </ResultSheet>
  );
}

/** 위기 안내 (04a). 분류 결과가 self_harm이면 점을 보지 않고 이 화면만 보여 준다 */
export function CrisisScreen(props: { onClose: () => void }): JSX.Element {
  return (
    <section class="rd-crisis" aria-labelledby="rd-crisis-text">
      <div class="rd-crisis-card">
        <svg viewBox="0 0 48 48" class="rd-crisis-icon" aria-hidden="true">
          <path
            d="M24 40C12 32 7 25.5 7 19.5 7 14.3 11 11 15.4 11c3.6 0 6.6 2 8.6 5 2-3 5-5 8.6-5C37 11 41 14.3 41 19.5 41 25.5 36 32 24 40z"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linejoin="round"
          />
        </svg>
        <div id="rd-crisis-text" class="rd-crisis-text">
          <p>지금 많이 힘드신 것 같아요. 혼자 견디지 않으셔도 괜찮아요.</p>
          <p>
            <b>자살예방상담전화 109</b> (24시간, 무료)에 전화하면 이야기를 들어 줄 사람이 있어요.
          </p>
          <p>
            위급한 상황이라면 <b>112</b> 또는 <b>119</b>에 바로 연락해 주세요.
          </p>
        </div>
        <a class="rd-crisis-call" href="tel:109">
          109에 전화하기
        </a>
        <div class="rd-crisis-sub">
          <a href="tel:112">112</a>
          <a href="tel:119">119</a>
        </div>
        <button type="button" class="rd-btn-close" onClick={props.onClose}>
          돌아가기
        </button>
      </div>
    </section>
  );
}
