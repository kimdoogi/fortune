import type { ShopId } from "@fortune/shared-types";
import { describe, expect, it } from "vitest";
import { Npc, type NpcAction, ONE_SHOT } from "./npc";

const SHOPS: ShopId[] = ["saju", "tarot", "dolyeong", "dream"];
const ACTIONS: NpcAction[] = ["idle", "greet", "talk", "present", "celebrate"];

describe("점술가 NPC (07 §3 한도)", () => {
  for (const shop of SHOPS) {
    it(`${shop}: 5,000 삼각형 이하, 메시 16개 이하`, () => {
      const npc = new Npc(shop);
      expect(npc.triangles()).toBeLessThanOrEqual(5000);
      expect(npc.meshes()).toBeLessThanOrEqual(16);
      npc.dispose();
    });

    it(`${shop}: 모든 동작이 숫자 깨짐 없이 돈다`, () => {
      const npc = new Npc(shop);
      for (const a of ACTIONS) {
        npc.play(a);
        for (let i = 0; i < 90; i++) npc.update(1 / 30);
        npc.root.updateMatrixWorld(true);
        npc.root.traverse((o) => {
          for (const v of [o.position.x, o.position.y, o.rotation.x, o.rotation.z, o.scale.y])
            expect(Number.isFinite(v)).toBe(true);
        });
      }
      npc.dispose();
    });
  }

  it("한 번짜리 동작이 끝나면 이어지던 동작으로 돌아간다", () => {
    const npc = new Npc("tarot");
    npc.play("talk");
    npc.play("greet");
    const dur = ONE_SHOT.greet ?? 0;
    for (let t = 0; t < dur + 0.1; t += 1 / 30) npc.update(1 / 30);
    expect(npc.current).toBe("talk");
    npc.play("present");
    for (let i = 0; i < 300; i++) npc.update(1 / 30);
    expect(npc.current).toBe("present");
    npc.dispose();
  });
});
