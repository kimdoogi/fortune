/**
 * 족집게집 60유형 도감 (F19, D-101). 60칸(일간 10줄 × 6)을 나와의 맞음 등급 색으로 보여 주고,
 * 칸을 누르면 그 유형의 이름·소개와 나와의 맞음·이유. 계산은 서버(코드, 02 §5-10).
 */
import { DISCLAIMER, type MyTypesResponse, type TypeMatchLabel } from "@fortune/shared-types";
import { useEffect, useMemo, useState } from "preact/hooks";
import { api } from "../../../api/client";
import { Loading, NightSky, TopBar } from "../../app/kit";
import { goBack } from "../../app/router";
import { friendly, handleAuth, profile } from "../../app/state";
import { AnimalArt } from "../../types/AnimalArt";
import { CardShareButtons, GradeTag, MatchWhy, TypeBadge } from "../../types/TypeBits";
import { GRADE_CLASS, TYPES_60, typeInfo } from "../../types/typeData";

const LABELS: TypeMatchLabel[] = ["찰떡", "잘 맞음", "맞춰 가면 괜찮음", "부딪힘"];
/** 같은 동물끼리 한 줄 (12줄 × 나의 기운 5칸) */
const ROWS = Array.from({ length: 12 }, (_, r) => TYPES_60.slice(r * 5, r * 5 + 5));

export function TypesScreen(props: { type?: string }) {
  const [data, setData] = useState<MyTypesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<string | undefined>(props.type);

  useEffect(() => {
    let alive = true;
    api.myTypes().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setSel((s) => s ?? d.type);
      },
      (e) => {
        if (!alive || handleAuth(e)) return;
        setError(friendly(e));
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const byType = useMemo(() => new Map(data?.matches.map((m) => [m.type, m]) ?? []), [data]);
  const picked = sel ? byType.get(sel) : undefined;

  return (
    <div class="screen sub ty-page">
      <NightSky />
      <TopBar title="60유형 도감" backLabel="뒤로" onBack={() => goBack({ name: "map" })} />
      <div class="scroll">
        <div class="sub-body">
          {!data ? (
            error ? (
              <div class="card ty-empty">
                <p>{error}</p>
              </div>
            ) : (
              <Loading text="족집게 도사가 도감을 펼치는 중이에요" />
            )
          ) : (
            <section class="ty-paper">
              <TypeBadge type={data.type} who={`${profile.value?.nickname ?? "나"} 님의 유형`} />
              <div class="ty-legend">
                {LABELS.map((l) => (
                  <span key={l} class={`ty-grade ${GRADE_CLASS[l]}`}>
                    {l}
                  </span>
                ))}
              </div>
              <div class="ty-grid">
                {ROWS.flat().map((t) => {
                  const m = byType.get(t);
                  const cls = [
                    "ty-cell",
                    m ? GRADE_CLASS[m.label] : "",
                    t === data.type ? "ty-cell-me" : "",
                    t === sel ? "ty-cell-on" : "",
                  ].join(" ");
                  return (
                    <button
                      type="button"
                      key={t}
                      class={cls}
                      aria-label={`${typeInfo(t).name} ${m?.label ?? ""}`}
                      onClick={() => setSel(t)}
                    >
                      <AnimalArt type={t} size={54} />
                      <b>{typeInfo(t).name}</b>
                      <small>
                        {t === data.type
                          ? "나"
                          : m?.label === "맞춰 가면 괜찮음"
                            ? "보통"
                            : m?.label}
                      </small>
                    </button>
                  );
                })}
              </div>

              {sel && picked && (
                <div class="ty-detail">
                  <TypeBadge type={sel} />
                  <div class="ty-detail-head">
                    {sel === data.type ? (
                      <span>나와 같은 유형이에요 · 닮은꼴</span>
                    ) : (
                      <>
                        <span>나와는</span>
                        <GradeTag m={picked} score />
                      </>
                    )}
                  </div>
                  <MatchWhy m={picked} />
                </div>
              )}

              <CardShareButtons type={data.type} />
              <button
                type="button"
                class="ty-btn ty-btn-wide"
                onClick={() => goBack({ name: "map" })}
              >
                닫기
              </button>
              <p class="ty-note">{DISCLAIMER}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
