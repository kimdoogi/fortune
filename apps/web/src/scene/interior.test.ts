import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildInterior, cameraFor } from "./interior";

const SHOPS: ShopId[] = ["saju", "tarot", "dolyeong", "dream"];

/** 장면의 그릴 것 수(대략적인 드로우콜)와 삼각형 수 */
function measure(scene: THREE.Scene) {
  let calls = 0;
  let tris = 0;
  scene.traverseVisible((o) => {
    if (o instanceof THREE.Mesh) {
      calls++;
      const g = o.geometry as THREE.BufferGeometry;
      tris += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    } else if (o instanceof THREE.Points) calls++;
  });
  return { calls, tris };
}

describe("점집 내부 (07 §3: 드로우콜 60·삼각형 8만 이하)", () => {
  for (const shop of SHOPS) {
    it(`${shop}: 한도 안에서 만들어지고 해제된다`, () => {
      const room = buildInterior(shop, { gender: "female", ageBand: "20대" });
      room.resize(375, 812, 2);
      room.update(0.016, 1);
      const m = measure(room.scene);
      expect(m.calls).toBeLessThanOrEqual(60);
      expect(m.tris).toBeLessThanOrEqual(80_000);
      for (const a of ["greet", "talk", "present", "celebrate", "idle"] as const) {
        room.act(a);
        room.update(0.5, 2);
      }
      room.dispose();
    });
  }

  for (const shop of SHOPS) {
    it(`${shop}: 꾸민 두 사람이 나란히 앉아도 한도 안 (F17)`, () => {
      const room = buildInterior(
        shop,
        {
          gender: "male",
          ageBand: "30대",
          style: {
            species: "bear",
            hair: "pigtails",
            outfit: "chima",
            color: "navy",
            acc: "gat",
            hairColor: "blonde",
            tone: 2,
          },
        },
        {
          gender: "female",
          ageBand: "10대",
          style: {
            species: "rabbit",
            hair: "curly",
            outfit: "hoodie",
            color: "pink",
            acc: "beanie",
            hairColor: "pink",
            tone: 0,
          },
        },
      );
      room.resize(375, 812, 2);
      room.update(0.016, 1);
      const m = measure(room.scene);
      expect(m.calls).toBeLessThanOrEqual(60);
      expect(m.tris).toBeLessThanOrEqual(80_000);
      room.dispose();
    });
  }

  it("세로 화면은 가로보다 시야가 넓고 카메라가 높다", () => {
    const p = cameraFor(375 / 812);
    const l = cameraFor(812 / 375);
    expect(p.fov).toBeGreaterThan(l.fov);
    expect(p.pos.y).toBeGreaterThan(l.pos.y);
  });
});
