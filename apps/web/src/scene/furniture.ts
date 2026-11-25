/**
 * 점집 내부 가구·소품 도구 (08 §1 점집별 내부). 정적 조각은 모아서 조명을 구운 뒤 한 덩어리로 합친다 (07 §4).
 * 좌표: 바닥 y=0, 점술가는 -z 쪽에 앉아 +z(플레이어·카메라)를 본다.
 */
import * as THREE from "three";
import type { BakeLight, ContactShadow } from "./bake";
import { at, beam, colored, gradient } from "./geo";
import type { GlowSpot } from "./glow";
import type { NpcAction } from "./npc";

export interface Kit {
  /** 조명을 구울 정적 조각 */
  parts: THREE.BufferGeometry[];
  /** 스스로 빛나는 조각 (창호지 등, 촛불, 별) — 굽지 않는다 */
  lit: THREE.BufferGeometry[];
  /** 그림 텍스처를 입힐 조각 (uv 유지, 조명은 굽는다) */
  painted: THREE.BufferGeometry[];
  paintedMap: THREE.Texture | null;
  glows: GlowSpot[];
  /** 따로 그리는 빛무리 재질 (화면 크기를 맞춰 준다) */
  glowMaterials: THREE.ShaderMaterial[];
  lights: BakeLight[];
  shadows: ContactShadow[];
  /** 따로 움직이는 물체 (수정구, 김 등) */
  objects: THREE.Object3D[];
  updaters: ((dt: number, time: number) => void)[];
  /** 점술가 동작에 맞춘 방 안 연출 */
  onAction: ((a: NpcAction) => void)[];
  disposables: { dispose(): void }[];
}

export function newKit(): Kit {
  return {
    parts: [],
    lit: [],
    painted: [],
    paintedMap: null,
    glows: [],
    glowMaterials: [],
    lights: [],
    shadows: [],
    objects: [],
    updaters: [],
    onAction: [],
    disposables: [],
  };
}

export const C = {
  wood: "#6e4429",
  woodDark: "#4a2c1a",
  woodDeep: "#33200f",
  lacquer: "#5a2a1c",
  brass: "#d4a64a",
  paperLit: "#ffd9a0",
  flame: "#ffe7a6",
};

/** 상자 하나 (중심 x, 바닥 y, 중심 z) */
export function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: THREE.ColorRepresentation,
  ry = 0,
) {
  return colored(at(new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry), color);
}

/** 원기둥 (바닥 y 기준) */
export function cyl(
  rTop: number,
  rBottom: number,
  h: number,
  x: number,
  y: number,
  z: number,
  color: THREE.ColorRepresentation,
  seg = 12,
) {
  return colored(at(new THREE.CylinderGeometry(rTop, rBottom, h, seg), x, y + h / 2, z), color);
}

/** uv를 남기고 버텍스 컬러를 입힌다 (그림 조각용) */
export function tintKeepUv(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const c = new THREE.Color(color);
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

/** 평면의 uv를 그림 한 장의 일부 영역으로 옮긴다 */
export function remapUv(
  geo: THREE.BufferGeometry,
  r: { u0: number; v0: number; u1: number; v1: number },
) {
  const uv = geo.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + uv.getY(i) * (r.v1 - r.v0));
  }
  return geo;
}

/** 낮은 상 (교자상): 옻칠 상판 + 휜 다리 + 앞치마 */
export function lowTable(
  kit: Kit,
  o: { x: number; z: number; w: number; d: number; h: number; top?: string },
) {
  const top = o.top ?? C.lacquer;
  const t = 0.05;
  const rim = new THREE.Color(top).lerp(new THREE.Color("#c08a5a"), 0.25);
  kit.parts.push(box(o.w, t, o.d, o.x, o.h - t, o.z, top));
  kit.parts.push(box(o.w + 0.03, 0.018, o.d + 0.03, o.x, o.h - t - 0.012, o.z, rim));
  // 앞치마
  kit.parts.push(
    box(o.w - 0.12, 0.07, 0.03, o.x, o.h - t - 0.07, o.z + o.d / 2 - 0.06, C.woodDark),
  );
  kit.parts.push(
    box(o.w - 0.12, 0.07, 0.03, o.x, o.h - t - 0.07, o.z - o.d / 2 + 0.06, C.woodDark),
  );
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const lx = o.x + sx * (o.w / 2 - 0.08);
      const lz = o.z + sz * (o.d / 2 - 0.08);
      // 개다리: 위는 곧고 아래가 바깥으로 휜다
      kit.parts.push(
        colored(
          beam(
            new THREE.Vector3(lx, o.h - t, lz),
            new THREE.Vector3(lx + sx * 0.03, o.h * 0.45, lz + sz * 0.02),
            0.05,
            0.05,
          ),
          C.woodDark,
        ),
      );
      kit.parts.push(
        colored(
          beam(
            new THREE.Vector3(lx + sx * 0.03, o.h * 0.45, lz + sz * 0.02),
            new THREE.Vector3(lx + sx * 0.08, 0, lz + sz * 0.05),
            0.045,
            0.045,
          ),
          C.woodDark,
        ),
      );
    }
  }
  kit.shadows.push({ x: o.x, z: o.z, rx: o.w * 0.55, rz: o.d * 0.6, k: 0.45 });
}

