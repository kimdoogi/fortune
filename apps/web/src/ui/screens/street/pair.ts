/**
 * 같이 보기 골목 (F16, D-089·D-090). 연결은 pairSession이 들고 있고, 여기서는 Stage에 붙인다.
 * - 상대 캐릭터를 세우고, 상대 목적지를 받아 걷게 한다 (06 §5: 목적지만 보내고 각자 경로 재생)
 * - 내 목적지를 방에 보낸다
 * - 둘 다 문 앞인지 0.3초마다 본다 → "같이 들어가기"
 */
import { useEffect, useState } from "preact/hooks";
import {
  pairState,
  partnerPosition,
  sendPair,
  setMyPosition,
  subscribePair,
} from "../../../net/pairSession";
import type { Stage } from "../../../scene/stage";
import { parseLook } from "./look";

/** useRef가 돌려주는 상자 */
type Box<T> = { current: T };

export function usePairStage(opts: {
  active: boolean;
  stage: Box<Stage | null>;
  ready: boolean;
  /** 내 목적지를 보낼 곳 (Stage onWalk가 부른다) */
  walkRef: Box<((x: number, z: number) => void) | null>;
}) {
  const { active, stage, ready } = opts;
  const partner = active ? (pairState.value?.partner ?? null) : null;
  const [meNear, setMeNear] = useState(false);
  const [partnerNear, setPartnerNear] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Stage 준비에만 따른다
  useEffect(() => {
    if (!active || !ready) return;
    const s = () => stage.current;
    const p = pairState.peek()?.partner;
    if (p) s()?.addRemote(p.id, p.look, p.nickname, partnerPosition() ?? undefined);
    const off = subscribePair((m) => {
      switch (m.t) {
        case "snapshot": {
          const other = m.players.find((x) => x.id !== m.you);
          if (other) {
            const at = other.x || other.z ? { x: other.x, z: other.z } : undefined;
            s()?.addRemote(other.id, parseLook(other.avatar), other.nickname, at);
          }
          break;
        }
        case "joined":
          s()?.addRemote(m.player.id, parseLook(m.player.avatar), m.player.nickname);
          break;
        case "left":
          s()?.removeRemote(m.id);
          break;
        case "moved":
          s()?.moveRemote(m.id, m.x, m.z);
          break;
      }
    });
    setMyPosition(() => s()?.myPosition() ?? null);
    opts.walkRef.current = (x, z) => sendPair({ t: "move", x, z });
    // 이 골목에 왔다: 내 자리를 알린다
    const me = s()?.myPosition();
    if (me) sendPair({ t: "move", x: me.x, z: me.z });
    return () => {
      off();
      setMyPosition(null);
      opts.walkRef.current = null;
    };
  }, [active, ready]);

  // 점집 안에서 옆에 앉을 사람
  // biome-ignore lint/correctness/useExhaustiveDependencies: 상대가 바뀔 때만
  useEffect(() => {
    if (active) stage.current?.setPartner(partner?.look ?? null);
  }, [active, partner?.id, ready]);

  // 둘 다 문 앞인가
  // biome-ignore lint/correctness/useExhaustiveDependencies: 상대가 바뀔 때만
  useEffect(() => {
    if (!active || !ready) return;
    const id = window.setInterval(() => {
      const st = stage.current;
      if (!st) return;
      setMeNear(st.meNearDoor());
      setPartnerNear(partner ? st.remoteNearDoor(partner.id) : false);
    }, 300);
    return () => clearInterval(id);
  }, [active, ready, partner?.id]);

  return { meNear, partnerNear };
}
