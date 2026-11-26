/**
 * 유형 카드 받기 (F19, D-101). 링크 `?t=<코드>`로 들어오면 여기로 온다.
 * 프로필이 없으면 처음 화면(F02)을 거쳐 돌아오고, 있으면 내 유형과 둘의 맞음을 바로 보여 준다.
 */
import { DISCLAIMER, type TypeCardView } from "@fortune/shared-types";
import { useEffect, useState } from "preact/hooks";
import { ApiFailure, api } from "../../../api/client";
import { Loading, NightSky } from "../../app/kit";
import { navigate } from "../../app/router";
import { profile } from "../../app/state";
import { GradeTag, MatchWhy, TypeBadge, shareTypeCard } from "../../types/TypeBits";

export function CardScreen(props: { code: string }) {
  const [view, setView] = useState<TypeCardView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.typeCard(props.code).then(
      (v) => alive && setView(v),
      (e) => {
        if (!alive) return;
        setError(
          e instanceof ApiFailure ? e.message : "카드를 불러오지 못했어요. 다시 열어 주세요.",
        );
      },
    );
    return () => {
      alive = false;
    };
  }, [props.code]);

  const toMap = () => navigate({ name: "map" }, { replace: true });
  const toShop = () => navigate({ name: "street", shop: "jokjipge" }, { replace: true });

  return (
    <div class="screen center splash">
      <NightSky />
      <div class="card ty-paper ty-card">
        {error ? (
          <>
            <p>{error}</p>
            <button type="button" class="ty-btn ty-btn-main" onClick={toMap}>
              지도로 가기
            </button>
          </>
        ) : !view ? (
          <Loading text="카드를 펼치는 중이에요" />
        ) : (
          <>
            <TypeBadge
              type={view.type}
              who={view.mine ? "내 유형 카드예요" : `${view.nickname} 님의 유형`}
            />
            {view.viewer && !view.mine && (
              <>
                <div class="ty-vs">그리고 나는</div>
                <TypeBadge
                  type={view.viewer.type}
                  who={`${profile.value?.nickname ?? "나"} 님의 유형`}
                  small
                />
                <div class="ty-score">
                  <span class="ty-vs">두 사람은</span>
                  <GradeTag m={view.viewer.match} score />
                </div>
                <MatchWhy m={view.viewer.match} />
              </>
            )}
            <div class="ty-actions">
              <button type="button" class="ty-btn ty-btn-main" onClick={toShop}>
                족집게집 가 보기
              </button>
              <button
                type="button"
                class="ty-btn"
                onClick={() =>
                  void shareTypeCard(profile.value?.nickname ?? "", view.viewer?.type ?? view.type)
                }
              >
                {view.mine ? "카드 보내기" : "내 카드도 보내기"}
              </button>
            </div>
            <button type="button" class="ty-btn" onClick={() => navigate({ name: "types" })}>
              60유형 도감 보기
            </button>
            <p class="ty-note">{DISCLAIMER}</p>
          </>
        )}
      </div>
    </div>
  );
}
