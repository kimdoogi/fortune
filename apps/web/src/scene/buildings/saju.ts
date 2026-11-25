/**
 * 사주집: 먹색 기와 한옥 (08 §1 점집별 외관). 문 양옆 세로 주련, 마당에 장독대.
 */
import * as THREE from "three";
import { at, colored, gradient } from "../geo";
import { buildHanok } from "../hanok";
import { jar, place } from "./common";
import type { Building } from "./types";

export const SAJU_STYLE = {
  roof: "#3c4250",
  wall: "#f3e7cf",
  trim: "#6e4429",
  paper: "#ffcf86",
};

export function buildSaju(bz: number): Building {
  const hanok = buildHanok(SAJU_STYLE, bz);
  const parts = [...hanok.parts];
  const zf = bz + 1.5; // 앞벽
  const yard = bz + 3.4; // 마당 (계단 양옆)

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

  return {
    parts,
    lit: hanok.lit,
    glows: hanok.glows,
    sign: hanok.sign,
    door: hanok.door,
    frontEdge: hanok.frontEdge,
    blockRects: [[-3.7, bz - 2.4, 3.7, hanok.frontEdge - 0.1]],
    blockers: [[jx, jz, 1.3]],
    clearRects: [[-5.2, bz - 3, 5.2, bz + 4.6]],
    pools: [{ x: 0, z: bz + 3.2, r: 2.4, k: 0.5, color: SAJU_STYLE.paper }],
  };
}
