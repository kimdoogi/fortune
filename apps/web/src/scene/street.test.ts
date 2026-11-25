import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildStreet } from "./street";

const SHOPS: ShopId[] = ["saju", "tarot", "dolyeong", "dream"];

/** 그릴 것 수(대략적인 드로우콜)와 삼각형 수. InstancedMesh는 인스턴스 수만큼 곱한다 */
function measure(root: THREE.Object3D) {
  let calls = 0;
  let tris = 0;
  root.traverseVisible((o) => {
    if (o instanceof THREE.Mesh) {
      if (!(o.material as THREE.Material).visible) return;
      calls++;
      const g = o.geometry as THREE.BufferGeometry;
      const t = (g.index ? g.index.count : g.getAttribute("position").count) / 3;
      tris += o instanceof THREE.InstancedMesh ? t * o.count : t;
    } else if (o instanceof THREE.Points) calls++;
  });
  return { calls, tris };
}

describe("점집 거리 (07 §3·§4: 드로우콜 100·삼각형 15만·생성 500ms 이하)", () => {
  for (const shop of SHOPS) {
    it(`${shop}: 한도 안에서 만들어지고 문까지 걸어갈 수 있다`, () => {
      const t0 = performance.now();
      const street = buildStreet(shop);
      const ms = performance.now() - t0;
      const m = measure(street.group);
      // 캐릭터·탭 표시 몫(드로우콜 20, 삼각형 3,000)을 남긴다
      expect(m.calls).toBeLessThanOrEqual(80);
      expect(m.tris).toBeLessThanOrEqual(147_000);
      expect(ms).toBeLessThan(2000); // 테스트 환경은 느려서 넉넉하게. 실제 측정은 scene-lab
      // 시작점에서 문 앞까지 길이 있다
      const path = street.nav.findPath(street.spawn, street.doorFront);
      const last = path[path.length - 1];
      expect(last).toBeDefined();
      expect(
        Math.hypot((last?.x ?? 99) - street.doorFront.x, (last?.z ?? 99) - street.doorFront.z),
      ).toBeLessThan(0.6);
      // 문 앞 칸은 막혀 있지 않다
      const [c, r] = street.nav.toCell(street.doorFront);
      expect(street.nav.walkable(c, r)).toBe(true);
      street.update(1.5);
      street.setViewportHeight(1624);
      street.dispose();
    });
  }
});

describe("문으로 걸어 들어가기 (D-094·D-095)", () => {
  for (const shop of SHOPS) {
    it(`${shop}: 길에서는 땅, 계단을 하나씩 밟고 올라 문 안에서는 기단 위`, () => {
      const street = buildStreet(shop);
      expect(street.groundAt(street.doorFront.z)).toBe(0);
      expect(street.groundAt(street.spawn.z)).toBe(0);
      const inside = street.groundAt(street.doorInside.z);
      expect(inside).toBeGreaterThan(0.25);
      // 문 앞에서 안쪽으로 갈수록 내려가지 않는다 (계단을 뚫고 지나가지 않게)
      let last = 0;
      for (let z = street.doorFront.z; z >= street.doorInside.z; z -= 0.02) {
        const y = street.groundAt(z);
        expect(y).toBeGreaterThanOrEqual(last);
        // 한 번에 오르는 높이는 한 단 (0.25m 이하)
        expect(y - last).toBeLessThanOrEqual(0.25);
        last = y;
      }
      street.dispose();
    });
  }
});
