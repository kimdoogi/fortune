/**
 * 한옥 점집 외관 (08 §1). 우진각 기와지붕은 높이 함수로 만든다:
 * 처마 쪽은 완만하고 용마루 쪽은 가파르며, 네 귀퉁이 처마가 위로 들린다.
 */
import * as THREE from "three";
import type { Doorway } from "./door-anim";
import { at, beam, colored, gradient } from "./geo";
import type { GlowSpot } from "./glow";

export interface HanokStyle {
  roof: string;
  wall: string;
  trim: string;
  /** 창호지 불빛 색 */
  paper: string;
}

export const WOOD = "#6e4429";
export const WOOD_DARK = "#4a2c1a";
const STONE = "#8d877c";
const STONE_DARK = "#625d55";

export interface Hanok {
  /** 램버트 + 버텍스 컬러로 합칠 정적 조각 */
  parts: THREE.BufferGeometry[];
  /** 스스로 빛나는 조각 (창호지, 초롱) */
  lit: THREE.BufferGeometry[];
  glows: GlowSpot[];
  /** 현판 위치 */
  sign: { x: number; y: number; z: number; w: number; h: number };
  /** 문 탭 판정 상자 */
  door: { x: number; y: number; z: number };
  /** 들어갈 때 열리는 문 (D-094) */
  doorway: Doorway;
  /** 계단 두 단과 기단: [앞면 z, 윗면 y] */
  steps: [number, number][];
  /** 계단 앞 걸을 수 있는 경계 (이보다 +z 쪽만 걸을 수 있음) */
  frontEdge: number;
}

/** 지붕 높이: 처마(가장자리) 0 → 용마루 H, 귀퉁이는 들린다 */
function roofHeight(x: number, z: number, W: number, D: number, H: number, lift: number) {
  const dx = W / 2 - Math.abs(x);
  const dz = D / 2 - Math.abs(z);
  const s = Math.max(0, Math.min(dx, dz) / (D / 2));
  const base = H * (0.22 * s + 0.78 * s ** 1.8);
  const ex = Math.min(1, Math.abs(x) / (W / 2));
  const ez = Math.min(1, Math.abs(z) / (D / 2));
  return base + lift * (1 - s) ** 2 * ex ** 3 * ez ** 3;
}

function roof(
  W: number,
  D: number,
  H: number,
  lift: number,
  y0: number,
  cz: number,
  color: string,
): THREE.BufferGeometry[] {
  const step = 0.2;
  const sx = Math.round(W / step);
  const sz = Math.round(D / step);
  const top = new THREE.PlaneGeometry(W, D, sx, sz);
  top.rotateX(-Math.PI / 2);
  const pos = top.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  const tile = new THREE.Color(color);
  const groove = tile.clone().multiplyScalar(0.72);
  const edge = tile.clone().lerp(new THREE.Color("#e8e0cf"), 0.35);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, roofHeight(x, z, W, D, H, lift));
    const dx = W / 2 - Math.abs(x);
    const dz = D / 2 - Math.abs(z);
    // 기와 골: 앞뒤 면은 x 방향, 옆면은 z 방향으로 줄무늬
    const lane = dz <= dx ? Math.round((x + W / 2) / step) : Math.round((z + D / 2) / step);
    c.copy(lane % 2 === 0 ? tile : groove);
    if (Math.min(dx, dz) < 0.05) c.copy(edge); // 막새
    col.set([c.r, c.g, c.b], i * 3);
  }
  top.setAttribute("color", new THREE.BufferAttribute(col, 3));
  top.deleteAttribute("uv");
  top.computeVertexNormals();

  // 처마 밑면 (서까래 색), 면 방향을 뒤집는다
  const under = top.clone();
  const upos = under.getAttribute("position");
  const ucol = under.getAttribute("color");
  const wood = new THREE.Color(WOOD_DARK);
  for (let i = 0; i < upos.count; i++) {
    upos.setY(i, upos.getY(i) - 0.16);
    ucol.setXYZ(i, wood.r, wood.g, wood.b);
  }
  const idx = under.getIndex() as THREE.BufferAttribute;
  for (let i = 0; i < idx.count; i += 3) {
    const b = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, b);
  }
  under.computeVertexNormals();

  const out = [top.toNonIndexed(), under.toNonIndexed()];
  top.dispose();
  under.dispose();
  for (const g of out) g.translate(0, y0, cz);

  // 용마루 + 양성바름(흰 띠) + 끝 장식
  const ridgeY = y0 + H;
  const ridgeLen = W - D + 0.5;
  out.push(colored(at(new THREE.BoxGeometry(ridgeLen, 0.3, 0.34), 0, ridgeY + 0.1, cz), "#2b2a2e"));
  out.push(
    colored(at(new THREE.BoxGeometry(ridgeLen - 0.1, 0.08, 0.36), 0, ridgeY + 0.06, cz), "#d9d2c2"),
  );
  for (const side of [-1, 1]) {
    const end = new THREE.BoxGeometry(0.2, 0.42, 0.38);
    end.rotateZ(side * -0.35);
    out.push(colored(at(end, side * (ridgeLen / 2 + 0.02), ridgeY + 0.22, cz), "#2b2a2e"));
  }
  // 추녀마루: 용마루 끝에서 네 귀퉁이까지 지붕면을 따라간다
  for (const sx2 of [-1, 1]) {
    for (const sz2 of [-1, 1]) {
      const from = new THREE.Vector2(sx2 * (W / 2 - D / 2), 0);
      const to = new THREE.Vector2(sx2 * (W / 2 - 0.05), sz2 * (D / 2 - 0.05));
      let prev: THREE.Vector3 | null = null;
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        const x = from.x + (to.x - from.x) * t;
        const z = from.y + (to.y - from.y) * t;
        const p = new THREE.Vector3(x, y0 + roofHeight(x, z, W, D, H, lift) + 0.06, z + cz);
        if (prev) out.push(colored(beam(prev, p, 0.16, 0.14), "#2b2a2e"));
        prev = p;
      }
    }
  }
  return out;
}

