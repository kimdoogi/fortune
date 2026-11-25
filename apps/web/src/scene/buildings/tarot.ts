/**
 * 타로집: 서양식 타로 오두막 (08 §1 점집별 외관, D-075).
 * 하프팀버(나무 골조) 벽, 뾰족한 보라 슬레이트 박공지붕 + 앞으로 나온 작은 박공(둥근 창),
 * 굴뚝 연기, 아치형 문 위 수정구 달린 쇠 간판, 창가 촛불, 문 앞 별무늬 깔개, 하얀 말뚝 울타리 앞뜰.
 */
import * as THREE from "three";
import { at, beam, colored, gradient, hash } from "../geo";
import type { GlowSpot } from "../glow";
import { addSmoke } from "../street-fx";
import type { Kit } from "../street-kit";
import type { Building } from "./types";

const TIMBER = "#3b2a24";
const PLASTER = "#f1e6cf";
const PLASTER_LOW = "#cdbb9a";
const SLATE = "#5d3f94";
const TRIM = "#2a1f33";
const IRON = "#1d1a22";
const PANE = "#ffcd78";

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * 슬레이트 지붕면: origin에서 u(폭)·v(경사) 방향으로 펼친 판을 비늘처럼 엇갈린 줄로 칠한다.
 * 밑면(처마 안쪽)도 어둡게 함께 만든다.
 */
function slateFace(
  origin: THREE.Vector3,
  u: THREE.Vector3,
  v: THREE.Vector3,
  nu: number,
  nv: number,
  color: string,
): THREE.BufferGeometry[] {
  const pos: number[] = [];
  const col: number[] = [];
  const base = new THREE.Color(color);
  const c = new THREE.Color();
  const p = (i: number, j: number) =>
    origin
      .clone()
      .addScaledVector(u, i / nu)
      .addScaledVector(v, j / nv);
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      // 한 줄씩 반 칸 엇갈린 비늘, 줄 아래쪽은 어둡게
      const tile = Math.floor(i / 2 + (j % 2) * 0.5);
      const tone = 0.82 + hash(tile, j) * 0.3;
      const a = p(i, j);
      const b = p(i + 1, j);
      const d = p(i, j + 1);
      const e = p(i + 1, j + 1);
      for (const [q, dark] of [
        [a, 0.7],
        [b, 0.7],
        [e, 1],
        [a, 0.7],
        [e, 1],
        [d, 1],
      ] as const) {
        pos.push(q.x, q.y, q.z);
        c.copy(base).multiplyScalar(tone * dark);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  top.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  top.computeVertexNormals();
  // 위를 향하게 맞춘다
  if ((top.getAttribute("normal").getY(0) as number) < 0) {
    const pa = top.getAttribute("position");
    const ca = top.getAttribute("color");
    for (let i = 0; i < pa.count; i += 3) {
      for (const attr of [pa, ca]) {
        const x = attr.getX(i + 1);
        const y = attr.getY(i + 1);
        const z = attr.getZ(i + 1);
        attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
        attr.setXYZ(i + 2, x, y, z);
      }
    }
    top.computeVertexNormals();
  }
  // 밑면: 아래로 살짝 내리고 감기 방향을 뒤집어 어둡게
  const under = top.clone();
  const n = new THREE.Vector3().crossVectors(u, v).normalize();
  if (n.y < 0) n.negate();
  under.translate(-n.x * 0.1, -n.y * 0.1, -n.z * 0.1);
  const ua = under.getAttribute("position");
  for (let i = 0; i < ua.count; i += 3) {
    const x = ua.getX(i + 1);
    const y = ua.getY(i + 1);
    const z = ua.getZ(i + 1);
    ua.setXYZ(i + 1, ua.getX(i + 2), ua.getY(i + 2), ua.getZ(i + 2));
    ua.setXYZ(i + 2, x, y, z);
  }
  under.computeVertexNormals();
  return [top, colored(under, "#241a2e")];
}

/** 아치 모양 (아래 가운데가 원점) */
function archShape(w: number, h: number) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h);
  s.absarc(0, h, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  return s;
}

