/**
 * 같이 보는 점 (F16, D-089·D-090). 둘이 같이 들어온 점집 안에서 그 점집의 같이 보는 점을 본다.
 * - PairChoiceFlow: 궁합·관계 타로·둘의 신점. 누구든 관계를 고르면 풀이를 만들고, 상대 화면에도 같은 결과가 뜬다
 * - DreamPairFlow: 두 사람 꿈풀이. 둘 다 꿈을 써야 풀이를 만든다
 */
import {
  type FlagGrade,
  GUNGHAP_RELATIONS,
  type GunghapRelation,
  type PairShopId,
  type ReadingResult,
  type ServerMessage,
  type ShopId,
} from "@fortune/shared-types";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ApiFailure, api, newRequestId } from "../../api/client";
import { sfx } from "../../audio/sound";
import { DreamSymbols } from "../reading/visuals";
import { DREAM_MAX, type FlowProps } from "./flows";
import { josaA, josaGa } from "./helpers";
import { RiceTray } from "./sinjeom";

/** 동의 문구 (F16): 무엇이 서로에게 보이는지 */
export const PAIR_CONSENT =
  "같이 보면 두 사람의 띠·타고난 기운, 풀이와 더 물어본 질문이 서로에게 보여요. 생년월일과 태어난 시간은 보이지 않아요.";

/** 점집 안에서 쓰는 같이 보기 정보 (StreetScreen이 넘겨 준다) */
export interface PairCtx {
  code: string;
  myId: string;
  /** 내가 방장인가 (지도로 같이 나가기는 방장만) */
  host: boolean;
  partnerName: string | null;
  /** 방에서 온 마지막 풀이 소식. seq로 새 소식을 가린다 */
  event: { seq: number; msg: ServerMessage } | null;
}

/** 클립보드에 복사. 막혀 있으면 예전 방식(선택 후 복사)으로. 됐으면 true */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** 링크 보내기: 휴대폰 공유 창, 안 되면 복사 */
export async function shareInvite(url: string, nickname: string): Promise<"shared" | "copied"> {
  const text = `${nickname} 님이 점집 거리에서 같이 점을 보자고 불렀어요!`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "점집 거리 같이 보기", text, url });
      return "shared";
    } catch {
      // 취소하면 복사로
    }
  }
  await copyText(url);
  return "copied";
}

type ChoiceProduct = "gunghap" | "tarot_pair" | "sinjeom_pair";

/** 점집별 말 (04a 말투) */
const LINES: Record<
  Exclude<PairShopId, "dream">,
  {
    greet: string;
    ask: (me: string, partner: string) => string;
    picked: (partner: string, rel: string) => string;
    mine: (rel: string) => string;
  }
> = {
  saju: {
    greet: "어서 오시오, 두 분. 나란히 앉으니 보기 좋구려.",
    ask: (me, p) => `${me} 님, ${p} 님. 두 분은 어떤 사이요? 골라 보시오.`,
    picked: (p, rel) => `${p} 님이 "${rel}" 사이라 하는구려. 두 분의 사주를 맞춰 보겠소…`,
    mine: (rel) => `${rel} 사이로구려. 두 분의 사주를 맞춰 보겠소…`,
  },
  tarot: {
    greet: "어서 오세요, 두 분. 나란히 앉으시니 카드도 설레나 봐요.",
    ask: (me, p) => `${me} 님, ${p} 님은 어떤 사이세요? 골라 주시면 카드를 펼칠게요.`,
    picked: (p, rel) =>
      `${p} 님이 "${rel}" 사이라고 하셨네요. 두 분 마음을 한 장씩, 앞날을 한 장 뽑을게요…`,
    mine: (rel) => `${rel} 사이시군요. 두 분 마음을 한 장씩, 앞날을 한 장 뽑을게요…`,
  },
  dolyeong: {
    greet: "왔어? 둘이 같이 왔네! 나란히 앉아 봐!",
    ask: (me, p) => `${me}${josaA(me)}, ${p}${josaA(p)}. 너희 둘이 무슨 사이야?`,
    picked: (p, rel) => `${p}${josaA(p)}, "${rel}" 사이라고? 할아버지한테 물어볼게! 딸랑딸랑…`,
    mine: (rel) => `${rel} 사이구나! 할아버지한테 물어볼게! 딸랑딸랑…`,
  },
};

const PRODUCT_SHOP: Record<ChoiceProduct, Exclude<PairShopId, "dream">> = {
  gunghap: "saju",
  tarot_pair: "tarot",
  sinjeom_pair: "dolyeong",
};

/** 쌀알이 다 떨어지는 시간 (신점과 같다) */
const RICE_MS = 1500;

