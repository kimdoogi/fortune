/**
 * 궁합 (F16, D-089). 두 가지 흐름:
 * - InviteFlow: 사주집 메뉴에서 "궁합" → 동의 → 초대 링크 만들기·보내기 → 둘만의 거리로
 * - GunghapFlow: 둘이 같이 들어온 점집 안. 누구든 관계를 고르면 풀이를 만들고, 상대 화면에도 같은 결과가 뜬다
 */
import { GUNGHAP_RELATIONS, type GunghapRelation, type ServerMessage } from "@fortune/shared-types";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ApiFailure, api, newRequestId } from "../../api/client";
import { navigate } from "../app/router";
import type { FlowProps } from "./flows";

/** 동의 문구 (F16): 무엇이 서로에게 보이는지 */
export const GUNGHAP_CONSENT =
  "궁합을 보면 두 사람의 띠·타고난 기운과 풀이가 서로에게 보여요. 생년월일과 태어난 시간은 보이지 않아요.";

/** 점집 안에서 쓰는 둘만의 방 정보 (StreetScreen이 넘겨 준다) */
export interface PairCtx {
  code: string;
  myId: string;
  partnerName: string | null;
  send: (m: { t: "pick"; relation: string }) => void;
  /** 방에서 온 마지막 궁합 소식 (picked·result_ready·result_failed). seq로 새 소식을 가린다 */
  event: { seq: number; msg: ServerMessage } | null;
}

/** 링크 보내기: 휴대폰 공유 창, 안 되면 복사 */
export async function shareInvite(url: string, nickname: string): Promise<"shared" | "copied"> {
  const text = `${nickname} 님이 점집 거리에서 같이 궁합을 보자고 불렀어요!`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "점집 거리 궁합", text, url });
      return "shared";
    } catch {
      // 취소하면 복사로
    }
  }
  await navigator.clipboard?.writeText(url).catch(() => undefined);
  return "copied";
}

export function InviteFlow(props: FlowProps): JSX.Element {
  const [step, setStep] = useState<"consent" | "making" | "made">("consent");
  const [link, setLink] = useState<{ code: string; url: string } | null>(null);
  const [note, setNote] = useState("");
  const alive = useRef(true);
  const nick = props.profile.nickname;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 처음 한 번만
  useEffect(() => {
    props.npc("talk");
    props.say("궁합은 둘이 함께 와서 나란히 앉아야 보오. 같이 볼 분에게 링크를 보내시오.");
    return () => {
      alive.current = false;
    };
  }, []);

  const make = async () => {
    setStep("making");
    try {
      const r = await api.createInvite();
      if (!alive.current) return;
      // 지금 보고 있는 주소로 링크를 만든다 (서버가 아는 주소와 다를 수 있다)
      setLink({ code: r.code, url: `${location.origin}/?g=${r.code}` });
      setStep("made");
      props.npc("present");
      props.say("링크가 나왔소. 보내 놓고 골목에서 기다리면, 그분이 들어오는 게 보일 것이오.");
    } catch (e) {
      if (alive.current) props.onFail(e, {});
    }
  };

  const send = async () => {
    if (!link) return;
    const how = await shareInvite(link.url, nick);
    if (alive.current)
      setNote(how === "copied" ? "링크를 복사했어요. 메신저에 붙여 넣어 보내 주세요." : "");
  };

  if (step !== "made" || !link) {
    return (
      <div class="sh-block sh-gh">
        <p class="sh-gh-consent">{GUNGHAP_CONSENT}</p>
        <button type="button" class="sh-primary" disabled={step === "making"} onClick={make}>
          {step === "making" ? "링크 만드는 중…" : "동의하고 초대 링크 만들기"}
        </button>
      </div>
    );
  }
  return (
    <div class="sh-block sh-gh">
      <p class="sh-gh-link">{link.url}</p>
      <button type="button" class="sh-primary" onClick={send}>
        링크 보내기
      </button>
      <button
        type="button"
        class="sh-quiet"
        onClick={() => navigate({ name: "pair", code: link.code })}
      >
        골목에서 기다리기
      </button>
      {note && <p class="sh-gh-note">{note}</p>}
    </div>
  );
}

export function GunghapFlow(props: FlowProps & { pair: PairCtx }): JSX.Element {
  const { pair } = props;
  const [busy, setBusy] = useState(true);
  const mine = useRef(false);
  const alive = useRef(true);
  const lastSeq = useRef(0);
  const partner = pair.partnerName ?? "같이 온 분";
  const nick = props.profile.nickname;

  const fetchResult = () =>
    api.gunghapResult(pair.code).then(
      (r) => alive.current && props.onResult(r),
      (e) => {
        if (!alive.current) return;
        if (e instanceof ApiFailure && e.code === "NOT_FOUND") {
          setBusy(false);
          props.npc("talk");
          props.say(`${nick} 님, ${partner} 님. 두 분은 어떤 사이요? 골라 보시오.`);
          return;
        }
        props.onFail(e, {});
      },
    );

  // 다시 들어왔으면 저장된 결과부터 (초대 하나에 풀이 하나)
  // biome-ignore lint/correctness/useExhaustiveDependencies: 처음 한 번만
  useEffect(() => {
    props.npc("greet");
    props.say("어서 오시오, 두 분. 나란히 앉으니 보기 좋구려.", true);
    void fetchResult();
    return () => {
      alive.current = false;
    };
  }, []);

  // 방 소식: 상대가 골랐다, 결과가 나왔다, 실패했다
  // biome-ignore lint/correctness/useExhaustiveDependencies: 새 소식이 올 때만
  useEffect(() => {
    const ev = pair.event;
    if (!ev || ev.seq === lastSeq.current) return;
    lastSeq.current = ev.seq;
    const m = ev.msg;
    if (m.t === "picked" && m.id !== pair.myId) {
      setBusy(true);
      props.npc("talk");
      props.say(
        `${partner} 님이 "${m.relation}" 사이라 하는구려. 두 분의 사주를 맞춰 보겠소…`,
        true,
      );
    } else if (m.t === "result_ready" && !mine.current) {
      void fetchResult();
    } else if (m.t === "result_failed" && !mine.current) {
      setBusy(false);
      props.say(m.message);
    }
  }, [pair.event]);

  const pick = async (relation: GunghapRelation) => {
    if (busy) return;
    setBusy(true);
    mine.current = true;
    pair.send({ t: "pick", relation });
    props.npc("present");
    props.say(`${relation} 사이로구려. 두 분의 사주를 맞춰 보겠소…`, true);
    try {
      const r = await api.gunghap(pair.code, { relation, requestId: newRequestId() });
      if (alive.current) props.onResult(r);
    } catch (e) {
      mine.current = false;
      if (alive.current) {
        setBusy(false);
        props.onFail(e, {});
      }
    }
  };

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