/** 방석: 도톰한 네모 + 가운데 매듭 */
export function cushion(
  kit: Kit,
  x: number,
  z: number,
  size: number,
  color: string,
  edge: string,
  h = 0.09,
) {
  const c = new THREE.CylinderGeometry(size * 0.7, size * 0.72, h, 4, 2);
  c.rotateY(Math.PI / 4);
  // 가운데가 볼록
  const p = c.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) p.setY(i, p.getY(i) + 0.015);
  }
  c.computeVertexNormals();
  kit.parts.push(gradient(at(c, x, h / 2, z), edge, color));
  kit.parts.push(cyl(0.04, 0.045, 0.02, x, h + 0.005, z, edge, 8));
  kit.shadows.push({ x, z, rx: size * 0.55, rz: size * 0.55, k: 0.35 });
}

/** 좌등: 나무 틀 + 빛나는 한지 네 면 + 받침 */
export function floorLamp(kit: Kit, x: number, z: number, paper = C.paperLit, h = 0.62) {
  kit.parts.push(box(0.3, 0.05, 0.3, x, 0, z, C.woodDark));
  kit.parts.push(cyl(0.02, 0.02, h - 0.38, x, 0.05, z, C.woodDark, 6));
  const y0 = h - 0.34;
  kit.lit.push(box(0.24, 0.3, 0.24, x, y0, z, paper));
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    kit.parts.push(box(0.025, 0.34, 0.025, x + dx * 0.125, y0 - 0.02, z + dz * 0.125, C.woodDark));
  }
  kit.parts.push(box(0.29, 0.025, 0.29, x, y0 + 0.3, z, C.woodDark));
  kit.parts.push(box(0.29, 0.025, 0.29, x, y0 - 0.01, z, C.woodDark));
  // 창살 무늬
  for (const s of [-1, 1]) {
    kit.parts.push(box(0.245, 0.012, 0.012, x, y0 + 0.15, z + s * 0.122, C.woodDark));
    kit.parts.push(box(0.012, 0.012, 0.245, x + s * 0.122, y0 + 0.15, z, C.woodDark));
  }
  kit.glows.push({ x, y: y0 + 0.15, z, size: 1.6, color: "#ffb45c", flicker: 0.05 });
  kit.lights.push({ x, y: y0 + 0.15, z, color: "#ffbe7a", intensity: 1.0, range: 1.1 });
  kit.shadows.push({ x, z, rx: 0.25, rz: 0.25, k: 0.3 });
}

/** 매단 등: 둥근 한지 등 (round) 또는 청사초롱 (cheongsa) */
export function hangingLantern(
  kit: Kit,
  x: number,
  y: number,
  z: number,
  ceiling: number,
  kind: "round" | "cheongsa",
  color = "#ffe2a8",
) {
  kit.parts.push(cyl(0.006, 0.006, ceiling - y - 0.1, x, y + 0.1, z, "#2b1b12", 4));
  if (kind === "round") {
    const s = new THREE.SphereGeometry(0.17, 14, 10);
    s.scale(1, 0.85, 1);
    kit.lit.push(colored(at(s, x, y, z), color));
    for (const dy of [-0.12, 0.12])
      kit.parts.push(cyl(0.07, 0.07, 0.03, x, y + dy - 0.015, z, C.woodDark, 10));
    for (let i = 0; i < 6; i++) {
      const rib = new THREE.TorusGeometry(0.171, 0.004, 3, 16, Math.PI);
      rib.rotateZ(-Math.PI / 2);
      rib.scale(1, 0.85, 1);
      rib.rotateY((i / 6) * Math.PI);
      kit.parts.push(colored(at(rib, x, y, z), "#c99a5a"));
    }
    kit.glows.push({ x, y, z, size: 2.0, color: "#ffc070", flicker: 0.04 });
    kit.lights.push({ x, y, z, color: "#ffc080", intensity: 0.9, range: 1.3 });
  } else {
    kit.lit.push(cyl(0.12, 0.12, 0.13, x, y, z, "#4a6fe0", 10));
    kit.lit.push(cyl(0.12, 0.12, 0.13, x, y - 0.13, z, "#e0503f", 10));
    kit.parts.push(cyl(0.135, 0.135, 0.03, x, y + 0.13, z, C.woodDark, 10));
    kit.parts.push(cyl(0.135, 0.135, 0.03, x, y - 0.16, z, C.woodDark, 10));
    kit.parts.push(box(0.03, 0.12, 0.03, x, y - 0.3, z, "#e0503f"));
    kit.glows.push({ x, y, z, size: 1.4, color: "#ffb070", flicker: 0.08 });
    kit.lights.push({ x, y, z, color: "#ff9a60", intensity: 0.7, range: 1.0 });
  }
}

