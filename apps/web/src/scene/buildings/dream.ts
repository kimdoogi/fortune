/**
 * 꿈해몽: 꿈속 찻집 (08 §1 점집별 외관, D-075).
 * 둥근 달문(월문)과 둥근 창, 둥글게 휜 연청 기와지붕 + 구름 장식과 달 구슬, 처마 끝 달 초롱,
 * 마당의 달항아리와 찻상(평상). 연못·떠 있는 구름은 거리(street-env, street-fx)가 만든다.
 */
import * as THREE from "three";
import { at, colored, gradient } from "../geo";
import type { GlowSpot } from "../glow";
import { addClouds } from "../street-fx";
import type { Kit } from "../street-kit";
import { jar, place } from "./common";
import type { Building } from "./types";

const WOOD = "#a58468";
const WOOD_DARK = "#6e5240";
const TILE = "#9cc4e6";
const TILE_GROOVE = "#7ea7d2";
const RIM = "#f4f6fb";
const CLOUD = "#f6f3ff";
const GLOW_PAPER = "#ffe6b4";

const SQ = 3;
/** 지붕 둥근 사각의 반지름 (0 가운데 ~ 1 처마) */
function sqR(x: number, z: number, a: number, b: number) {
  return (Math.abs(x / a) ** SQ + Math.abs(z / b) ** SQ) ** (1 / SQ);
}
const smooth = (e0: number, e1: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
function roofH(s: number, h: number, lift: number) {
  return h * Math.max(0, 1 - s ** 1.9) ** 0.75 + lift * smooth(0.78, 1, s);
}

/**
 * 둥글게 휜 기와지붕: 가운데가 볼록하고 처마 끝이 살짝 들린다.
 * 기와 골은 방사 방향 줄무늬, 처마 끝은 흰 막새, 그 아래 연한 처마 띠.
 */
function roundRoof(
  cx: number,
  y0: number,
  cz: number,
  a: number,
  b: number,
  h: number,
  lift: number,
) {
  const K = 14;
  const S = 96;
  const pos: number[] = [];
  const col: number[] = [];
  const tile = new THREE.Color(TILE);
  const groove = new THREE.Color(TILE_GROOVE);
  const rim = new THREE.Color(RIM);
  const fascia = new THREE.Color("#e4def0");
  for (let k = 0; k <= K + 1; k++) {
    for (let i = 0; i < S; i++) {
      const th = (i / S) * Math.PI * 2;
      const ct = Math.cos(th);
      const st = Math.sin(th);
      const ex = Math.sign(ct) * Math.abs(ct) ** (2 / SQ);
      const ez = Math.sign(st) * Math.abs(st) ** (2 / SQ);
      const s = k <= K ? Math.max(0.001, k / K) : 1;
      const y = k <= K ? roofH(s, h, lift) : roofH(1, h, lift) - 0.24;
      pos.push(cx + a * s * ex, y0 + y, cz + b * s * ez);
      const c = k > K ? fascia : s > 0.95 ? rim : i % 2 === 0 ? tile : groove;
      col.push(c.r, c.g, c.b);
    }
  }
  const idx: number[] = [];
  for (let k = 0; k <= K; k++) {
    for (let i = 0; i < S; i++) {
      const a0 = k * S + i;
      const a1 = k * S + ((i + 1) % S);
      const b0 = (k + 1) * S + i;
      const b1 = (k + 1) * S + ((i + 1) % S);
      idx.push(a0, a1, b0, a1, b1, b0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if ((geo.getAttribute("normal").getY(S + 1) as number) < 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1] as number;
      idx[i + 1] = idx[i + 2] as number;
      idx[i + 2] = t;
    }
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  const out = geo.toNonIndexed();
  geo.dispose();
  return out;
}

/** 구름 장식: 납작한 공 서너 개를 소용돌이처럼 붙인다 */
function cloudOrnament(parts: THREE.BufferGeometry[], x: number, y: number, z: number, s: number) {
  const puffs: [number, number, number][] = [
    [0, 0, 0.2],
    [-0.18, -0.05, 0.15],
    [0.17, -0.06, 0.14],
    [0.05, 0.12, 0.12],
  ];
  for (const [dx, dy, r] of puffs) {
    const g = new THREE.SphereGeometry(r * s, 10, 8);
    g.scale(1, 0.8, 0.75);
    parts.push(colored(at(g, x + dx * s, y + dy * s, z), CLOUD));
  }
}

/** 둥근 창·달문 안의 창살: 원 안에 들어가는 길이로 자른 가로세로 살 */
function roundLattice(
  parts: THREE.BufferGeometry[],
  cx: number,
  cy: number,
  z: number,
  r: number,
  xs: number[],
  ys: number[],
) {
  for (const x of xs) {
    const h = 2 * Math.sqrt(Math.max(0, r * r - x * x));
    parts.push(colored(at(new THREE.BoxGeometry(0.035, h, 0.03), cx + x, cy, z), WOOD_DARK));
  }
  for (const y of ys) {
    const w = 2 * Math.sqrt(Math.max(0, r * r - y * y));
    parts.push(colored(at(new THREE.BoxGeometry(w, 0.035, 0.03), cx, cy + y, z), WOOD_DARK));
  }
}

export function buildDream(kit: Kit): Building {
  const { bz } = kit;
  const parts: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const glows: GlowSpot[] = [];

  // 연한 돌 기단 + 계단 둘
  const base = 0.4;
  parts.push(
    gradient(at(new THREE.BoxGeometry(6.4, base, 4.0), 0, base / 2, bz), "#8f8aa8", "#e4e2ee"),
  );
  parts.push(
    gradient(at(new THREE.BoxGeometry(1.9, 0.27, 0.36), 0, 0.135, bz + 2.18), "#8f8aa8", "#e8e6f0"),
  );
  parts.push(
    gradient(at(new THREE.BoxGeometry(1.9, 0.13, 0.36), 0, 0.065, bz + 2.52), "#8f8aa8", "#e8e6f0"),
  );
  const frontEdge = bz + 2.9;

  // 흰 회벽 몸채 + 연한 나무 기둥·인방
  const W = 5.6;
  const D = 3.0;
  const top = 2.75;
  const zf = bz + D / 2;
  parts.push(
    gradient(
      at(new THREE.BoxGeometry(W, top - base, D), 0, (top + base) / 2, bz),
      "#d9d2ea",
      "#f7f3ec",
    ),
  );
  for (const x of [-2.8, 2.8])
    parts.push(
      colored(
        at(new THREE.CylinderGeometry(0.12, 0.13, top - base, 10), x, (top + base) / 2, zf),
        WOOD,
      ),
    );
  for (const y of [base + 0.08, top - 0.1])
    parts.push(colored(at(new THREE.BoxGeometry(W + 0.1, 0.12, 0.08), 0, y, zf + 0.03), WOOD));

  // 달문: 둥근 문틀(돌) + 불 켜진 창호 + 창살
  const gy = 1.36;
  const gr = 0.92;
  lit.push(colored(at(new THREE.CircleGeometry(gr, 40), 0, gy, zf + 0.012), GLOW_PAPER));
  roundLattice(parts, 0, gy, zf + 0.03, gr, [-0.46, 0, 0.46], [-0.3, 0.3]);
  parts.push(
    colored(at(new THREE.TorusGeometry(gr + 0.06, 0.1, 6, 40), 0, gy, zf + 0.05), "#cfd3e4"),
  );
  parts.push(colored(at(new THREE.TorusGeometry(gr - 0.02, 0.03, 4, 40), 0, gy, zf + 0.06), WOOD));
  glows.push({ x: 0, y: gy, z: zf + 0.45, size: 3.8, color: "#ffd9a0", flicker: 0.04 });

  // 양옆 둥근 창
  for (const s of [-1, 1]) {
    const x = s * 1.95;
    const y = 1.6;
    lit.push(colored(at(new THREE.CircleGeometry(0.42, 28), x, y, zf + 0.012), GLOW_PAPER));
    roundLattice(parts, x, y, zf + 0.03, 0.42, [-0.14, 0.14], [-0.14, 0.14]);
    parts.push(colored(at(new THREE.TorusGeometry(0.45, 0.06, 5, 28), x, y, zf + 0.04), WOOD));
    glows.push({ x, y, z: zf + 0.3, size: 2.2, color: "#ffdca8", flicker: 0.04 });
  }

  // 둥글게 휜 연청 기와지붕
  const ra = 3.75;
  const rb = 2.5;
  const rh = 1.2;
  const lift = 0.2;
  const ry = top + 0.1;
  parts.push(roundRoof(0, ry, bz, ra, rb, rh, lift));
  const roofAt = (x: number, z: number) => ry + roofH(sqR(x, z, ra, rb), rh, lift);
  const rimZ = (x: number) => rb * Math.max(0, 1 - Math.abs(x / ra) ** SQ) ** (1 / SQ);
  // 용마루: 둥근 흰 막대 + 양끝 구름 + 가운데 달 구슬
  {
    const ridge = new THREE.CylinderGeometry(0.12, 0.12, 1.9, 10);
    ridge.rotateZ(Math.PI / 2);
    parts.push(colored(at(ridge, 0, roofAt(0, 0) - 0.02, bz), "#eef1f8"));
    for (const sx of [-1, 1]) cloudOrnament(parts, sx * 1.05, roofAt(0.9, 0) + 0.12, bz, 1.3);
    lit.push(
      colored(at(new THREE.SphereGeometry(0.17, 14, 10), 0, roofAt(0, 0) + 0.3, bz), "#ffe48a"),
    );
    glows.push({ x: 0, y: roofAt(0, 0) + 0.3, z: bz, size: 1.8, color: "#ffe08a", flicker: 0.06 });
    // 네 귀퉁이 처마 위 구름
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const x = sx * ra * 0.79;
        const z = sz * rimZ(x) * 0.97;
        cloudOrnament(parts, x, roofAt(x, z * 0.98) + 0.08, bz + z, 1.0);
      }
  }

  // 처마 끝 달 초롱
  for (const x of [-2.9, -1.55, 1.55, 2.9]) {
    const z = bz + rimZ(x) - 0.2;
    const rimY = roofAt(x, rimZ(x) - 0.2) - 0.2;
    const y = Math.abs(x) > 2 ? 2.25 : 2.45;
    lit.push(colored(at(new THREE.SphereGeometry(0.2, 14, 10), x, y, z), "#fff0b8"));
    parts.push(
      colored(at(new THREE.CylinderGeometry(0.09, 0.11, 0.05, 10), x, y + 0.21, z), "#c9a86a"),
    );
    parts.push(colored(at(new THREE.ConeGeometry(0.045, 0.16, 6), x, y - 0.27, z), "#f4a6c4"));
    parts.push(
      colored(
        at(new THREE.CylinderGeometry(0.006, 0.006, rimY - y, 3), x, (rimY + y) / 2, z),
        "#4a3a30",
      ),
    );
    glows.push({ x, y, z, size: 2.2, color: "#ffe9a8", flicker: 0.06 });
  }

  // 달항아리 (마당 왼쪽, 나무 받침 위)
  const mx = -3.7;
  const mz = bz + 4.1;
  parts.push(
    gradient(at(new THREE.CylinderGeometry(0.46, 0.5, 0.24, 12), mx, 0.12, mz), WOOD_DARK, WOOD),
  );
  parts.push(...place(jar(1.35, "#f6f1e6", null), mx, 0.24, mz));

  // 찻상(평상)과 청자 다기 (마당 오른쪽)
  const tx = 3.9;
  const tz = bz + 3.9;
  parts.push(
    gradient(at(new THREE.BoxGeometry(1.7, 0.08, 1.0), tx, 0.42, tz), WOOD_DARK, "#c9a888"),
  );
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      parts.push(
        colored(
          at(new THREE.BoxGeometry(0.08, 0.38, 0.08), tx + sx * 0.75, 0.19, tz + sz * 0.42),
          WOOD_DARK,
        ),
      );
  const celadon = "#8fc4b0";
  const pot = new THREE.SphereGeometry(0.12, 12, 8);
  pot.scale(1, 0.85, 1);
  parts.push(colored(at(pot, tx - 0.2, 0.56, tz), celadon));
  parts.push(colored(at(new THREE.SphereGeometry(0.04, 8, 6), tx - 0.2, 0.67, tz), celadon));
  const spout = new THREE.CylinderGeometry(0.015, 0.025, 0.14, 6);
  spout.rotateZ(-0.9);
  parts.push(colored(at(spout, tx - 0.06, 0.58, tz), celadon));
  for (const dx of [0.15, 0.35])
    parts.push(
      colored(
        at(new THREE.CylinderGeometry(0.045, 0.035, 0.06, 10), tx + dx, 0.49, tz + 0.12),
        celadon,
      ),
    );
  const cushion = new THREE.CylinderGeometry(0.26, 0.26, 0.07, 12);
  cushion.scale(1, 1, 0.8);
  parts.push(colored(at(cushion, tx + 0.45, 0.5, tz - 0.2), "#f4b6cf"));

  // 떠 있는 구름 덩어리 (천천히 오르내린다)
  addClouds(
    kit,
    [
      { x: -6.4, y: 3.3, z: -4.5, s: 1.0 },
      { x: 6.7, y: 3.7, z: -2.4, s: 1.1 },
      { x: -7.6, y: 6.4, z: -15, s: 1.4 },
      { x: -2.6, y: 7.6, z: -19, s: 1.2 },
      { x: -7.4, y: 2.6, z: 3.2, s: 0.8 },
      { x: 7.3, y: 3.0, z: 4.6, s: 0.9 },
      { x: -3.2, y: 1.9, z: -2.4, s: 0.5 },
      { x: 3.5, y: 2.3, z: 1.4, s: 0.45 },
    ],
    ["#ffffff", "#f1e9ff", "#e9f1ff", "#ffeef6"],
  );

  return {
    parts,
    lit,
    glows,
    sign: {
      x: 0,
      y: 2.53,
      z: zf + 0.07,
      w: 1.0,
      h: 0.32,
      style: { bgTop: "#e6eefb", bgBottom: "#bccbe8", border: "#ffffff", text: "#4a568f" },
    },
    door: { x: 0, y: gy, z: zf + 0.3 },
    frontEdge,
    blockRects: [[-3.4, bz - 2.2, 3.4, frontEdge - 0.1]],
    blockers: [
      [mx, mz, 0.6],
      [tx, tz, 1.0],
    ],
    clearRects: [[-3.8, bz - 2.6, 3.8, bz + 2.6]],
    pools: [{ x: 0, z: bz + 3.0, r: 2.3, k: 0.45, color: "#ffe0b0" }],
  };
}
