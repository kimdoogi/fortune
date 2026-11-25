/**
 * 3D 코드는 첫 화면(지도)에 넣지 않는다 (07 §2). 지도가 뜬 뒤 백그라운드로 받아 둔다 (F01).
 * 동적 import라서 Vite가 three.js를 따로 쪼갠다.
 */

let stageMod: Promise<typeof import("../../scene/stage")> | null = null;
let streetMod: Promise<typeof import("../screens/street/StreetScreen")> | null = null;

/** Stage 모듈. 실패하면 캐시를 지워서 "다시 시도"가 새로 받게 한다 (F01 예외) */
export function loadStage() {
  stageMod ??= import("../../scene/stage").catch((e) => {
    stageMod = null;
    throw e;
  });
  return stageMod;
}

export function loadStreet() {
  streetMod ??= import("../screens/street/StreetScreen").catch((e) => {
    streetMod = null;
    throw e;
  });
  return streetMod;
}

/** 지도에서 한가할 때 거리 코드 미리 받기 */
export function prefetch3d() {
  const run = () => {
    void loadStreet().catch(() => undefined);
    void loadStage().catch(() => undefined);
  };
  if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 1500 });
  else setTimeout(run, 400);
}

let webgl2: boolean | null = null;
/** 07 §1: WebGL2가 없으면 거리·점집에 들어가지 않는다 */
export function hasWebGL2(): boolean {
  if (webgl2 === null) {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2");
      webgl2 = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}
