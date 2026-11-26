/**
 * 거리 배경 조각들 (08 §1 점집별 외관, D-075). 점집마다 등불·울타리·나무·길·이웃 지붕 종류만 고르면 된다.
 * 정적 조각은 parts/lit에 모아 한 덩어리로 합치고, 반복 물체는 InstancedMesh로 그린다 (07 §4).
 */
import * as THREE from "three";
import { at, beam, colored, gradient, hash } from "./geo";
import type { GlowSpot } from "./glow";
import type { NavGrid, Point } from "./nav";

/** 바닥에 구울 빛 웅덩이 */
export interface Pool {
  x: number;
  z: number;
  r: number;
  k: number;
  color: THREE.Color;
}

/** 거리를 만드는 동안 함께 쓰는 바구니 */
export interface Kit {
  bz: number;
  parts: THREE.BufferGeometry[];
  lit: THREE.BufferGeometry[];
  glows: GlowSpot[];
  pools: Pool[];
  nav: NavGrid;
  rand: () => number;
  group: THREE.Group;
  track: <T extends { dispose(): void }>(x: T) => T;
  updaters: ((time: number) => void)[];
  /** 풀·꽃을 심지 않을 곳 */
  noGrass: ((x: number, z: number) => boolean)[];
}

export type LampKind = "stone" | "torch" | "iron" | "moon" | "bulbs";
export type BorderKind = "wall" | "brushwood" | "hedge" | "bushes" | "brick";
export type TreeKind = "round" | "dead" | "cypress" | "pastel";
export type NeighborKind = "hanok" | "huts" | "gables" | "none" | "market";

const lambert = (color: THREE.ColorRepresentation) => new THREE.MeshLambertMaterial({ color });

// ───────────────────────── 등불 ─────────────────────────

/** 석등 (사주집): 돌 부분은 정적 조각, 불 켜진 화사석은 빛 조각 */
function stoneLantern(kit: Kit, x: number, z: number) {
  const { parts, lit } = kit;
  const stone = "#9a9488";
  const dark = "#6a655c";
  parts.push(gradient(at(new THREE.BoxGeometry(0.42, 0.14, 0.42), x, 0.07, z), dark, stone));
  parts.push(
    gradient(at(new THREE.CylinderGeometry(0.07, 0.09, 0.56, 6), x, 0.42, z), dark, stone),
  );
  parts.push(colored(at(new THREE.BoxGeometry(0.38, 0.07, 0.38), x, 0.73, z), stone));
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    parts.push(
      colored(
        at(new THREE.BoxGeometry(0.05, 0.26, 0.05), x + dx * 0.13, 0.9, z + dz * 0.13),
        stone,
      ),
    );
  }
  lit.push(colored(at(new THREE.BoxGeometry(0.22, 0.22, 0.22), x, 0.9, z), "#ffc46b"));
  const cap = new THREE.ConeGeometry(0.32, 0.22, 4);
  cap.rotateY(Math.PI / 4);
  parts.push(colored(at(cap, x, 1.14, z), dark));
  parts.push(colored(at(new THREE.SphereGeometry(0.055, 6, 4), x, 1.28, z), dark));
  kit.glows.push({ x, y: 0.9, z, size: 3.0, color: "#ffad55", flicker: 0.1 });
  kit.pools.push({ x, z, r: 1.5, k: 0.55, color: new THREE.Color("#ffb066") });
  kit.nav.blockCircle(x, z, 0.25);
}

