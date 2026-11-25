/**
 * 점집별 외관 소품 (08 §1 점집별 외관). 전부 정적이라 거리 배경과 함께 합친다.
 */
import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import { at, beam, colored, gradient } from "./geo";
import type { GlowSpot } from "./glow";
import { WOOD } from "./hanok";

export interface Props {
  parts: THREE.BufferGeometry[];
  lit: THREE.BufferGeometry[];
  glows: GlowSpot[];
  /** 길찾기에서 막을 원 (x, z, 반지름) */
  blockers: [number, number, number][];
}

function jar(h: number, color: string, lid: string): THREE.BufferGeometry[] {
  const profile = [
    [0, 0],
    [0.16, 0],
    [0.24, 0.1],
    [0.29, 0.25],
    [0.27, 0.38],
    [0.2, 0.47],
    [0.15, 0.5],
    [0.16, 0.54],
    [0, 0.54],
  ].map(([r, y]) => new THREE.Vector2((r as number) * h, (y as number) * h));
  const body = gradient(
    new THREE.LatheGeometry(profile, 12),
    new THREE.Color(color).multiplyScalar(0.7),
    color,
  );
  const cap = colored(
    at(new THREE.CylinderGeometry(0.12 * h, 0.17 * h, 0.08 * h, 12), 0, 0.57 * h, 0),
    lid,
  );
  return [body, cap];
}

function place(geos: THREE.BufferGeometry[], x: number, y: number, z: number, ry = 0) {
  return geos.map((g) => at(g, x, y, z, ry));
}

/** 처마 앞을 가로지르는 늘어진 줄 */
function rope(x0: number, x1: number, y: number, z: number, sag: number, color: string) {
  const out: THREE.BufferGeometry[] = [];
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y - sag * 4 * t * (1 - t), z));
  }
  for (let i = 0; i < pts.length - 1; i++)
    out.push(
      colored(beam(pts[i] as THREE.Vector3, pts[i + 1] as THREE.Vector3, 0.04, 0.04), color),
    );
  return {
    out,
    at: (t: number) => new THREE.Vector3(x0 + (x1 - x0) * t, y - sag * 4 * t * (1 - t), z),
  };
}

