/**
 * 거리 바닥과 길 (08 §1 점집별 외관, D-075).
 * 풀 얼룩·길·마당·등불 빛 웅덩이를 바닥 버텍스 컬러로 굽는다 (D-065). 길 모양은 점집마다 다르다:
 * 사주집 디딤돌, 아기도령 흙길, 타로집 자갈 돌길, 꿈해몽 물 위 디딤돌.
 */
import * as THREE from "three";
import { at, colored, gradient, hash, noise } from "./geo";
import { addWater } from "./street-fx";
import type { Kit } from "./street-kit";

export type PathKind = "steps" | "dirt" | "cobble" | "pond";

export interface GroundStyle {
  grass: [string, string];
  path: string;
  /** 길 반폭 (m) */
  pathHalf: number;
  yard: string;
  /** 마당 반폭 (m) */
  yardHalf: number;
  /** 연못 (꿈해몽): 가운데와 반지름 */
  pond?: { cx: number; cz: number; rx: number; rz: number };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 연못 안쪽 정도: 0보다 크면 물 (가장자리가 살짝 구불) */
export function pondInside(p: NonNullable<GroundStyle["pond"]>, x: number, z: number) {
  const nx = Math.abs(x - p.cx) / p.rx;
  const nz = Math.abs(z - p.cz) / p.rz;
  const r = (nx ** 2.2 + nz ** 2.2) ** (1 / 2.2);
  return 1 - r + (noise(x * 0.6 + 11, z * 0.6) - 0.5) * 0.18;
}

/** 물 아래 바닥 깊이 */
const POND_DEPTH = 0.32;

export function buildGround(kit: Kit, style: GroundStyle): THREE.Mesh {
  const { bz } = kit;
  const geo = kit.track(new THREE.PlaneGeometry(56, 56, 112, 112));
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  const g1 = new THREE.Color(style.grass[0]);
  const g2 = new THREE.Color(style.grass[1]);
  const dirt = new THREE.Color(style.path);
  const yardC = new THREE.Color(style.yard);
  const deep = new THREE.Color("#3c4890");
  const shoreC = new THREE.Color("#8b8fae");
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = noise(x * 0.3, z * 0.3) * 0.7 + noise(x * 1.3 + 7, z * 1.3) * 0.3;
    c.lerpColors(g1, g2, n);
    // 길 (가장자리가 살짝 구불)
    const pathHalf = style.pathHalf + (noise(z * 0.8, 3) - 0.5) * 0.35;
    c.lerp(dirt, clamp01((pathHalf - Math.abs(x)) / 0.35) * (z > bz + 2 ? 1 : 0));
    // 집 앞 마당
    const yardW =
      clamp01((style.yardHalf - Math.abs(x)) / 0.6) *
      clamp01((z - (bz + 1.8)) / 0.3) *
      clamp01((bz + 4.6 - z) / 0.8);
    c.lerp(yardC, yardW);
    // 연못: 물가는 자갈색, 안쪽은 깊게 파인다
    if (style.pond) {
      const w = pondInside(style.pond, x, z);
      if (w > -0.08) c.lerp(shoreC, clamp01((w + 0.08) / 0.08) * 0.7);
      if (w > 0) {
        pos.setY(i, -POND_DEPTH * clamp01(w / 0.12));
        c.lerp(deep, clamp01(w / 0.12));
      }
    }
    // 빛 웅덩이
    for (const p of kit.pools) {
      const d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
      const w = Math.exp(-d2 / (2 * p.r * p.r)) * p.k;
      c.r += p.color.r * w * 0.55;
      c.g += p.color.g * w * 0.45;
      c.b += p.color.b * w * 0.3;
    }
    // 담장 밖은 어둡게
    const out = Math.max(0, Math.abs(x) - 9) + Math.max(0, z - 9) + Math.max(0, -14 - z);
    c.multiplyScalar(Math.max(0.45, 1 - out * 0.08));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  if (style.pond) geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    kit.track(new THREE.MeshLambertMaterial({ vertexColors: true })),
  );
  kit.group.add(ground);
  return ground;
}