/** 횃불 (아기도령): 살짝 기운 나무 장대 + 쇠 바구니 + 붉은 불꽃. 빛이 크게 흔들린다 */
function torch(kit: Kit, x: number, z: number) {
  const { parts, lit } = kit;
  const lean = (hash(x, z) - 0.5) * 0.12;
  const pole = new THREE.CylinderGeometry(0.06, 0.08, 1.55, 6);
  pole.rotateZ(lean);
  parts.push(gradient(at(pole, x, 0.775, z), "#2e2119", "#5a4130"));
  const topX = x - Math.sin(lean) * 1.55;
  // 새끼줄 감은 자리
  parts.push(
    colored(at(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 6), topX, 1.35, z), "#8f7446"),
  );
  // 쇠 바구니
  parts.push(
    gradient(
      at(new THREE.CylinderGeometry(0.2, 0.1, 0.2, 7, 1, true), topX, 1.6, z),
      "#1c1616",
      "#3a3030",
    ),
  );
  parts.push(colored(at(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 7), topX, 1.51, z), "#1c1616"));
  // 불꽃: 혀 세 갈래, 아래는 노랗고 끝은 붉다
  const tongues: [number, number, number, number][] = [
    [0, 0.13, 0.46, 0],
    [-0.07, 0.07, 0.28, 0.35],
    [0.07, 0.07, 0.3, -0.35],
  ];
  const spin = hash(z, x) * 3;
  for (const [dx, r, h, tilt] of tongues) {
    const flame = new THREE.ConeGeometry(r, h, 6);
    flame.translate(0, h / 2, 0);
    flame.rotateZ(tilt);
    flame.translate(dx, 0, 0);
    flame.rotateY(spin);
    lit.push(gradient(at(flame, topX, 1.66, z), "#ffe27a", "#ff4a1f"));
  }
  kit.glows.push({ x: topX, y: 1.9, z, size: 4.6, color: "#ff5a22", flicker: 0.4 });
  kit.glows.push({ x: topX, y: 1.82, z, size: 1.5, color: "#ffc04a", flicker: 0.6 });
  kit.pools.push({ x: topX, z, r: 1.2, k: 0.42, color: new THREE.Color("#ff6a2a") });
  kit.nav.blockCircle(x, z, 0.25);
}

/** 쇠 가로등 (타로집): 검은 장대 위 유리 등 (노란 빛) */
function ironLamp(kit: Kit, x: number, z: number) {
  const { parts, lit } = kit;
  const iron = "#1d1a24";
  const iron2 = "#3a3546";
  parts.push(gradient(at(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8), x, 0.15, z), iron, iron2));
  parts.push(colored(at(new THREE.CylinderGeometry(0.045, 0.06, 2.0, 6), x, 1.25, z), iron));
  parts.push(colored(at(new THREE.TorusGeometry(0.08, 0.025, 4, 8), x, 0.9, z), iron2));
  parts.push(colored(at(new THREE.CylinderGeometry(0.13, 0.07, 0.1, 6), x, 2.28, z), iron));
  // 유리 등 (네 기둥 + 빛나는 속)
  lit.push(colored(at(new THREE.CylinderGeometry(0.15, 0.12, 0.36, 6), x, 2.52, z), "#ffd77a"));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    parts.push(
      colored(
        at(
          new THREE.BoxGeometry(0.025, 0.4, 0.025),
          x + Math.cos(a) * 0.15,
          2.52,
          z + Math.sin(a) * 0.15,
        ),
        iron,
      ),
    );
  }
  parts.push(colored(at(new THREE.ConeGeometry(0.24, 0.24, 6), x, 2.82, z), iron));
  parts.push(colored(at(new THREE.SphereGeometry(0.05, 6, 4), x, 2.97, z), iron2));
  kit.glows.push({ x, y: 2.52, z, size: 3.6, color: "#ffcf5a", flicker: 0.05 });
  kit.pools.push({ x, z, r: 1.9, k: 0.7, color: new THREE.Color("#ffd36a") });
  kit.nav.blockCircle(x, z, 0.25);
}

/** 달 초롱 기둥 (꿈해몽): 낮은 돌기둥 위 둥근 달 */
function moonLamp(kit: Kit, x: number, z: number) {
  const { parts, lit } = kit;
  parts.push(
    gradient(
      at(new THREE.CylinderGeometry(0.16, 0.22, 0.75, 8), x, 0.375, z),
      "#8f8aa8",
      "#d8d6e6",
    ),
  );
  parts.push(colored(at(new THREE.CylinderGeometry(0.22, 0.18, 0.08, 8), x, 0.79, z), "#e9e6f2"));
  lit.push(colored(at(new THREE.SphereGeometry(0.24, 14, 10), x, 1.06, z), "#fff2c4"));
  kit.glows.push({ x, y: 1.06, z, size: 3.0, color: "#ffe6a8", flicker: 0.05 });
  kit.pools.push({ x, z, r: 1.6, k: 0.5, color: new THREE.Color("#ffe8c0") });
  kit.nav.blockCircle(x, z, 0.25);
}

