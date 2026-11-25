import { parseAvatar } from "../../../scene/avatar-parts";
/** 같이 보기 상대 외모 (F16). 토큰의 "성별:나이대[:꾸미기 코드]" → 캐릭터 외모 (F17) */
import type { ChibiLook } from "../../../scene/chibi";

export interface Partner {
  id: string;
  nickname: string;
  look: ChibiLook;
}

/** 모르면 20대 여성, 모르는 꾸미기 코드면 기본 모습 */
export function parseLook(avatar: string): Partner["look"] {
  return parseAvatar(avatar);
}