/** 디딤돌 (사주집): 길 위에 납작한 돌을 엇갈려 깐다 */
function steppingStones(kit: Kit) {
  const { bz, rand } = kit;
  for (let z = 7.6; z > bz + 3; z -= 0.62) {
    const row = Math.round(z / 0.62);
    const offset = row % 2 === 0 ? 0 : 0.3;
    for (let k = -1; k <= 1; k++) {
      const x = k * 0.6 + offset + (rand() - 0.5) * 0.14;
      if (Math.abs(x) > 1.35) continue;
      const r = 0.24 + rand() * 0.06;
      const stone = new THREE.CylinderGeometry(r, r * 1.05, 0.07, 7);
      stone.scale(1 + rand() * 0.25, 1, 0.85 + rand() * 0.2);
      const tone = 0.7 + hash(x, z) * 0.25;
      kit.parts.push(
        colored(
          at(stone, x, 0.035, z + (rand() - 0.5) * 0.1, rand() * Math.PI),
          new THREE.Color("#a89a80").multiplyScalar(tone),
        ),
      );
    }
  }
}

/** 흙길 (아기도령): 바퀴 자국 같은 어두운 줄과 드문드문 박힌 돌 */
function dirtPath(kit: Kit) {
  const { bz, rand } = kit;
  for (let z = 6.6; z > bz + 3; z -= 0.9 + rand() * 0.8) {
    const x = (rand() - 0.5) * 2.6;
    const r = 0.09 + rand() * 0.11;
    const stone = new THREE.IcosahedronGeometry(r, 0);
    stone.scale(1.3, 0.35, 1);
    kit.parts.push(
      colored(
        at(stone, x, 0.02, z, rand() * 3),
        new THREE.Color("#6d655e").multiplyScalar(0.7 + rand() * 0.4),
      ),
    );
  }
}