/** 전구 기둥 (족집게집): 나무 전봇대 + 양철 갓 전구. 기둥끼리는 bulbStrings가 줄로 잇는다 */
function bulbPole(kit: Kit, x: number, z: number) {
  const { parts, lit } = kit;
  const h = 3.1;
  const lean = (hash(x, z) - 0.5) * 0.05;
  const pole = new THREE.CylinderGeometry(0.06, 0.085, h, 7);
  pole.rotateZ(lean);
  parts.push(gradient(at(pole, x, h / 2, z), "#2a1f1a", "#5a4334"));
  const topX = x - Math.sin(lean) * h;
  // 가로대 + 애자
  parts.push(colored(at(new THREE.BoxGeometry(0.62, 0.06, 0.07), topX, h - 0.22, z), "#3a2c22"));
  for (const dx of [-0.24, 0.24])
    parts.push(
      colored(
        at(new THREE.CylinderGeometry(0.025, 0.03, 0.07, 6), topX + dx, h - 0.15, z),
        "#e6e2d6",
      ),
    );
  // 기둥에 붙인 낡은 전단지
  parts.push(
    colored(
      at(new THREE.BoxGeometry(0.2, 0.28, 0.01), x, 1.35, z + (z > -2 ? 0.08 : -0.08)),
      hash(z, x) > 0.5 ? "#e8dcc0" : "#d8c49a",
    ),
  );
  // 양철 갓 전구 (기둥에서 길 쪽으로)
  const side = x > 0 ? -1 : 1;
  const bx = topX + side * 0.42;
  const by = h - 0.5;
  parts.push(
    colored(
      beam(new THREE.Vector3(topX, h - 0.4, z), new THREE.Vector3(bx, by + 0.12, z), 0.03, 0.03),
      "#2a2420",
    ),
  );
  const shade = new THREE.ConeGeometry(0.2, 0.12, 10, 1, true);
  parts.push(colored(at(shade, bx, by + 0.08, z), "#3e5a52"));
  lit.push(colored(at(new THREE.SphereGeometry(0.07, 8, 6), bx, by, z), "#ffe2a0"));
  kit.glows.push({ x: bx, y: by, z, size: 2.6, color: "#ffb45a", flicker: 0.06 });
  kit.pools.push({ x: bx, z, r: 1.5, k: 0.6, color: new THREE.Color("#ffa850") });
  kit.nav.blockCircle(x, z, 0.25);
  return new THREE.Vector3(topX, h - 0.15, z);
}

/**
 * 줄줄이 매단 백열 전구 (족집게집): 기둥 꼭대기끼리 길을 지그재그로 가로지르는 처진 전선에
 * 작은 전구를 일정한 간격으로 단다. 전구는 빛 조각, 빛무리는 점 하나씩.
 */
function bulbStrings(kit: Kit, spots: Point[]) {
  const tops = spots.map((s) => bulbPole(kit, s.x, s.z));
  for (let i = 0; i + 1 < tops.length; i++) {
    const a = tops[i] as THREE.Vector3;
    const b = tops[i + 1] as THREE.Vector3;
    const len = a.distanceTo(b);
    const sag = 0.35 + len * 0.05;
    const pt = (t: number) =>
      a
        .clone()
        .lerp(b, t)
        .setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t));
    const segs = 14;
    for (let k = 0; k < segs; k++)
      kit.parts.push(colored(beam(pt(k / segs), pt((k + 1) / segs), 0.018, 0.018), "#1e1a18"));
    const n = Math.max(3, Math.round(len / 0.65));
    for (let k = 1; k < n; k++) {
      const p = pt(k / n);
      kit.parts.push(
        colored(
          at(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 5), p.x, p.y - 0.04, p.z),
          "#2a2420",
        ),
      );
      // 몇 개는 꺼져 있다 (오래된 장터 전구)
      const off = hash(i * 7.1 + k, k * 1.3) < 0.12;
      const bulb = new THREE.SphereGeometry(0.05, 7, 5);
      bulb.scale(1, 1.25, 1);
      if (off) {
        kit.parts.push(colored(at(bulb, p.x, p.y - 0.11, p.z), "#8a7a62"));
        continue;
      }
      const warm = k % 3 === 0 ? "#ffd08a" : "#ffe6b0";
      kit.lit.push(colored(at(bulb, p.x, p.y - 0.11, p.z), warm));
      kit.glows.push({ x: p.x, y: p.y - 0.11, z: p.z, size: 1.1, color: "#ffb25a", flicker: 0.05 });
      if (k % 2 === 0)
        kit.pools.push({ x: p.x, z: p.z, r: 1.0, k: 0.22, color: new THREE.Color("#ff9e48") });
    }
  }
}

