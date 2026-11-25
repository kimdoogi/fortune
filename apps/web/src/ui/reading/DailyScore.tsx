/**
 * 오늘의 운세 점수와 행운의 숫자 (F13, D-080). 값은 서버가 코드로 계산한다 (02 §5-6-2).
 * 지도 → 오늘의 운세 화면과 사주집 메뉴의 오늘의 운세에서 같이 쓴다.
 */
import type { DailyResponse } from "@fortune/shared-types";
import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";

const R = 34;
const C = 2 * Math.PI * R;

const TONE: Record<DailyResponse["scoreLabel"], string> = {
  "아주 좋음": "best",
  좋음: "good",
  보통: "soso",
  조심: "care",
};

export function DailyScore(props: { data: DailyResponse }): JSX.Element | null {
  const { score, scoreLabel, luckyNumbers } = props.data;
  const [shown, setShown] = useState(0);

  // 0에서 점수까지 올라간다 (움직임 줄이기 설정이면 바로)
  useEffect(() => {
    if (typeof score !== "number") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(score);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setShown(Math.round(score * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  // 예전 서버 응답에는 점수가 없다
  if (typeof score !== "number") return null;
  return (
    <div class={`ds ds-${TONE[scoreLabel] ?? "soso"}`}>
      <div class="ds-ring" role="img" aria-label={`오늘 운세 점수 ${score}점, ${scoreLabel}`}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle class="ds-track" cx="40" cy="40" r={R} />
          <circle
            class="ds-fill"
            cx="40"
            cy="40"
            r={R}
            stroke-dasharray={C}
            stroke-dashoffset={C * (1 - shown / 100)}
          />
        </svg>
        <div class="ds-num" aria-hidden="true">
          <b>{shown}</b>
          <small>점</small>
        </div>
      </div>
      <div class="ds-side">
        <span class="ds-label">{scoreLabel}</span>
        <span class="ds-cap">오늘의 운세 점수</span>
        {luckyNumbers?.length > 0 && (
          <div class="ds-lucky">
            <span class="ds-cap">행운의 숫자</span>
            <span class="ds-balls">
              {luckyNumbers.map((n) => (
                <b key={n}>{n}</b>
              ))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
