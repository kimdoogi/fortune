import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { type BakeEnv, lighter, softClamp } from "./bake";

const env: BakeEnv = {
  sky: "#404040",
  ground: "#202020",
  lights: [{ x: 0, y: 1, z: 0, color: "#ffffff", intensity: 1, range: 1 }],
  room: { minX: -2, maxX: 2, minZ: -2, maxZ: 2, height: 2.5 },
  ao: 0.4,
  shadows: [{ x: 1, z: 1, rx: 0.3, rz: 0.3, k: 0.5 }],
};

describe("조명 굽기", () => {
  it("밝은 값은 1을 넘지 않고 순서를 지킨다", () => {
    let prev = 0;
    for (let v = 0; v <= 4; v += 0.1) {
      const c = softClamp(v);
      expect(c).toBeLessThanOrEqual(1);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });

  it("등불에서 멀수록, 모서리·그림자 밑일수록 어둡다", () => {
    const light = lighter(env);
    const up = new THREE.Vector3(0, 1, 0);
    const lum = (x: number, z: number) => {
      const c = light(new THREE.Vector3(x, 0, z), up, new THREE.Color());
      return c.r + c.g + c.b;
    };
    expect(lum(0, 0)).toBeGreaterThan(lum(0.8, -0.8));
    expect(lum(-1.0, -0.5)).toBeGreaterThan(lum(-1.95, -0.5));
    expect(lum(-1, 1)).toBeGreaterThan(lum(1, 1));
  });
});