const LAMPS: Record<Exclude<LampKind, "bulbs">, (kit: Kit, x: number, z: number) => void> = {
  stone: stoneLantern,
  torch,
  iron: ironLamp,
  moon: moonLamp,
};

export function placeLamps(kit: Kit, kind: LampKind, spots: Point[]) {
  if (kind === "bulbs") return bulbStrings(kit, spots);
  for (const s of spots) LAMPS[kind](kit, s.x, s.z);
}

// ───────────────────────── 울타리 ─────────────────────────

/** 담장: 돌 몸통 + 기와 갓 (z 방향 또는 x 방향) */
function wall(
  parts: THREE.BufferGeometry[],
  cx: number,
  cz: number,
  length: number,
  alongZ: boolean,
  roofColor: string,
) {
  const body = alongZ
    ? new THREE.BoxGeometry(0.5, 1.0, length)
    : new THREE.BoxGeometry(length, 1.0, 0.5);
  parts.push(gradient(at(body, cx, 0.5, cz), "#5f5a52", "#a39d90"));
  const shape = new THREE.Shape([
    new THREE.Vector2(-0.45, 0),
    new THREE.Vector2(0.45, 0),
    new THREE.Vector2(0, 0.3),
  ]);
  const cap = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  cap.translate(0, 0, -length / 2);
  if (!alongZ) cap.rotateY(Math.PI / 2);
  parts.push(colored(at(cap, cx, 1.0, cz), roofColor));
}

/** 싸리 울타리: 가는 가지를 촘촘히 세우고 두 줄로 묶는다 */
function brushwood(kit: Kit, x0: number, z0: number, x1: number, z1: number) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.round(len / 0.075);
  const ux = (x1 - x0) / len;
  const uz = (z1 - z0) / len;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * len;
    const r1 = hash(i * 0.37 + x0, z0 + i * 0.11);
    const r2 = hash(z0 - i * 0.21, i * 0.53 + x0);
    const h = 1.0 + r1 * 0.35;
    const stick = new THREE.BoxGeometry(0.035, h, 0.035);
    stick.rotateX((r2 - 0.5) * 0.14);
    stick.rotateZ((r1 - 0.5) * 0.18);
    const off = (r2 - 0.5) * 0.06;
    const tone = 0.75 + r1 * 0.4;
    kit.parts.push(
      gradient(
        at(stick, x0 + ux * t - uz * off, h / 2, z0 + uz * t + ux * off),
        new THREE.Color("#3a2c22").multiplyScalar(tone),
        new THREE.Color("#8a7258").multiplyScalar(tone),
      ),
    );
  }
  for (const y of [0.35, 0.82]) {
    kit.parts.push(
      colored(
        beam(new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y + 0.03, z1), 0.08, 0.06),
        "#4a3826",
      ),
    );
  }
}

/** 산울타리: 상자 몸통 위에 둥근 잎 덩어리를 올린다 */
function hedge(kit: Kit, x0: number, z0: number, x1: number, z1: number, color: string) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const alongZ = Math.abs(z1 - z0) > Math.abs(x1 - x0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const base = new THREE.Color(color);
  kit.parts.push(
    gradient(
      at(
        alongZ ? new THREE.BoxGeometry(0.8, 0.85, len) : new THREE.BoxGeometry(len, 0.85, 0.8),
        cx,
        0.425,
        cz,
      ),
      base.clone().multiplyScalar(0.45),
      base,
    ),
  );
  const n = Math.round(len / 0.7);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    const r = 0.42 + hash(x, z) * 0.12;
    kit.parts.push(
      colored(
        at(new THREE.IcosahedronGeometry(r, 0), x, 0.85 + hash(z, x) * 0.08, z, hash(x, x) * 3),
        base.clone().multiplyScalar(0.85 + hash(z, z) * 0.3),
      ),
    );
  }
}