/** 오각 별 */
function starShape(r: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return s;
}

/** 하얀 말뚝 울타리 한 줄 (끝이 뾰족한 말뚝 + 가로대 둘) */
function picketFence(
  parts: THREE.BufferGeometry[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
) {
  const white = "#f2efe6";
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 0.2));
  const ry = Math.atan2(-(z1 - z0), x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    parts.push(
      gradient(at(new THREE.BoxGeometry(0.08, 0.6, 0.03), x, 0.3, z, ry), "#a9a6b4", white),
    );
    const tip = new THREE.ConeGeometry(0.057, 0.13, 4);
    tip.rotateY(Math.PI / 4);
    parts.push(colored(at(tip, x, 0.665, z, ry), white));
  }
  for (const y of [0.2, 0.48])
    parts.push(colored(beam(v3(x0, y, z0), v3(x1, y, z1), 0.03, 0.06), "#d9d5e0"));
}

/** 라벤더 덤불: 가는 보라 원뿔 다발 */
function lavender(parts: THREE.BufferGeometry[], x: number, z: number) {
  parts.push(colored(at(new THREE.IcosahedronGeometry(0.28, 0), x, 0.15, z), "#3d5a40"));
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.08 + (i % 3) * 0.08;
    const spike = new THREE.ConeGeometry(0.04, 0.32, 4);
    spike.rotateZ(Math.cos(a) * 0.25);
    spike.rotateX(Math.sin(a) * 0.25);
    parts.push(
      colored(
        at(spike, x + Math.cos(a) * r, 0.45 + hash(i, x) * 0.08, z + Math.sin(a) * r),
        i % 2 ? "#9b6fe0" : "#7e56c8",
      ),
    );
  }
}

function pumpkin(parts: THREE.BufferGeometry[], x: number, z: number, s: number) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const rib = new THREE.SphereGeometry(0.13 * s, 8, 6);
    rib.scale(0.75, 1, 1.05);
    rib.rotateY(a);
    parts.push(
      colored(
        at(rib, x + Math.cos(a) * 0.08 * s, 0.13 * s, z + Math.sin(a) * 0.08 * s),
        i % 2 ? "#e0782a" : "#c9641e",
      ),
    );
  }
  parts.push(
    colored(at(new THREE.CylinderGeometry(0.02, 0.03, 0.1, 5), x, 0.28 * s, z), "#4f6a2a"),
  );
}

