/**
 * F13 오늘의 운세 (S1에서 바로). 오늘 날짜·일진·내 일간 + 청운 선생 말투 풀이가 한 글자씩 나온다.
 * 아래에 "사주집 가기", "공유하기"(F11, M4에서 연다). 기록(F10)에는 남지 않는다.
 */
import type { DailyResponse } from "@fortune/shared-types";
import { useEffect, useState } from "preact/hooks";
import { ApiFailure, api } from "../../../api/client";
import { longDate } from "../../app/format";
import { Icon, NightSky } from "../../app/kit";
import { goBack, navigate } from "../../app/router";
import { Portrait } from "../../app/shops";
import { friendly, handleAuth, profile } from "../../app/state";
import { OutputView, ResultSheet } from "../../reading/ResultView";
import "./daily.css";

/** 대체 문장 (04a 사주집) */
const FALLBACK = "오늘은 별자리가 구름에 가려 사주가 잘 읽히지 않는구려. 잠시 뒤에 다시 오시오.";

export function DailyScreen() {
  const [data, setData] = useState<DailyResponse | null>(null);
  const [fail, setFail] = useState<{ text: string; llm: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const [n, setN] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: n은 "다시 보기" 횟수 (바뀌면 다시 부른다)
  useEffect(() => {
    let alive = true;
    setData(null);
    setFail(null);
    api.daily().then(
      (d) => alive && setData(d),
      (e) => {
        if (!alive || handleAuth(e)) return;
        const llm = e instanceof ApiFailure && e.code === "LLM_UNAVAILABLE";
        // LLM 실패는 서버가 준 점집 말투 문장을 그대로 보여 준다 (docs/04 §9)
        setFail({
          text: llm ? (/[가-힣]/.test(e.message) ? e.message : FALLBACK) : friendly(e),
          llm,
        });
      },
    );
    return () => {
      alive = false;
    };
  }, [n]);

  const close = () => goBack({ name: "map" });
  const p = profile.value;

  return (
    <div class="screen daily">
      <NightSky />
      <ResultSheet title="오늘의 운세" onClose={close}>
        {!data && !fail && (
          <div class="dy-wait">
            <Portrait shop="saju" size={76} />
            <p class="dy-bubble">오늘의 일진을 살피는 중이오…</p>
            <span class="dy-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}

        {fail && (
          <div class="dy-wait">
            <Portrait shop="saju" size={76} />
            <p class="dy-bubble">{fail.text}</p>
            <button type="button" class="btn-primary" onClick={() => setN(n + 1)}>
              다시 보기
            </button>
          </div>
        )}

        {data && (
          <>
            <header class="dy-head">
              <div class="dy-date">{longDate(data.date)}</div>
              <div class="dy-pair">
                <div class="dy-cell">
                  <span>오늘의 일진</span>
                  <b>{data.iljin}</b>
                </div>
                <div class="dy-x" aria-hidden="true">
                  ✕
                </div>
                <div class="dy-cell">
                  <span>{p ? `${p.nickname} 님의 일간` : "나의 일간"}</span>
                  <b>
                    {data.dayMaster}
                    {p?.dayMaster.stem === data.dayMaster && <small>{p.dayMaster.element}</small>}
                  </b>
                </div>
              </div>
              <div class="dy-master">
                <Portrait shop="saju" size={44} />
                <span>사주집 · 청운 선생</span>
              </div>
            </header>
            <OutputView output={data.result} product="daily" animate onDone={() => setDone(true)} />
            <footer class={`rd-foot ${done ? "rd-foot-on" : ""} dy-foot`}>
              <p class="rd-disclaimer">{data.disclaimer}</p>
              <div class="row">
                <button
                  type="button"
                  class="btn-quiet"
                  disabled
                  title="곧 열려요"
                  aria-label="공유하기 (곧 열려요)"
                >
                  <Icon.share />
                  공유하기
                </button>
                <button
                  type="button"
                  class="btn-primary"
                  onClick={() => navigate({ name: "street", shop: "saju" }, { replace: true })}
                >
                  <Icon.door />
                  사주집 가기
                </button>
              </div>
              <p class="dy-soon">공유하기는 곧 열려요</p>
            </footer>
          </>
        )}
      </ResultSheet>
    </div>
  );
}