/** 수국 덤불 (꿈해몽): 파스텔 꽃 덩어리를 줄지어 둔다 */
function bushes(kit: Kit, x0: number, z0: number, x1: number, z1: number) {
  const colors = ["#b9a6ee", "#a6c4f2", "#f0b6d6", "#c7b8f5", "#9fd8d0"].map(
    (c) => new THREE.Color(c),
  );
  const leaf = new THREE.Color("#4f7f74");
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.round(len / 0.8);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    const h = hash(x * 1.3, z * 0.7);
    kit.parts.push(
      colored(at(new THREE.IcosahedronGeometry(0.55 + h * 0.15, 0), x, 0.35, z, h * 5), leaf),
    );
    for (let k = 0; k < 3; k++) {
      const a = h * 6 + k * 2.1;
      kit.parts.push(
        colored(
          at(
            new THREE.IcosahedronGeometry(0.28 + hash(k, x) * 0.08, 1),
            x + Math.cos(a) * 0.3,
            0.62 + hash(z, k) * 0.25,
            z + Math.sin(a) * 0.3,
          ),
          colors[(i + k) % colors.length] as THREE.Color,
        ),
      );
    }
  }
}

/**
 * 붉은 벽돌 담 (족집게집): 몸통은 줄눈색 상자, 안쪽 면에만 벽돌을 한 장씩 칠한 판을 붙인다.
 * 줄마다 반 장씩 엇갈리고, 벽돌마다 색이 조금씩 다르다. 위는 시멘트 갓돌.
 */
function brickWall(
  kit: Kit,
  cx: number,
  cz: number,
  length: number,
  alongZ: boolean,
  face: 1 | -1,
) {
  const H = 1.7;
  const T = 0.4;
  const body = alongZ ? new THREE.BoxGeometry(T, H, length) : new THREE.BoxGeometry(length, H, T);
  kit.parts.push(colored(at(body, cx, H / 2, cz), "#4a3430"));
  const bl = 0.4;
  const bh = 0.14;
  const rows = Math.round(H / bh);
  const cols = Math.round(length / (bl / 2));
  const plane = new THREE.PlaneGeometry(length, rows * bh, cols, rows);
  const g = colored(plane, "#8a3a2c");
  const pos = g.getAttribute("position");
  const col = g.getAttribute("color");
  const tones = ["#9a4434", "#8a3a2c", "#a85040", "#7a3426", "#94483a", "#6e2e24"].map(
    (c) => new THREE.Color(c),
  );
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const u = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3 + length / 2;
    const v = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 + (rows * bh) / 2;
    const row = Math.floor(v / bh);
    const brick = Math.floor((u + (row % 2) * (bl / 2)) / bl);
    c.copy(tones[Math.floor(hash(brick + cx, row + cz) * tones.length)] as THREE.Color);
    // 아래쪽은 젖어서 어둡다
    c.multiplyScalar(0.75 + Math.min(1, v / 0.6) * 0.25);
    for (let j = 0; j < 3; j++) col.setXYZ(i + j, c.r, c.g, c.b);
  }
  g.translate(0, (rows * bh) / 2, 0);
  if (alongZ) g.rotateY(face > 0 ? Math.PI / 2 : -Math.PI / 2);
  else if (face < 0) g.rotateY(Math.PI);
  const off = T / 2 + 0.006;
  kit.parts.push(at(g, cx + (alongZ ? face * off : 0), 0, cz + (alongZ ? 0 : face * off)));
  const cap = alongZ
    ? new THREE.BoxGeometry(T + 0.12, 0.1, length + 0.1)
    : new THREE.BoxGeometry(length + 0.1, 0.1, T + 0.12);
  kit.parts.push(gradient(at(cap, cx, H + 0.05, cz), "#5e5a56", "#8c8780"));
}