export function buildTarot(kit: Kit): Building {
  const { bz } = kit;
  const parts: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const glows: GlowSpot[] = [];

  // 돌 기단 + 계단 둘
  const base = 0.35;
  parts.push(
    gradient(at(new THREE.BoxGeometry(6.0, base, 3.8), 0, base / 2, bz), "#4e4a5a", "#8a8698"),
  );
  parts.push(
    gradient(at(new THREE.BoxGeometry(1.6, 0.24, 0.35), 0, 0.12, bz + 2.07), "#4e4a5a", "#9894a6"),
  );
  parts.push(
    gradient(at(new THREE.BoxGeometry(1.6, 0.12, 0.35), 0, 0.06, bz + 2.4), "#4e4a5a", "#9894a6"),
  );
  const frontEdge = bz + 2.9;

  // 회벽 몸채
  const W = 5.4;
  const D = 3.0;
  const E = 2.8;
  const zf = bz + D / 2;
  parts.push(
    gradient(
      at(new THREE.BoxGeometry(W, E - base, D), 0, (E + base) / 2, bz),
      PLASTER_LOW,
      PLASTER,
    ),
  );

  // 하프팀버: 기둥·가로대·X 버팀대 (벽보다 살짝 튀어나온 짙은 나무)
  const tz = zf + 0.035;
  const timber = (a: THREE.Vector3, b: THREE.Vector3, w = 0.12) =>
    parts.push(colored(beam(a, b, 0.06, w), TIMBER));
  for (const x of [-2.66, -0.74, 0.74, 2.66]) timber(v3(x, base, tz), v3(x, E, tz), 0.13);
  timber(v3(-2.72, 0.42, tz), v3(2.72, 0.42, tz));
  timber(v3(-2.72, E - 0.06, tz), v3(2.72, E - 0.06, tz), 0.14);
  for (const s of [-1, 1]) {
    const xo = s * 2.6;
    const xi = s * 0.8;
    timber(v3(xo, 0.96, tz), v3(xi, 0.96, tz));
    timber(v3(xo, 2.06, tz), v3(xi, 2.06, tz));
    // 창 아래 X
    timber(v3(xo, 0.46, tz), v3(xi, 0.92, tz), 0.09);
    timber(v3(xo, 0.92, tz), v3(xi, 0.46, tz), 0.09);
    // 창 위 짧은 기둥과 빗대
    timber(v3(s * 1.7, 2.06, tz), v3(s * 1.7, E - 0.06, tz), 0.09);
    timber(v3(xo, 2.1, tz), v3(s * 2.1, E - 0.1, tz), 0.08);
    timber(v3(xi, 2.1, tz), v3(s * 1.3, E - 0.1, tz), 0.08);
    // 옆벽 기둥과 빗대
    const sx = s * (W / 2 + 0.035);
    for (const z of [bz - D / 2 + 0.06, zf - 0.06]) timber(v3(sx, base, z), v3(sx, E, z), 0.13);
    parts.push(colored(beam(v3(sx, 0.5, zf - 0.2), v3(sx, E - 0.1, bz - 0.4), 0.06, 0.1), TIMBER));
  }

  // 창: 불 켜진 유리 + 십자 창살 + 창턱 + 촛불
  for (const s of [-1, 1]) {
    const x = s * 1.7;
    lit.push(colored(at(new THREE.PlaneGeometry(0.78, 0.86), x, 1.5, zf + 0.012), PANE));
    parts.push(colored(at(new THREE.BoxGeometry(0.05, 0.9, 0.05), x, 1.5, zf + 0.05), TIMBER));
    parts.push(colored(at(new THREE.BoxGeometry(0.82, 0.05, 0.05), x, 1.62, zf + 0.05), TIMBER));
    parts.push(colored(at(new THREE.BoxGeometry(0.98, 0.07, 0.16), x, 1.03, zf + 0.08), "#4a352c"));
    glows.push({ x, y: 1.5, z: zf + 0.35, size: 2.3, color: "#ffc35a", flicker: 0.05 });
    // 창가 촛불 둘
    for (const dx of [-0.22, 0.2]) {
      const h = dx < 0 ? 0.16 : 0.11;
      parts.push(
        colored(
          at(new THREE.CylinderGeometry(0.03, 0.03, h, 6), x + dx, 1.07 + h / 2, zf + 0.1),
          "#f4ecd8",
        ),
      );
      lit.push(
        colored(
          at(new THREE.ConeGeometry(0.025, 0.07, 5), x + dx, 1.1 + h + 0.03, zf + 0.1),
          "#ffd166",
        ),
      );
      glows.push({
        x: x + dx,
        y: 1.13 + h,
        z: zf + 0.15,
        size: 0.8,
        color: "#ffb347",
        flicker: 0.35,
      });
    }
  }

  // 아치형 문: 널판 + 쇠 경첩 + 작은 둥근 창 + 돌 테두리
  const doorW = 1.0;
  const doorStraight = 1.25;
  const doorTop = base + doorStraight + doorW / 2;
  {
    const door = new THREE.ExtrudeGeometry(archShape(doorW, doorStraight), {
      depth: 0.06,
      bevelEnabled: false,
      curveSegments: 10,
    });
    parts.push(colored(at(door, 0, base, zf + 0.005), "#5a3426"));
    for (const x of [-0.25, 0, 0.25])
      parts.push(
        colored(
          at(new THREE.BoxGeometry(0.02, doorStraight + 0.35, 0.01), x, base + 0.8, zf + 0.07),
          "#3a2018",
        ),
      );
    for (const y of [0.65, 1.35])
      parts.push(
        colored(at(new THREE.BoxGeometry(0.62, 0.06, 0.02), -0.15, base + y, zf + 0.075), IRON),
      );
    lit.push(colored(at(new THREE.CircleGeometry(0.1, 14), 0, base + 1.42, zf + 0.07), "#ffd58a"));
    parts.push(
      colored(at(new THREE.SphereGeometry(0.035, 6, 4), 0.34, base + 0.85, zf + 0.09), "#e9c46a"),
    );
    const rim = new THREE.TorusGeometry(doorW / 2 + 0.07, 0.07, 4, 12, Math.PI);
    parts.push(colored(at(rim, 0, base + doorStraight, zf + 0.04), "#8f8a9c"));
    for (const sx of [-1, 1])
      parts.push(
        colored(
          at(
            new THREE.BoxGeometry(0.14, doorStraight, 0.08),
            sx * (doorW / 2 + 0.07),
            base + doorStraight / 2,
            zf + 0.04,
          ),
          "#8f8a9c",
        ),
      );
    glows.push({ x: 0, y: base + 1.42, z: zf + 0.2, size: 1.2, color: "#ffc35a", flicker: 0.05 });
  }

  // 별무늬 깔개 (문 앞 기단 위)
  parts.push(
    colored(at(new THREE.BoxGeometry(1.0, 0.02, 0.32), 0, base + 0.01, zf + 0.22), "#4a2a78"),
  );
  for (const [x, r] of [
    [0, 0.11],
    [-0.32, 0.06],
    [0.32, 0.06],
  ] as const) {
    const star = new THREE.ShapeGeometry(starShape(r));
    star.rotateX(-Math.PI / 2);
    parts.push(colored(at(star, x, base + 0.025, zf + 0.22), "#f2d38a"));
  }

  // 큰 박공지붕 (용마루가 x 방향): 처마 z ±1.95, 높이 2.55 → 용마루 5.15
  const eaveY = 2.55;
  const ridgeY = 5.15;
  const half = 3.05;
  const ez = 1.95;
  for (const s of [-1, 1]) {
    parts.push(
      ...slateFace(
        v3(-half, eaveY, bz + s * ez),
        v3(half * 2, 0, 0),
        v3(0, ridgeY - eaveY, -s * ez),
        26,
        12,
        SLATE,
      ),
    );
    // 박공 끝 판재
    for (const sx of [-1, 1])
      parts.push(
        colored(
          beam(
            v3(sx * half, eaveY - 0.04, bz + s * (ez + 0.05)),
            v3(sx * half, ridgeY + 0.02, bz),
            0.1,
            0.18,
          ),
          TRIM,
        ),
      );
    parts.push(
      colored(
        at(new THREE.BoxGeometry(half * 2 + 0.1, 0.1, 0.1), 0, eaveY - 0.02, bz + s * (ez + 0.03)),
        TRIM,
      ),
    );
  }
  parts.push(
    colored(at(new THREE.BoxGeometry(half * 2 + 0.2, 0.16, 0.24), 0, ridgeY + 0.04, bz), TRIM),
  );
  for (const sx of [-1, 1]) {
    parts.push(
      colored(at(new THREE.ConeGeometry(0.07, 0.4, 5), sx * (half + 0.05), ridgeY + 0.3, bz), TRIM),
    );
    // 옆 박공벽 (회벽 오각형)
    const gable = new THREE.Shape([
      new THREE.Vector2(-D / 2, 0),
      new THREE.Vector2(D / 2, 0),
      new THREE.Vector2(D / 2, 0.25),
      new THREE.Vector2(0, ridgeY - E - 0.25),
      new THREE.Vector2(-D / 2, 0.25),
    ]);
    const g = new THREE.ExtrudeGeometry(gable, { depth: 0.08, bevelEnabled: false });
    g.translate(0, 0, -0.04);
    g.rotateY(Math.PI / 2);
    parts.push(colored(at(g, sx * (W / 2 - 0.02), E, bz), PLASTER));
  }

  // 앞으로 나온 작은 박공 (둥근 창). 앞면은 처마보다 살짝 앞
  const zg = bz + ez + 0.1;
  const g0 = 2.64;
  const gp = 4.75;
  const gw = 1.25;
  {
    const tri = new THREE.Shape([
      new THREE.Vector2(-gw, 0),
      new THREE.Vector2(gw, 0),
      new THREE.Vector2(0, gp - g0),
    ]);
    const face = new THREE.ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: false });
    parts.push(colored(at(face, 0, g0, zg - 0.08), PLASTER));
    // 지붕 두 면: 앞 용마루에서 양옆 처마로, 뒤로 큰 지붕까지
    const zBack = bz + 0.2;
    for (const s of [-1, 1]) {
      parts.push(
        ...slateFace(
          v3(s * (gw + 0.22), g0 - 0.14, zg + 0.16),
          v3(0, 0, zBack - zg - 0.16),
          v3(-s * (gw + 0.22), gp - g0 + 0.2, 0),
          8,
          9,
          SLATE,
        ),
      );
      parts.push(
        colored(
          beam(v3(s * (gw + 0.25), g0 - 0.18, zg + 0.18), v3(0, gp + 0.08, zg + 0.18), 0.1, 0.2),
          TRIM,
        ),
      );
    }
    parts.push(colored(at(new THREE.ConeGeometry(0.08, 0.5, 5), 0, gp + 0.3, zg + 0.18), TRIM));
    parts.push(
      colored(at(new THREE.SphereGeometry(0.07, 8, 6), 0, gp - 0.08, zg + 0.2), "#e9c46a"),
    );
    // 박공 골조: 아래 보 + 둥근 창
    parts.push(
      colored(at(new THREE.BoxGeometry(gw * 2 + 0.1, 0.14, 0.1), 0, g0 + 0.02, zg + 0.02), TIMBER),
    );
    for (const sx of [-1, 1])
      parts.push(
        colored(
          beam(v3(sx * 1.0, 2.2, zf + 0.05), v3(sx * 1.05, g0 - 0.02, zg), 0.08, 0.1),
          TIMBER,
        ),
      );
    const wy = 3.48;
    lit.push(colored(at(new THREE.CircleGeometry(0.36, 20), 0, wy, zg + 0.012), "#ffd58a"));
    parts.push(colored(at(new THREE.TorusGeometry(0.39, 0.06, 5, 20), 0, wy, zg + 0.03), TIMBER));
    parts.push(colored(at(new THREE.BoxGeometry(0.05, 0.74, 0.04), 0, wy, zg + 0.04), TIMBER));
    parts.push(colored(at(new THREE.BoxGeometry(0.74, 0.05, 0.04), 0, wy, zg + 0.04), TIMBER));
    glows.push({ x: 0, y: wy, z: zg + 0.3, size: 2.0, color: "#ffc35a", flicker: 0.05 });
  }

  // 굴뚝 (뒤 지붕면) + 연기
  {
    const cx = 1.9;
    const cz = bz - 0.75;
    const brick = new THREE.BoxGeometry(0.56, 2.0, 0.56, 1, 10, 1);
    const g = colored(at(brick, cx, 4.9, cz), "#7a4a3e");
    const pa = g.getAttribute("position");
    const ca = g.getAttribute("color");
    const dark = new THREE.Color("#5e362d");
    for (let i = 0; i < pa.count; i += 3) {
      const y = (pa.getY(i) + pa.getY(i + 1) + pa.getY(i + 2)) / 3;
      if (Math.floor((y - 3.9) / 0.2) % 2 === 0)
        for (let k = 0; k < 3; k++) ca.setXYZ(i + k, dark.r, dark.g, dark.b);
    }
    parts.push(g);
    parts.push(colored(at(new THREE.BoxGeometry(0.7, 0.1, 0.7), cx, 5.92, cz), "#3a2a2a"));
    addSmoke(kit, cx, 6.05, cz);
  }

  // 쇠 간판: 박공 아래 쇠막대에 판이 매달리고, 막대 위 받침에 수정구가 앉는다
  const signY = doorTop + 0.26;
  const signZ = zg + 0.06;
  {
    const barY = signY + 0.26;
    parts.push(colored(at(new THREE.BoxGeometry(1.5, 0.04, 0.04), 0, barY, signZ), IRON));
    for (const sx of [-1, 1]) {
      const curl = new THREE.TorusGeometry(0.08, 0.018, 4, 10, Math.PI * 1.5);
      curl.rotateZ(sx > 0 ? 0 : Math.PI / 2);
      parts.push(colored(at(curl, sx * 0.83, barY - 0.06, signZ), IRON));
      parts.push(
        colored(at(new THREE.BoxGeometry(0.015, 0.1, 0.015), sx * 0.5, barY - 0.06, signZ), IRON),
      );
    }
    // 수정구 받침
    const cradle = new THREE.TorusGeometry(0.12, 0.022, 4, 12);
    cradle.rotateX(Math.PI / 2);
    parts.push(colored(at(cradle, 0, barY + 0.08, signZ), IRON));
    for (const sx of [-1, 1])
      parts.push(
        colored(beam(v3(0, barY, signZ), v3(sx * 0.11, barY + 0.08, signZ), 0.02, 0.02), IRON),
      );
    lit.push(colored(at(new THREE.SphereGeometry(0.15, 16, 12), 0, barY + 0.2, signZ), "#bfe2ff"));
    glows.push({
      x: 0,
      y: barY + 0.2,
      z: signZ + 0.05,
      size: 2.6,
      color: "#7fb8ff",
      flicker: 0.15,
    });
  }

  // 말뚝 울타리 앞뜰 + 라벤더 + 호박
  const fz = bz + 5.0;
  const fx = 6.3;
  for (const s of [-1, 1]) {
    picketFence(parts, s * 1.55, fz, s * fx, fz);
    picketFence(parts, s * fx, fz, s * fx, bz + 1.0);
    // 대문 기둥
    parts.push(
      gradient(
        at(new THREE.BoxGeometry(0.14, 0.95, 0.14), s * 1.5, 0.475, fz),
        "#a9a6b4",
        "#f2efe6",
      ),
    );
    parts.push(colored(at(new THREE.SphereGeometry(0.09, 8, 6), s * 1.5, 1.0, fz), "#f2efe6"));
  }
  for (const [x, z] of [
    [-3.1, -6.0],
    [-4.4, -6.6],
    [-5.4, -5.7],
    [3.3, -5.9],
    [4.6, -6.7],
    [5.5, -5.8],
    [-2.6, -7.6],
    [2.6, -7.6],
  ] as const)
    lavender(parts, x, z);
  pumpkin(parts, -1.55, bz + 2.55, 1.2);
  pumpkin(parts, -1.2, bz + 2.75, 0.8);
  pumpkin(parts, 1.6, bz + 2.6, 1.0);

  const blockers: [number, number, number][] = [
    [-1.4, bz + 2.6, 0.3],
    [1.6, bz + 2.6, 0.25],
  ];
  const blockRects: [number, number, number, number][] = [[-3.2, bz - 2.2, 3.2, frontEdge - 0.1]];
  for (const s of [-1, 1]) {
    blockRects.push([s * 1.5, fz - 0.15, s * fx, fz + 0.15]);
    blockRects.push([s * fx - 0.15, bz + 1.0, s * fx + 0.15, fz]);
  }

  return {
    parts,
    lit,
    glows,
    sign: {
      x: 0,
      y: signY,
      z: signZ + 0.01,
      w: 1.15,
      h: 0.37,
      style: { bgTop: "#3a2366", bgBottom: "#1f1240", border: "#f2d38a", text: "#f6dc97" },
    },
    door: { x: 0, y: 1.3, z: zf + 0.3 },
    frontEdge,
    blockRects,
    blockers,
    clearRects: [[-3.4, bz - 2.4, 3.4, bz + 2.4]],
    pools: [
      { x: 0, z: bz + 3.1, r: 2.2, k: 0.4, color: "#ffc870" },
      { x: 0, z: bz + 2.6, r: 1.0, k: 0.35, color: "#8fc0ff" },
    ],
  };
}
