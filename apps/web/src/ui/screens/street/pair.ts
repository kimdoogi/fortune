/**
 * 궁합 둘만의 방 (F16, D-089) 연결 훅. StreetScreen이 pair 모드일 때만 쓴다.
 * - 방 접속 → 상대 캐릭터를 Stage에 세우고, 상대 목적지를 받아 걷게 한다
 * - 내 목적지를 방에 보낸다 (06 §5: 목적지만 보내고 각자 경로 재생)
 * - 둘 다 문 앞인지 0.3초마다 본다 → "같이 들어가기"
 * - 같이 들어가기·관계 고르기·결과 알림을 점집 화면에 넘긴다
 */
import type { ServerMessage } from "@fortune/shared-types";
import { useEffect, useRef, useState } from "preact/hooks";
import { PairRoom, type RoomStatus } from "../../../net/pairRoom";
import type { AgeBand, Gender } from "../../../scene/chibi";
import type { Stage } from "../../../scene/stage";

/** useRef가 돌려주는 상자 */
type Box<T> = { current: T };

export interface Partner {
  id: string;
  nickname: string;
  look: { gender: Gender; ageBand: AgeBand };
}

const AGES: AgeBand[] = ["10대", "20대", "30대", "40대 이상"];

/** 토큰의 "성별:나이대" → 외모. 모르면 20대 여성 */
export function parseLook(avatar: string): Partner["look"] {
  const [g, a] = avatar.split(":");
  return {
    gender: g === "male" ? "male" : "female",
    ageBand: AGES.find((x) => x === a) ?? "20대",
  };
}

export function usePairRoom(opts: {
  code: string | undefined;
  stage: Box<Stage | null>;
  ready: boolean;
  /** 내 목적지를 보낼 곳 (Stage onWalk가 부른다) */
  walkRef: Box<((x: number, z: number) => void) | null>;
  onGoInside: () => void;
}) {
  const { code, stage, ready } = opts;
  const room = useRef<PairRoom | null>(null);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerLeft, setPartnerLeft] = useState<string | null>(null);
  const [meNear, setMeNear] = useState(false);
  const [partnerNear, setPartnerNear] = useState(false);
  const [event, setEvent] = useState<{ seq: number; msg: ServerMessage } | null>(null);
  const [myId, setMyId] = useState("");
  const seq = useRef(0);
  const goInside = useRef(opts.onGoInside);
  goInside.current = opts.onGoInside;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 방은 코드와 Stage 준비에만 따른다
  useEffect(() => {
    if (!code || !ready) return;
    const s = () => stage.current;
    const onMessage = (m: ServerMessage) => {
      switch (m.t) {
        case "snapshot": {
          setMyId(m.you);
          const other = m.players.find((p) => p.id !== m.you);
          if (other) {
            const p = { id: other.id, nickname: other.nickname, look: parseLook(other.avatar) };
            setPartner(p);
            setPartnerLeft(null);
            const at = other.x || other.z ? { x: other.x, z: other.z } : undefined;
            s()?.addRemote(p.id, p.look, p.nickname, at);
          }
          break;
        }
        case "joined": {
          const p = {
            id: m.player.id,
            nickname: m.player.nickname,
            look: parseLook(m.player.avatar),
          };
          setPartner(p);
          setPartnerLeft(null);
          s()?.addRemote(p.id, p.look, p.nickname);
          // 새로 온 사람에게 내 자리를 알린다
          const me = s()?.myPosition();
          if (me) room.current?.send({ t: "move", x: me.x, z: me.z });
          break;
        }
        case "left":
          s()?.removeRemote(m.id);
          setPartner((p) => {
            if (p?.id === m.id) setPartnerLeft(p.nickname);
            return p?.id === m.id ? null : p;
          });
          break;
        case "moved":
          s()?.moveRemote(m.id, m.x, m.z);
          break;
        case "went_inside":
          goInside.current();
          break;
        case "picked":
        case "result_ready":
        case "result_failed":
          seq.current += 1;
          setEvent({ seq: seq.current, msg: m });
          break;
      }
    };
    const r = new PairRoom(code, onMessage, (st) => {
      setStatus(st);
      if (st === "open") {
        const me = s()?.myPosition();
        if (me) r.send({ t: "move", x: me.x, z: me.z });
      }
    });
    room.current = r;
    opts.walkRef.current = (x, z) => r.send({ t: "move", x, z });
    return () => {
      opts.walkRef.current = null;
      r.close();
      room.current = null;
    };
  }, [code, ready]);

  // 점집 안에서 옆에 앉을 사람
  // biome-ignore lint/correctness/useExhaustiveDependencies: 상대가 바뀔 때만
  useEffect(() => {
    if (code) stage.current?.setPartner(partner?.look ?? null);
  }, [code, partner, ready]);

  // 둘 다 문 앞인가
  // biome-ignore lint/correctness/useExhaustiveDependencies: 상대가 바뀔 때만
  useEffect(() => {
    if (!code || !ready) return;
    const id = window.setInterval(() => {
      const st = stage.current;
      if (!st) return;
      setMeNear(st.meNearDoor());
      setPartnerNear(partner ? st.remoteNearDoor(partner.id) : false);
    }, 300);
    return () => clearInterval(id);
  }, [code, ready, partner]);

  return {
    status,
    partner,
    partnerLeft,
    meNear,
    partnerNear,
    event,
    myId,
    send: (m: Parameters<PairRoom["send"]>[0]) => room.current?.send(m),
  };
}
