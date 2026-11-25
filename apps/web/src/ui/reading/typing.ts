/**
 * 한 글자씩 보여 주기 (D-044). 응답을 다 받은 뒤 화면에서만 연출한다 (스트리밍 아님).
 * 여러 덩어리(인사 → 요약 → 섹션…)를 이어서 친다. 시간표는 순수 함수로 만들어 테스트한다.
 */
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

export interface TypingBlock {
  text: string;
  /** 한 글자에 걸리는 시간 (ms) */
  ms: number;
}

export interface Timeline {
  /** 글자마다 화면에 나타나는 시각 (ms, 오름차순). 모든 덩어리를 이어 붙인 순서 */
  times: number[];
  /** 덩어리마다 첫 글자의 위치 */
  offsets: number[];
  /** 덩어리마다 글자 (한글 음절·이모지를 한 글자로) */
  chars: string[][];
  total: number;
}

/** 문장 끝·쉼표 뒤에 숨을 고른다 */
export const PUNCT_PAUSE = 260;
/** 덩어리 사이 쉬는 시간 */
export const BLOCK_PAUSE = 380;

export const splitChars = (s: string): string[] => Array.from(s);

export function charDelay(ch: string, ms: number): number {
  if (/[.!?…。]/.test(ch)) return ms + PUNCT_PAUSE;
  if (/[,·~]/.test(ch)) return ms + PUNCT_PAUSE / 2;
  if (ch === "\n") return ms + PUNCT_PAUSE;
  return ms;
}

export function buildTimeline(blocks: TypingBlock[], blockPause = BLOCK_PAUSE): Timeline {
  const times: number[] = [];
  const offsets: number[] = [];
  const chars: string[][] = [];
  let t = 0;
  blocks.forEach((b, i) => {
    if (i > 0 && b.text) t += blockPause;
    offsets.push(times.length);
    const cs = splitChars(b.text);
    chars.push(cs);
    for (const c of cs) {
      times.push(t);
      t += charDelay(c, b.ms);
    }
  });
  return { times, offsets, chars, total: t };
}

/** t 시각까지 나타난 글자 수 (이분 탐색) */
export function countAt(times: number[], t: number): number {
  if (t === Number.POSITIVE_INFINITY) return times.length;
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((times[mid] ?? 0) <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** 전체에서 n글자가 보일 때 i번째 덩어리에 보이는 글자 수 */
export function blockCount(tl: Timeline, i: number, n: number): number {
  const off = tl.offsets[i] ?? 0;
  const len = tl.chars[i]?.length ?? 0;
  return Math.max(0, Math.min(len, n - off));
}

export interface Typing {
  /** 지금까지 보인 글자 수 (전체) */
  shown: number;
  done: boolean;
  skip: () => void;
  tl: Timeline;
}

/**
 * enabled가 false면 처음부터 다 보여 준다 (다시 보기, F10).
 * 같은 글자 수에서는 다시 그리지 않도록 정수만 상태로 둔다.
 */
export function useTyping(blocks: TypingBlock[], enabled: boolean, delay = 0): Typing {
  const key = blocks.map((b) => `${b.ms}:${b.text}`).join("\u0001");
  // biome-ignore lint/correctness/useExhaustiveDependencies: 글자 내용이 같으면 시간표를 다시 만들지 않는다
  const tl = useMemo(() => buildTimeline(blocks), [key]);
  const [shown, setShown] = useState(enabled ? 0 : tl.times.length);
  const skipped = useRef(false);

  useEffect(() => {
    skipped.current = false;
    if (!enabled) {
      setShown(tl.times.length);
      return;
    }
    setShown(0);
    let raf = 0;
    let start = -1;
    const tick = (now: number) => {
      if (skipped.current) return;
      if (start < 0) start = now + delay;
      const n = countAt(tl.times, now - start);
      setShown(n);
      if (n < tl.times.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tl, enabled, delay]);

  return {
    shown,
    done: shown >= tl.times.length,
    skip: () => {
      skipped.current = true;
      setShown(tl.times.length);
    },
    tl,
  };
}
