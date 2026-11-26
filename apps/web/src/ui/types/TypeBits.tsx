/** 족집게집 60유형 조각: 유형 카드, 맞음 칩, 카드 보내기 (F19, D-101) */
import { TYPE_FACTOR_TEXT, type TypeMatchBrief, type TypeMatchView } from "@fortune/shared-types";
import type { JSX } from "preact";
import { api } from "../../api/client";
import { profile, toast } from "../app/state";
import { copyText } from "../shop/pair";
import { AnimalArt } from "./AnimalArt";
import { GRADE_CLASS, typeInfo } from "./typeData";
import "./types.css";

/** 유형 카드: 일주 두 글자 + 이름 + 한 줄 소개 + 키워드 */
export function TypeBadge(props: { type: string; who?: string; small?: boolean }): JSX.Element {
  const info = typeInfo(props.type);
  return (
    <div class={props.small ? "ty-badge ty-badge-sm" : "ty-badge"}>
      <span class="ty-pic">
        <AnimalArt type={props.type} size={props.small ? 52 : 80} />
      </span>
      <div class="ty-badge-text">
        {props.who && <span class="ty-who">{props.who}</span>}
        <b class="ty-name">{info.name}</b>
        {!props.small && <span class="ty-tagline">{info.tagline}</span>}
        {!props.small && (
          <span class="ty-keys">
            {info.keywords.map((k) => (
              <i key={k}>#{k}</i>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

/** 등급 표시 */
export function GradeTag(props: { m: TypeMatchBrief; score?: boolean }): JSX.Element {
  return (
    <span class={`ty-grade ${GRADE_CLASS[props.m.label]}`}>
      {props.m.label}
      {props.score && <b>{props.m.score}점</b>}
    </span>
  );
}

/** 맞음 이유 (요인 문장, 02 §5-10) */
export function MatchWhy(props: { m: TypeMatchView }): JSX.Element {
  return (
    <ul class="ty-why">
      {props.m.factors.map((f) => (
        <li key={f.kind} class={f.good ? "ty-why-good" : "ty-why-bad"}>
          {TYPE_FACTOR_TEXT[f.kind]}
        </li>
      ))}
    </ul>
  );
}

/** 잘 맞는 유형·안 맞는 유형 칩 줄 */
export function MatchRow(props: {
  title: string;
  items: TypeMatchBrief[];
  onPick: (type: string) => void;
}): JSX.Element {
  return (
    <div class="ty-row">
      <span class="ty-row-title">{props.title}</span>
      <div class="ty-chips">
        {props.items.map((m) => (
          <button
            type="button"
            key={m.type}
            class={`ty-chip ${GRADE_CLASS[m.label]}`}
            onClick={() => props.onPick(m.type)}
          >
            <AnimalArt type={m.type} size={48} />
            <span class="ty-chip-name">{typeInfo(m.type).name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 내 유형 카드 링크 (한 사람 하나라 여러 번 눌러도 같은 링크) */
async function cardUrl(): Promise<string | null> {
  try {
    return (await api.createTypeCard()).url;
  } catch {
    toast("카드를 만들지 못했어요. 잠시 뒤 다시 해 주세요.");
    return null;
  }
}

/** 휴대폰 공유 창으로 보낸다. 공유 창이 없으면 복사 */
export async function shareTypeCard(nickname: string, type: string): Promise<void> {
  const url = await cardUrl();
  if (!url) return;
  const text = `${nickname} 님은 '${typeInfo(type).name}' 유형이래요. 나랑 잘 맞는지 확인해 봐요!`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "족집게집 유형 카드", text, url });
    } catch {
      // 사용자가 닫았다: 아무것도 하지 않는다 (복사는 옆 버튼)
    }
    return;
  }
  await copyTypeCard(url);
}

/** 링크만 복사 */
export async function copyTypeCard(known?: string): Promise<void> {
  const url = known ?? (await cardUrl());
  if (!url) return;
  toast((await copyText(url)) ? "링크를 복사했어요" : "복사하지 못했어요. 다시 눌러 주세요.");
}

/** 카드 보내기 + 링크 복사 버튼 한 줄 */
export function CardShareButtons(props: { type: string; sendLabel?: string }): JSX.Element {
  const nick = profile.value?.nickname ?? "";
  return (
    <div class="ty-actions">
      <button
        type="button"
        class="ty-btn ty-btn-main"
        onClick={() => void shareTypeCard(nick, props.type)}
      >
        {props.sendLabel ?? "내 유형 카드 보내기"}
      </button>
      <button type="button" class="ty-btn" onClick={() => void copyTypeCard()}>
        링크 복사
      </button>
    </div>
  );
}