/** 거리 양옆과 뒤를 막는다 (x ±8.8, 뒤 z -13.8) */
export function placeBorder(kit: Kit, kind: BorderKind, roofColor: string) {
  const { nav } = kit;
  for (const side of [-1, 1]) nav.blockRect(side * 8.8 - 0.4, -14, side * 8.8 + 0.4, 8);
  if (kind === "wall") {
    for (const side of [-1, 1]) wall(kit.parts, side * 8.8, -3, 22, true, roofColor);
    wall(kit.parts, 0, -13.8, 18.1, false, roofColor);
    return;
  }
  if (kind === "brushwood") {
    for (const side of [-1, 1]) brushwood(kit, side * 8.7, 8, side * 8.7, -13.7);
    brushwood(kit, -8.7, -13.7, 8.7, -13.7);
    return;
  }
  if (kind === "hedge") {
    for (const side of [-1, 1]) hedge(kit, side * 8.7, 8, side * 8.7, -13.7, "#2f5a3c");
    hedge(kit, -8.7, -13.7, 8.7, -13.7, "#2f5a3c");
    return;
  }
  if (kind === "brick") {
    for (const side of [-1, 1] as const)
      brickWall(kit, side * 8.8, -3, 22, true, side > 0 ? -1 : 1);
    brickWall(kit, 0, -13.8, 18.0, false, 1);
    return;
  }
  for (const side of [-1, 1]) bushes(kit, side * 8.7, 8, side * 8.7, -13.7);
  bushes(kit, -8.3, -13.7, 8.3, -13.7);
}

// ───────────────────────── 나무 ─────────────────────────

export interface TreeSpot {
  x: number;
  z: number;
  /** 둥근 나무: 분홍 꽃나무 */
  pink?: boolean;
}

/** 둥근 나무: 줄기 + 둥근 잎 덩어리 3개 (InstancedMesh) */
function roundTrees(kit: Kit, spots: TreeSpot[], greens: string[], pinks: string[]) {
  const { track } = kit;
  const trunk = new THREE.InstancedMesh(
    track(new THREE.CylinderGeometry(0.12, 0.2, 1.6, 6)),
    track(lambert("#5a3a26")),
    spots.length,
  );
  const leaves = new THREE.InstancedMesh(
    track(new THREE.IcosahedronGeometry(1, 1)),
    track(new THREE.MeshLambertMaterial({ flatShading: true })),
    spots.length * 3,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const e = new THREE.Euler();
  const g = greens.map((c) => new THREE.Color(c));
  const pk = pinks.map((c) => new THREE.Color(c));
  const blobs: [number, number, number, number][] = [
    [0, 2.1, 0, 1.15],
    [-0.65, 1.65, 0.2, 0.8],
    [0.6, 1.75, -0.15, 0.85],
  ];
  spots.forEach((t, i) => {
    const size = 0.9 + hash(t.x, t.z) * 0.35;
    trunk.setMatrixAt(
      i,
      m.compose(p.set(t.x, 0.8 * size, t.z), q.identity(), s.set(size, size, size)),
    );
    blobs.forEach(([dx, dy, dz, r], k) => {
      q.setFromEuler(e.set(hash(i, k) * 3, hash(k, i) * 3, 0));
      leaves.setMatrixAt(
        i * 3 + k,
        m.compose(p.set(t.x + dx * size, dy * size, t.z + dz * size), q, s.setScalar(r * size)),
      );
      leaves.setColorAt(i * 3 + k, (t.pink ? pk : g)[k % 3] as THREE.Color);
    });
    kit.nav.blockCircle(t.x, t.z, 0.45);
  });
  kit.group.add(trunk, leaves);
}

/** 앙상한 죽은 나무 (아기도령): 가지가 갈라지며 가늘어진다. 정적이라 배경에 합친다 */
export function deadTree(kit: Kit, x: number, z: number, scale = 1, seed = 0) {
  const dark = new THREE.Color("#2a2226");
  const light = new THREE.Color("#5a4c4a");
  const tips: THREE.Vector3[] = [];
  const grow = (from: THREE.Vector3, dir: THREE.Vector3, len: number, w: number, depth: number) => {
    const to = from.clone().addScaledVector(dir, len);
    const seg = beam(from, to, w, w);
    kit.parts.push(gradient(seg, dark.clone().lerp(light, depth * 0.15), light));
    if (depth >= 3) {
      tips.push(to);
      return;
    }
    const n = depth === 0 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const h = hash(seed + depth * 3.1 + k, x * 0.7 + z + k * 1.7);
      const a = (k / n) * Math.PI * 2 + h * 2.4 + seed;
      const out = 0.55 + h * 0.5;
      const d = new THREE.Vector3(
        dir.x + Math.cos(a) * out,
        dir.y * (0.65 + h * 0.3),
        dir.z + Math.sin(a) * out * 0.7,
      ).normalize();
      // 끝이 살짝 아래로 굽은 가지
      if (depth === 2) d.y -= 0.25;
      grow(to, d.normalize(), len * (0.62 + h * 0.15), w * 0.6, depth + 1);
    }
  };
  const lean = new THREE.Vector3((hash(x, seed) - 0.5) * 0.3, 1, (hash(seed, z) - 0.5) * 0.2);
  grow(new THREE.Vector3(x, 0, z), lean.normalize(), 1.5 * scale, 0.22 * scale, 0);
  kit.nav.blockCircle(x, z, 0.4);
  return tips;
}