/** 초: 밀랍 기둥 + 불꽃 + 빛무리. holder가 있으면 놋쇠 촛대 */
export function candle(
  kit: Kit,
  x: number,
  y: number,
  z: number,
  h = 0.12,
  o: { wax?: string; holder?: boolean; light?: number } = {},
) {
  let base = y;
  if (o.holder) {
    kit.parts.push(cyl(0.05, 0.065, 0.02, x, y, z, C.brass, 10));
    kit.parts.push(cyl(0.012, 0.016, 0.16, x, y + 0.02, z, C.brass, 6));
    kit.parts.push(cyl(0.04, 0.03, 0.02, x, y + 0.18, z, C.brass, 10));
    base = y + 0.2;
  }
  kit.parts.push(cyl(0.022, 0.024, h, x, base, z, o.wax ?? "#f4ead6", 8));
  const flame = new THREE.SphereGeometry(0.018, 6, 5);
  flame.scale(1, 1.9, 1);
  kit.lit.push(colored(at(flame, x, base + h + 0.03, z), C.flame));
  kit.glows.push({ x, y: base + h + 0.035, z, size: 0.55, color: "#ffb860", flicker: 0.22 });
  if (o.light)
    kit.lights.push({
      x,
      y: base + h + 0.05,
      z,
      color: "#ffa850",
      intensity: o.light,
      range: 0.7,
    });
}

/** 책 더미 (옛 선장본: 쪽빛·누런 표지) */
export function books(kit: Kit, x: number, y: number, z: number, n: number, seed: number) {
  const covers = ["#2f3f66", "#c9a85e", "#7a3a2c", "#3e5a4a", "#e2d3ad"];
  let yy = y;
  for (let i = 0; i < n; i++) {
    const h = 0.025 + ((seed * 7 + i * 3) % 3) * 0.006;
    const ry = (((seed + i * 5) % 7) - 3) * 0.05;
    kit.parts.push(box(0.24, h, 0.17, x, yy, z, covers[(seed + i) % covers.length] as string, ry));
    kit.parts.push(box(0.226, h * 0.7, 0.172, x + 0.006, yy + h * 0.15, z, "#efe4c8", ry));
    yy += h;
  }
  return yy;
}

/** 두루마리 */
export function scrollRoll(kit: Kit, x: number, y: number, z: number, len: number, ry = 0) {
  const r = new THREE.CylinderGeometry(0.028, 0.028, len, 8);
  r.rotateZ(Math.PI / 2);
  kit.parts.push(colored(at(r, x, y + 0.028, z, ry), "#efe2c0"));
  for (const s of [-1, 1]) {
    const k = new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6);
    k.rotateZ(Math.PI / 2);
    k.translate(s * (len / 2 + 0.015), 0, 0);
    kit.parts.push(colored(at(k, x, y + 0.028, z, ry), C.woodDark));
  }
}

/** 항아리 (회전체) */
export function jar(
  kit: Kit,
  x: number,
  y: number,
  z: number,
  h: number,
  color: string,
  shape: "moon" | "vase" | "pot" = "moon",
) {
  const prof: Record<typeof shape, [number, number][]> = {
    moon: [
      [0, 0],
      [0.2, 0],
      [0.36, 0.14],
      [0.47, 0.38],
      [0.48, 0.52],
      [0.42, 0.72],
      [0.26, 0.9],
      [0.24, 0.96],
      [0.26, 1],
      [0, 1],
    ],
    vase: [
      [0, 0],
      [0.22, 0],
      [0.3, 0.2],
      [0.3, 0.45],
      [0.16, 0.72],
      [0.1, 0.85],
      [0.16, 1],
      [0, 1],
    ],
    pot: [
      [0, 0],
      [0.3, 0],
      [0.42, 0.25],
      [0.44, 0.55],
      [0.36, 0.85],
      [0.3, 1],
      [0, 1],
    ],
  };
  const pts = prof[shape].map(([r, yy]) => new THREE.Vector2(r * h, yy * h));
  const g = new THREE.LatheGeometry(pts, 16);
  kit.parts.push(gradient(at(g, x, y, z), new THREE.Color(color).multiplyScalar(0.78), color));
  kit.shadows.push({ x, z, rx: h * 0.45, rz: h * 0.45, k: 0.35 });
}

/** 구름 모양: 납작한 공 여러 개 */
export function cloud(
  kit: Kit,
  x: number,
  y: number,
  z: number,
  s: number,
  color: string,
  target: "parts" | "lit" = "parts",
) {
  const blobs: [number, number, number][] = [
    [0, 0, 1],
    [-0.9, -0.15, 0.7],
    [0.9, -0.12, 0.75],
    [-0.4, 0.35, 0.65],
    [0.45, 0.3, 0.6],
  ];
  for (const [dx, dy, r] of blobs) {
    const g = new THREE.SphereGeometry(0.12 * r * s, 10, 7);
    g.scale(1.2, 0.85, 0.6);
    kit[target].push(colored(at(g, x + dx * 0.12 * s, y + dy * 0.12 * s, z), color));
  }
}

/** 별 모양 (오각별을 두께 있게) */
export function starGeometry(r: number, depth = 0.02): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}