/** 자갈 돌길 (타로집): 둥근 돌을 촘촘히 깐다 (InstancedMesh) */
function cobbles(kit: Kit) {
  const { bz, rand, track } = kit;
  const spots: [number, number, number][] = [];
  for (let z = 7.8; z > bz + 2.9; z -= 0.27) {
    const row = Math.round(z / 0.27);
    const off = row % 2 === 0 ? 0 : 0.14;
    for (let x = -1.45 + off; x < 1.45; x += 0.29) {
      spots.push([x + (rand() - 0.5) * 0.05, z + (rand() - 0.5) * 0.05, rand()]);
    }
  }
  const stone = new THREE.IcosahedronGeometry(0.14, 0);
  stone.scale(1, 0.32, 1);
  const mesh = new THREE.InstancedMesh(
    track(stone),
    track(new THREE.MeshLambertMaterial()),
    spots.length,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  const tones = ["#8a8492", "#9d97a3", "#76707e", "#a39890", "#857a74"].map(
    (t) => new THREE.Color(t),
  );
  spots.forEach(([x, z, r], i) => {
    q.setFromEuler(e.set((r - 0.5) * 0.12, r * 3, (hash(x, z) - 0.5) * 0.12));
    const edge = Math.abs(x) > 1.2 ? 0.8 : 1;
    mesh.setMatrixAt(
      i,
      m.compose(p.set(x, 0.03, z), q, s.set(0.9 + r * 0.3, 1, 0.8 + hash(z, x) * 0.35)),
    );
    mesh.setColorAt(
      i,
      c
        .copy(tones[Math.floor(r * tones.length) % tones.length] as THREE.Color)
        .multiplyScalar(edge),
    );
  });
  kit.group.add(mesh);
}

/** 물 위 디딤돌 (꿈해몽): 연못을 건너는 둥근 돌, 연잎, 떠 있는 연꽃 등 */
function pondPath(kit: Kit, style: GroundStyle) {
  const { bz, parts, lit, glows, nav } = kit;
  const pond = style.pond;
  if (!pond) return;
  addWater(kit, { deep: "#7584cc", light: "#dcd6f6", glint: "#fff6e0", moonX: 4.5, y: -0.05 });
  // 뭍의 길: 연한 판석
  for (let z = 7.6; z > bz + 3; z -= 0.7) {
    const inWater = pondInside(pond, 0, z) > -0.1;
    if (inWater) continue;
    const slab = new THREE.BoxGeometry(1.1 + hash(z, 1) * 0.2, 0.06, 0.5);
    parts.push(
      colored(
        at(slab, (hash(z, 2) - 0.5) * 0.15, 0.03, z, (hash(z, 3) - 0.5) * 0.15),
        new THREE.Color("#d8d3e4").multiplyScalar(0.85 + hash(z, 4) * 0.15),
      ),
    );
  }
  // 물 위 디딤돌: 둥글고 두툼하게, 좌우로 살짝 엇갈린다
  let k = 0;
  for (let z = pond.cz + pond.rz + 0.2; z > pond.cz - pond.rz - 0.3; z -= 0.6, k++) {
    if (pondInside(pond, 0, z) < -0.12) continue;
    const x = (k % 2 === 0 ? -0.18 : 0.18) + (hash(z, 5) - 0.5) * 0.08;
    const r = 0.36 + hash(z, 6) * 0.06;
    const stone = new THREE.CylinderGeometry(r, r * 1.15, 0.42, 12);
    stone.scale(1.15, 1, 0.9);
    parts.push(gradient(at(stone, x, -0.14, z, hash(z, 7) * 3), "#5a5872", "#d6d3e2"));
  }
  // 물은 디딤돌 줄만 빼고 막는다
  for (let r = 0; r < nav.rows; r++) {
    for (let c = 0; c < nav.cols; c++) {
      const w = nav.toWorld(c, r);
      if (Math.abs(w.x) < 0.75) continue;
      if (pondInside(pond, w.x, w.z) > -0.04) nav.blockRect(w.x, w.z, w.x, w.z);
    }
  }
  // 연잎
  const pads: [number, number, number][] = [
    [-2.4, 1.6, 0.42],
    [-3.1, 1.1, 0.3],
    [2.8, -2.6, 0.45],
    [3.5, -1.9, 0.3],
    [-4.6, -2.2, 0.4],
    [5.2, 0.6, 0.38],
    [-1.4, -3.3, 0.3],
    [1.5, 1.9, 0.34],
  ];
  for (const [x, z, r] of pads) {
    if (pondInside(pond, x, z) < 0.05) continue;
    const pad = new THREE.CylinderGeometry(r, r, 0.02, 12, 1, false, 0.3, Math.PI * 2 - 0.5);
    parts.push(colored(at(pad, x, -0.025, z, hash(x, z) * 6), "#4f8f76"));
  }
  // 떠 있는 연꽃 등
  const lotus: [number, number][] = [
    [-2.0, -0.6],
    [2.3, 0.8],
    [-4.2, 0.3],
    [4.4, -1.4],
    [1.2, -3.0],
  ];
  for (const [x, z] of lotus) {
    if (pondInside(pond, x, z) < 0.05) continue;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = new THREE.ConeGeometry(0.09, 0.26, 4);
      petal.rotateZ(-0.6);
      petal.rotateY(-a);
      parts.push(colored(at(petal, x + Math.cos(a) * 0.1, 0.06, z + Math.sin(a) * 0.1), "#f4b6cf"));
    }
    lit.push(colored(at(new THREE.SphereGeometry(0.1, 10, 8), x, 0.1, z), "#ffe3a8"));
    glows.push({ x, y: 0.15, z, size: 1.6, color: "#ffd59a", flicker: 0.12 });
    kit.pools.push({ x, z, r: 0.9, k: 0.4, color: new THREE.Color("#ffd8a0") });
  }
}

export function buildPath(kit: Kit, kind: PathKind, style: GroundStyle) {
  if (kind === "steps") steppingStones(kit);
  else if (kind === "dirt") dirtPath(kit);
  else if (kind === "cobble") cobbles(kit);
  else pondPath(kit, style);
}