/** 측백나무 (타로집): 뾰족하게 쌓은 원뿔 (InstancedMesh) */
function cypressTrees(kit: Kit, spots: TreeSpot[]) {
  const { track } = kit;
  const trunk = new THREE.InstancedMesh(
    track(new THREE.CylinderGeometry(0.1, 0.16, 0.8, 6)),
    track(lambert("#3e2a22")),
    spots.length,
  );
  const cone = new THREE.ConeGeometry(1, 1, 7);
  const leaves = new THREE.InstancedMesh(
    track(cone),
    track(new THREE.MeshLambertMaterial({ flatShading: true })),
    spots.length * 3,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const greens = ["#1f4338", "#2a5544", "#336650"].map((c) => new THREE.Color(c));
  spots.forEach((t, i) => {
    const size = 0.9 + hash(t.x, t.z) * 0.4;
    trunk.setMatrixAt(i, m.compose(p.set(t.x, 0.4, t.z), q.identity(), s.setScalar(1)));
    for (let k = 0; k < 3; k++) {
      const r = (0.95 - k * 0.22) * size;
      const h = (1.9 - k * 0.3) * size;
      q.setFromAxisAngle(p.set(0, 1, 0), hash(i, k) * 3);
      leaves.setMatrixAt(
        i * 3 + k,
        m.compose(p.set(t.x, (0.8 + k * 1.05 + h / 2) * size * 0.85, t.z), q, s.set(r, h, r)),
      );
      leaves.setColorAt(i * 3 + k, greens[k] as THREE.Color);
    }
    kit.nav.blockCircle(t.x, t.z, 0.45);
  });
  kit.group.add(trunk, leaves);
}

export function placeTrees(kit: Kit, kind: TreeKind, spots: TreeSpot[]) {
  if (kind === "round")
    roundTrees(kit, spots, ["#3d6b3a", "#4b7c42", "#335c36"], ["#e7a2bc", "#f1bccd", "#d98fae"]);
  else if (kind === "pastel")
    roundTrees(kit, spots, ["#b9a2e8", "#cdb6f2", "#a68fdc"], ["#f4b6cf", "#f9c9da", "#eaa3c3"]);
  else if (kind === "cypress") cypressTrees(kit, spots);
  else spots.forEach((t, i) => deadTree(kit, t.x, t.z, 0.95 + hash(t.x, t.z) * 0.35, i * 1.7));
}

// ───────────────────────── 이웃 실루엣 ─────────────────────────

const NEIGHBOR_SPOTS: [number, number, number, number][] = [
  [-13, -4, 5, 3.5],
  [13.5, -7, 6, 4],
  [-12, -18, 6, 4],
  [5, -19, 7, 4.2],
  [-3, -21, 5, 3.6],
];

/** 담장 너머 이웃 집 실루엣 */
export function placeNeighbors(kit: Kit, kind: NeighborKind) {
  const { parts, lit } = kit;
  for (const [x, z, w, d] of NEIGHBOR_SPOTS) {
    if (kind === "hanok") {
      parts.push(colored(at(new THREE.BoxGeometry(w * 0.75, 2.2, d * 0.7), x, 1.1, z), "#3a3045"));
      const r = new THREE.CylinderGeometry(0.4, w * 0.62, 1.4, 4);
      r.rotateY(Math.PI / 4);
      r.scale(1, 1, d / w);
      parts.push(colored(at(r, x, 2.9, z), "#262033"));
    } else if (kind === "huts") {
      // 낮은 초가 오두막: 흙벽 + 둥근 짚 지붕
      parts.push(colored(at(new THREE.BoxGeometry(w * 0.6, 1.6, d * 0.6), x, 0.8, z), "#2c2026"));
      const roof = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      roof.scale(w * 0.45, 1.3, d * 0.5);
      parts.push(colored(at(roof, x, 1.55, z), "#1e161c"));
    } else if (kind === "gables") {
      // 뾰족 박공 지붕 집 + 굴뚝 + 작은 불 켜진 창
      parts.push(colored(at(new THREE.BoxGeometry(w * 0.6, 2.6, d * 0.6), x, 1.3, z), "#2e2442"));
      const shape = new THREE.Shape([
        new THREE.Vector2(-w * 0.36, 0),
        new THREE.Vector2(w * 0.36, 0),
        new THREE.Vector2(0, 2.4),
      ]);
      const roof = new THREE.ExtrudeGeometry(shape, { depth: d * 0.7, bevelEnabled: false });
      roof.translate(0, 0, -d * 0.35);
      roof.rotateY(Math.PI / 2);
      parts.push(colored(at(roof, x, 2.6, z), "#1d1630"));
      parts.push(
        colored(at(new THREE.BoxGeometry(0.4, 1.4, 0.4), x + w * 0.15, 4.0, z), "#1d1630"),
      );
      const wx = x > 0 ? x - w * 0.3 - 0.01 : x + w * 0.3 + 0.01;
      lit.push(colored(at(new THREE.BoxGeometry(0.02, 0.4, 0.3), wx, 1.6, z + 0.4), "#e0a85a"));
      kit.glows.push({ x: wx, y: 1.6, z: z + 0.4, size: 1.2, color: "#ffb45a", flicker: 0.05 });
    } else if (kind === "market") {
      // 장터 가게: 납작한 2층 상자 + 한쪽으로 기운 함석 지붕 + 불 켜진 창과 간판 띠
      const h = 2.6 + hash(x, z) * 1.4;
      parts.push(colored(at(new THREE.BoxGeometry(w * 0.7, h, d * 0.6), x, h / 2, z), "#2e2438"));
      const roof = new THREE.BoxGeometry(w * 0.8, 0.12, d * 0.75);
      roof.rotateX(0.18);
      parts.push(colored(at(roof, x, h + 0.2, z), "#3a2e2a"));
      const front = z + d * 0.3 + 0.01;
      lit.push(
        colored(
          at(new THREE.BoxGeometry(w * 0.45, 0.32, 0.02), x, h - 0.45, front),
          hash(z, x) > 0.5 ? "#d8664a" : "#4aa89a",
        ),
      );
      for (const dx of [-w * 0.18, w * 0.16]) {
        lit.push(
          colored(at(new THREE.BoxGeometry(0.5, 0.55, 0.02), x + dx, 1.3, front), "#e0a060"),
        );
        kit.glows.push({
          x: x + dx,
          y: 1.3,
          z: front + 0.2,
          size: 1.4,
          color: "#ffaa55",
          flicker: 0.05,
        });
      }
    }
  }
}

/** 먼 산 (안개 없이 실루엣으로) */
export function buildHills(
  colors: [string, string],
  tint: THREE.ColorRepresentation,
  heightScale = 1,
) {
  const hills: THREE.BufferGeometry[] = [];
  const ridge: [number, number, number, number, number][] = [
    [-30, -60, 22, 11, 0],
    [0, -66, 26, 14, 0],
    [28, -58, 20, 9, 0],
    [-16, -48, 16, 7, 1],
    [18, -46, 15, 6.5, 1],
  ];
  for (const [x, z, r, h0, c] of ridge) {
    const h = h0 * heightScale;
    const cone = new THREE.ConeGeometry(r, h, 6, 1);
    cone.scale(1, 1, 0.5);
    hills.push(
      colored(
        at(cone, x, h / 2 - 0.5, z),
        new THREE.Color(colors[c] as string).lerp(new THREE.Color(tint), 0.15),
      ),
    );
  }
  return hills;
}
