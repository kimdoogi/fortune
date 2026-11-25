/** 같이 보기 상대 외모 (F16). 토큰의 "성별:나이대" → 캐릭터 외모 */
import type { AgeBand, Gender } from "../../../scene/chibi";

export interface Partner {
  id: string;
  nickname: string;
  look: { gender: Gender; ageBand: AgeBand };
}

const AGES: AgeBand[] = ["10대", "20대", "30대", "40대 이상"];

/** 모르면 20대 여성 */
export function parseLook(avatar: string): Partner["look"] {
  const [g, a] = avatar.split(":");
  return {
    gender: g === "male" ? "male" : "female",
    ageBand: AGES.find((x) => x === a) ?? "20대",
  };
}