export function PairChoiceFlow(
  props: FlowProps & { pair: PairCtx; product: ChoiceProduct },
): JSX.Element {
  const { pair, product } = props;
  const lines = LINES[PRODUCT_SHOP[product]];
  const [busy, setBusy] = useState(true);
  const [rice, setRice] = useState<{ count: number; grade: FlagGrade } | null>(null);
  const mine = useRef(false);
  const alive = useRef(true);
  const lastSeq = useRef(pair.event?.seq ?? 0);
  const partner = pair.partnerName ?? "같이 온 분";
  const nick = props.profile.nickname;

  /** 결과 보여 주기. 둘의 신점은 쌀점 쟁반을 먼저 보여 준다 */
  const show = (got: ReadingResult, fresh: boolean) => {
    // 상대가 방금 만든 풀이는 저장본이어도 새 풀이처럼 보여 준다
    const r = fresh ? { ...got, reused: false } : got;
    props.onCallsLeft?.(r.todayCallsLeft);
    const thrown = r.visual.shop === "dolyeong" ? r.visual.rice : undefined;
    if (fresh && thrown) {
      setRice(thrown);
      sfx("bell");
      props.npc("present");
      setTimeout(() => alive.current && props.onResult(r), RICE_MS + 900);
      return;
    }
    props.onResult(r);
  };

  const fetchResult = (fresh: boolean) =>
    api.pairResult(pair.code, product).then(
      (r) => alive.current && show(r, fresh),
      (e) => {
        if (!alive.current) return;
        if (e instanceof ApiFailure && e.code === "NOT_FOUND") {
          setBusy(false);
          props.npc("talk");
          props.say(lines.ask(nick, partner));
          return;
        }
        props.onFail(e, {});
      },
    );

  // 다시 들어왔으면 저장된 결과부터 (초대 하나에 상품마다 풀이 하나)
  // biome-ignore lint/correctness/useExhaustiveDependencies: 처음 한 번만
  useEffect(() => {
    props.npc("greet");
    props.say(lines.greet, true);
    void fetchResult(false);
    return () => {
      alive.current = false;
    };
  }, []);

  // 방 소식: 상대가 골랐다, 결과가 나왔다, 실패했다 (이 상품 것만)
  // biome-ignore lint/correctness/useExhaustiveDependencies: 새 소식이 올 때만
  useEffect(() => {
    const ev = pair.event;
    if (!ev || ev.seq === lastSeq.current) return;
    lastSeq.current = ev.seq;
    const m = ev.msg;
    if ("product" in m && m.product && m.product !== product) return;
    if (m.t === "picked" && m.id !== pair.myId) {
      setBusy(true);
      props.npc("talk");
      props.say(lines.picked(partner, m.relation), true);
    } else if (m.t === "result_ready" && !mine.current) {
      void fetchResult(true);
    } else if (m.t === "result_failed" && !mine.current) {
      setBusy(false);
      props.say(m.message);
    }
  }, [pair.event]);

  const pick = async (relation: GunghapRelation) => {
    if (busy) return;
    setBusy(true);
    mine.current = true;
    // 상대에게는 서버가 "골랐다"를 알린다
    props.npc("present");
    props.say(lines.mine(relation), true);
    try {
      const r = await api.pairReading(pair.code, {
        product,
        relation,
        requestId: newRequestId(),
      });
      if (alive.current) show(r, !r.reused);
    } catch (e) {
      mine.current = false;
      if (!alive.current) return;
      // 상대가 먼저 골라 만드는 중: 결과 알림을 기다린다
      if (e instanceof ApiFailure && e.code === "RATE_LIMITED" && e.message.includes("두 분")) {
        props.say(e.message, true);
        return;
      }
      setBusy(false);
      props.onFail(e, {});
    }
  };

  if (rice)
    return (
      <div class="sh-block sh-gh">
        <RiceTray rice={rice} />
      </div>
    );
  return (
    <div class="sh-block sh-gh">
      <div class="sh-sj-chips">
        {GUNGHAP_RELATIONS.map((r) => (
          <button type="button" key={r} class="sh-sj-chip" disabled={busy} onClick={() => pick(r)}>
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

type DreamStage = "loading" | "write" | "checking" | "waiting" | "brewing";

export function DreamPairFlow(props: FlowProps & { pair: PairCtx }): JSX.Element {
  const { pair } = props;
  const [stage, setStage] = useState<DreamStage>("loading");
  const [text, setText] = useState("");
  const [symbols, setSymbols] = useState<{ id: string; name: string }[]>([]);
  const [partnerDone, setPartnerDone] = useState(false);
  const alive = useRef(true);
  const lastSeq = useRef(pair.event?.seq ?? 0);
  const partner = pair.partnerName ?? "같이 온 아가";

  const fetchResult = (fresh = false) =>
    api.pairResult(pair.code, "dream_pair").then(
      (r) => alive.current && props.onResult(fresh ? { ...r, reused: false } : r),
      (e) => {
        if (!alive.current) return;
        if (e instanceof ApiFailure && e.code === "NOT_FOUND") {
          setStage((s) => (s === "loading" ? "write" : s));
          props.npc("talk");
          props.say(
            "둘이 같이 왔구먼. 각자 간밤에 꾼 꿈을 할매한테 들려줘. 둘 꿈을 이어서 풀어 줄게.",
          );
          return;
        }
        props.onFail(e, {});
      },
    );

  // biome-ignore lint/correctness/useExhaustiveDependencies: 처음 한 번만
  useEffect(() => {
    props.npc("greet");
    props.say("아이고, 둘이 나란히 앉으니 보기 좋구먼.", true);
    void fetchResult();
    return () => {
      alive.current = false;
    };
  }, []);

  const brew = () => {
    setStage("brewing");
    sfx("pour");
    props.npc("talk");
    props.say("두 꿈을 찻잔에 같이 우려 보자… 할매가 보고 있어.", true);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: 새 소식이 올 때만
  useEffect(() => {
    const ev = pair.event;
    if (!ev || ev.seq === lastSeq.current) return;
    lastSeq.current = ev.seq;
    const m = ev.msg;
    if ("product" in m && m.product && m.product !== "dream_pair") return;
    if (m.t === "submitted" && m.id !== pair.myId) {
      setPartnerDone(true);
      // 내가 먼저 냈으면 상대 요청이 풀이를 만든다
      if (stage === "waiting") brew();
      else if (stage === "write")
        props.say(`${partner}${josaGa(partner)} 벌써 꿈을 들려줬어. 아가도 들려줘.`);
    } else if (m.t === "result_ready") {
      void fetchResult(true);
    } else if (m.t === "result_failed") {
      setStage("waiting");
      props.say(m.message);
    }
  }, [pair.event]);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setStage("checking");
    props.say("어디 보자… 할매가 듣고 있어.", true);
    try {
      const res = await api.pairDream(pair.code, t);
      if (!alive.current) return;
      switch (res.kind) {
        case "blocked":
          props.onCallsLeft?.(res.todayCallsLeft);
          if (res.reason === "CRISIS") {
            props.onCrisis();
            return;
          }
          setStage("write");
          props.say(res.message);
          return;
        case "waiting":
          props.onCallsLeft?.(res.todayCallsLeft);
          setSymbols(res.symbols);
          setStage("waiting");
          props.npc("idle");
          props.say(`아가 꿈은 잘 들었어. 이제 ${partner} 꿈도 들어 보자. 조금만 기다려.`);
          return;
        case "making":
          setSymbols(res.symbols);
          brew();
          return;
        case "result":
          props.onResult(res.result);
          return;
      }
    } catch (e) {
      if (!alive.current) return;
      setStage(symbols.length ? "waiting" : "write");
      props.onFail(e, {});
    }
  };

  if (stage === "loading") return <div class="sh-block" />;
  if (stage === "waiting" || stage === "brewing") {
    return (
      <div class="sh-block sh-brew">
        {symbols.length > 0 && (
          <div class="sh-brew-syms">
            <span class="sh-brew-label">내 꿈에서 찾은 것</span>
            <DreamSymbols symbols={symbols} />
          </div>
        )}
        <p class="sh-gh-note">
          {stage === "brewing"
            ? "두 꿈을 이어서 푸는 중…"
            : partnerDone
              ? "풀이를 다시 부탁해 볼까요?"
              : `${partner} 님 꿈을 기다리는 중…`}
        </p>
        {stage === "waiting" && partnerDone && (
          <button type="button" class="sh-primary" onClick={submit}>
            다시 풀어 달라고 하기
          </button>
        )}
      </div>
    );
  }
  const n = Array.from(text).length;
  return (
    <div class="sh-block sh-write">
      {partnerDone && <p class="sh-gh-note">{partner} 님은 꿈을 들려줬어요</p>}
      <label class="sh-paper">
        <textarea
          value={text}
          maxLength={DREAM_MAX}
          rows={4}
          placeholder="예) 맑은 냇가에서 커다란 물고기를 두 손으로 잡았어요"
          disabled={stage === "checking"}
          onInput={(e) => setText(Array.from(e.currentTarget.value).slice(0, DREAM_MAX).join(""))}
        />
        <span class={n >= DREAM_MAX ? "sh-counter sh-counter-full" : "sh-counter"}>
          {n} / {DREAM_MAX}
        </span>
      </label>
      <button
        type="button"
        class="sh-primary"
        onClick={submit}
        disabled={!text.trim() || stage === "checking"}
      >
        {stage === "checking" ? "할매가 듣는 중…" : "할매한테 들려주기"}
      </button>
    </div>
  );
}