/** 격자 창살 (세로 n개, 가로 m개) */
export function lattice(
  cx: number,
  cy: number,
  z: number,
  w: number,
  h: number,
  nv: number,
  nh: number,
  color = WOOD_DARK,
): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const t = 0.05;
  // 테두리
  out.push(at(new THREE.BoxGeometry(w + t, t * 1.6, t), cx, cy + h / 2, z));
  out.push(at(new THREE.BoxGeometry(w + t, t * 1.6, t), cx, cy - h / 2, z));
  out.push(at(new THREE.BoxGeometry(t * 1.6, h, t), cx - w / 2, cy, z));
  out.push(at(new THREE.BoxGeometry(t * 1.6, h, t), cx + w / 2, cy, z));
  for (let i = 1; i <= nv; i++) {
    out.push(at(new THREE.BoxGeometry(0.025, h, 0.03), cx - w / 2 + (w * i) / (nv + 1), cy, z));
  }
  for (let i = 1; i <= nh; i++) {
    out.push(at(new THREE.BoxGeometry(w, 0.025, 0.03), cx, cy - h / 2 + (h * i) / (nh + 1), z));
  }
  return out.map((g) => colored(g, color));
}

export function buildHanok(style: HanokStyle, bz: number): Hanok {
  const parts: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const glows: GlowSpot[] = [];

  // 기단과 계단
  const baseH = 0.45;
  const baseD = 4.5;
  parts.push(
    gradient(at(new THREE.BoxGeometry(7.2, baseH, baseD), 0, baseH / 2, bz), STONE_DARK, STONE),
  );
  parts.push(
    colored(at(new THREE.BoxGeometry(7.3, 0.06, baseD + 0.1), 0, baseH + 0.01, bz), "#a59f93"),
  );
  const front = bz + baseD / 2;
  parts.push(
    gradient(
      at(new THREE.BoxGeometry(2.4, 0.3, 0.32), 0, 0.15, front + 0.16),
      STONE_DARK,
      "#a59f93",
    ),
  );
  parts.push(
    gradient(
      at(new THREE.BoxGeometry(2.4, 0.15, 0.32), 0, 0.075, front + 0.48),
      STONE_DARK,
      "#a59f93",
    ),
  );

  // 몸채 (한지 벽)
  const bodyW = 5.8;
  const bodyD = 3.0;
  const wallTop = 2.78;
  const wallH = wallTop - baseH;
  const zf = bz + bodyD / 2; // 앞벽
  parts.push(
    gradient(
      at(new THREE.BoxGeometry(bodyW, wallH, bodyD), 0, baseH + wallH / 2, bz),
      "#d9c9a8",
      style.wall,
    ),
  );

  // 기둥 + 주춧돌 (앞 4개, 뒤 2개)
  const cols = [-2.95, -1.0, 1.0, 2.95];
  for (const x of cols) {
    parts.push(
      colored(
        at(new THREE.CylinderGeometry(0.14, 0.15, wallH, 10), x, baseH + wallH / 2, zf + 0.02),
        WOOD,
      ),
    );
    parts.push(
      colored(
        at(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 8), x, baseH + 0.06, zf + 0.02),
        "#a59f93",
      ),
    );
  }
  for (const x of [-2.95, 2.95]) {
    parts.push(
      colored(
        at(new THREE.CylinderGeometry(0.14, 0.15, wallH, 10), x, baseH + wallH / 2, bz - bodyD / 2),
        WOOD,
      ),
    );
  }
  // 하인방·상인방
  parts.push(
    colored(at(new THREE.BoxGeometry(bodyW + 0.1, 0.16, 0.08), 0, baseH + 0.12, zf + 0.04), WOOD),
  );
  parts.push(colored(at(new THREE.BoxGeometry(bodyW + 0.1, 0.12, 0.08), 0, 2.42, zf + 0.04), WOOD));

  // 창방(보) + 단청 띠 + 주두
  parts.push(
    colored(at(new THREE.BoxGeometry(bodyW + 0.6, 0.3, bodyD + 0.4), 0, wallTop + 0.13, bz), WOOD),
  );
  const beamFront = bz + (bodyD + 0.4) / 2;
  parts.push(
    colored(
      at(new THREE.BoxGeometry(bodyW + 0.62, 0.11, 0.02), 0, wallTop + 0.17, beamFront + 0.005),
      "#3b8f7a",
    ),
  );
  parts.push(
    colored(
      at(new THREE.BoxGeometry(bodyW + 0.62, 0.04, 0.02), 0, wallTop + 0.07, beamFront + 0.006),
      "#b8443a",
    ),
  );
  for (const x of cols) {
    parts.push(
      colored(at(new THREE.BoxGeometry(0.34, 0.16, 0.34), x, wallTop - 0.04, zf + 0.02), WOOD_DARK),
    );
  }

  // 양옆 창 (창살 + 불 켜진 창호지)
  for (const x of [-2.0, 2.0]) {
    lit.push(colored(at(new THREE.PlaneGeometry(1.1, 0.95), x, 1.55, zf + 0.012), style.paper));
    parts.push(...lattice(x, 1.55, zf + 0.04, 1.1, 0.95, 3, 3));
    glows.push({ x, y: 1.55, z: zf + 0.35, size: 2.6, color: style.paper, flicker: 0.03 });
  }
  // 가운데 두짝 문 (띠살문)
  const doorH = 1.78;
  const doorY = baseH + 0.2 + doorH / 2;
  lit.push(colored(at(new THREE.PlaneGeometry(1.84, doorH), 0, doorY, zf + 0.012), style.paper));
  for (const x of [-0.46, 0.46]) parts.push(...lattice(x, doorY, zf + 0.04, 0.88, doorH, 5, 2));
  glows.push({ x: 0, y: doorY, z: zf + 0.4, size: 3.6, color: style.paper, flicker: 0.03 });

  // 지붕
  parts.push(...roof(8.0, 5.0, 1.55, 0.5, wallTop + 0.22, bz, style.roof));

  // 청사초롱 (처마 밑 양쪽)
  for (const x of [-2.0, 2.0]) {
    const y = 2.3;
    const z = bz + 2.05;
    lit.push(
      colored(at(new THREE.CylinderGeometry(0.15, 0.15, 0.17, 10), x, y + 0.085, z), "#4a6fe0"),
    );
    lit.push(
      colored(at(new THREE.CylinderGeometry(0.15, 0.15, 0.17, 10), x, y - 0.085, z), "#e0503f"),
    );
    parts.push(
      colored(at(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 10), x, y + 0.19, z), WOOD_DARK),
    );
    parts.push(
      colored(at(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 10), x, y - 0.19, z), WOOD_DARK),
    );
    parts.push(
      colored(at(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), x, y + 0.45, z), "#2b1b12"),
    );
    glows.push({ x, y, z: z + 0.05, size: 2.2, color: "#ffb070", flicker: 0.08 });
  }

  return {
    parts,
    lit,
    glows,
    sign: { x: 0, y: 2.66, z: beamFront + 0.03, w: 1.5, h: 0.48 },
    door: { x: 0, y: doorY, z: zf + 0.3 },
    doorway: {
      z: zf,
      shape: "rect",
      w: 1.84,
      h: doorH,
      y0: doorY - doorH / 2,
      leaves: 2,
      leaf: style.paper,
      frame: "#4a2e1c",
      paper: true,
    },
    steps: [
      [front + 0.64, 0.15],
      [front + 0.32, 0.3],
      [front, baseH + 0.04],
    ],
    frontEdge: front + 0.64,
  };
}