export function buildProps(shop: ShopId, bz: number): Props {
  const parts: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const glows: GlowSpot[] = [];
  const blockers: [number, number, number][] = [];
  const zf = bz + 1.5; // 앞벽
  const yard = bz + 3.4; // 마당 (계단 양옆)

  if (shop === "saju") {
    // 주련: 가운데 기둥 두 개에 세로 판
    for (const x of [-1.0, 1.0]) {
      parts.push(colored(at(new THREE.BoxGeometry(0.22, 1.3, 0.03), x, 1.6, zf + 0.18), "#3a2416"));
      parts.push(colored(at(new THREE.BoxGeometry(0.13, 1.18, 0.01), x, 1.6, zf + 0.2), "#d9c08a"));
    }
    // 장독대
    const jx = -4.6;
    const jz = yard + 0.2;
    parts.push(
      gradient(at(new THREE.BoxGeometry(2.3, 0.22, 1.3), jx, 0.11, jz), "#5e5850", "#9a9386"),
    );
    const jars: [number, number, number][] = [
      [-0.7, -0.25, 0.95],
      [0.05, -0.3, 1.15],
      [0.75, -0.2, 0.9],
      [-0.35, 0.33, 0.7],
      [0.45, 0.35, 0.75],
    ];
    for (const [dx, dz, h] of jars)
      parts.push(...place(jar(h, "#6a3b25", "#4a2a1b"), jx + dx, 0.22, jz + dz));
    blockers.push([jx, jz, 1.3]);
  }

  if (shop === "tarot") {
    // 문 위 보라 휘장
    parts.push(colored(at(new THREE.BoxGeometry(2.0, 0.32, 0.05), 0, 2.33, zf + 0.09), "#5b2f8f"));
    for (let i = 0; i < 6; i++) {
      parts.push(
        colored(
          at(new THREE.ConeGeometry(0.09, 0.16, 4), -0.83 + i * 0.33, 2.11, zf + 0.09),
          "#f2d38a",
        ),
      );
    }
    // 수정구 받침대
    const cx = -2.9;
    const cz = yard;
    parts.push(
      gradient(
        at(new THREE.CylinderGeometry(0.16, 0.26, 0.85, 8), cx, 0.425, cz),
        "#2e2547",
        "#5a4a86",
      ),
    );
    parts.push(
      colored(at(new THREE.CylinderGeometry(0.3, 0.26, 0.08, 8), cx, 0.89, cz), "#f2d38a"),
    );
    lit.push(colored(at(new THREE.SphereGeometry(0.26, 18, 12), cx, 1.16, cz), "#b9dcff"));
    glows.push({ x: cx, y: 1.16, z: cz, size: 2.8, color: "#7fb8ff", flicker: 0.12 });
    blockers.push([cx, cz, 0.4]);
    // 처마에 매단 별
    for (let i = 0; i < 7; i++) {
      const x = -3.3 + i * 1.1;
      if (Math.abs(x) < 0.6) continue;
      const y = 2.15 + (i % 2) * 0.22;
      const z = bz + 2.3;
      lit.push(colored(at(new THREE.OctahedronGeometry(0.1, 0), x, y, z), "#ffe08a"));
      parts.push(
        colored(
          at(new THREE.CylinderGeometry(0.006, 0.006, 2.95 - y, 3), x, (2.95 + y) / 2, z),
          "#2b1b12",
        ),
      );
      glows.push({ x, y, z, size: 0.9, color: "#ffd37a", flicker: 0.2 });
    }
  }

  if (shop === "dolyeong") {
    // 오방기 다섯 깃발 (빨강 노랑 파랑 하양 초록)
    const flags = ["#d9413a", "#f2c230", "#3c6fd6", "#f4f1ea", "#3f9a55"];
    flags.forEach((color, i) => {
      const x = 2.7 + i * 0.42;
      const z = yard + (i % 2) * 0.25;
      const tilt = (i - 2) * 0.05;
      const pole = new THREE.CylinderGeometry(0.025, 0.03, 2.1, 6);
      pole.rotateZ(tilt);
      parts.push(colored(at(pole, x, 1.05, z), WOOD));
      const flag = new THREE.BoxGeometry(0.5, 0.38, 0.015, 4, 1, 1);
      // 바람에 살짝 휜 깃발
      const p = flag.getAttribute("position");
      for (let k = 0; k < p.count; k++)
        p.setZ(k, p.getZ(k) + Math.sin((p.getX(k) + 0.25) * 5) * 0.05);
      flag.computeVertexNormals();
      parts.push(colored(at(flag, x + 0.27, 1.85 + tilt, z), color));
    });
    blockers.push([3.55, yard + 0.1, 1.1]);
    // 금줄: 흰 종이와 붉은 고추
    const r = rope(-3.3, 3.3, 2.62, bz + 2.3, 0.18, "#c9a45c");
    parts.push(...r.out);
    for (let i = 1; i < 16; i++) {
      const p = r.at(i / 16);
      if (i % 2 === 0)
        parts.push(
          colored(at(new THREE.BoxGeometry(0.07, 0.2, 0.01), p.x, p.y - 0.12, p.z), "#f4f1ea"),
        );
      else {
        const pepper = new THREE.ConeGeometry(0.035, 0.16, 6);
        pepper.rotateX(Math.PI);
        parts.push(colored(at(pepper, p.x, p.y - 0.1, p.z), "#c8322a"));
      }
    }
  }

  if (shop === "dream") {
    // 달 초롱
    for (const x of [-3.4, -1.6, 1.6, 3.4]) {
      const y = Math.abs(x) > 2 ? 2.2 : 2.45;
      const z = bz + 2.35;
      lit.push(colored(at(new THREE.SphereGeometry(0.19, 14, 10), x, y, z), "#fff0b8"));
      parts.push(
        colored(
          at(new THREE.CylinderGeometry(0.006, 0.006, 3.0 - y, 3), x, (3.0 + y) / 2, z),
          "#2b1b12",
        ),
      );
      glows.push({ x, y, z, size: 2.0, color: "#ffe9a8", flicker: 0.06 });
    }
    // 달항아리
    const mx = -3.4;
    const mz = yard;
    parts.push(
      gradient(at(new THREE.CylinderGeometry(0.42, 0.46, 0.22, 10), mx, 0.11, mz), "#4b3424", WOOD),
    );
    parts.push(...place(jar(1.25, "#f1ece0", "#e4dccb"), mx, 0.22, mz));
    blockers.push([mx, mz, 0.6]);
    // 구름 모양 돌
    for (const [x, s] of [
      [3.3, 0.5],
      [3.9, 0.38],
      [3.6, 0.3],
    ] as const) {
      parts.push(
        colored(at(new THREE.IcosahedronGeometry(s, 1), x, s * 0.6, yard + (x - 3.6)), "#c9d3e0"),
      );
    }
    blockers.push([3.6, yard, 0.8]);
  }

  return { parts, lit, glows, blockers };
}
