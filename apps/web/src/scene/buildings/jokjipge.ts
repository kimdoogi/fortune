/**
 * 족집게집: 장터 골목 점방 (08 §1 점집별 외관, D-100).
 * 황동빛 함석 맞배지붕, 나무 판자벽, 큰 미닫이 유리창(창호지 대신 따뜻한 빛), 처마 아래 큰 돋보기 간판
 * (황동 테두리, 가운데 눈), 문 옆 "용하다" 깃발 천, 처마 끝 전구 줄, 평상과 나무 궤짝.
 * 벽돌 담·전구 줄·젖은 바닥은 거리(street-env, street-kit, street-ground)가 만든다.
 */
import * as THREE from "three";
import { at, beam, colored, gradient, hash } from "../geo";
import type { GlowSpot } from "../glow";
import type { Kit } from "../street-kit";
import { place } from "./common";
import type { Building } from "./types";

const PLANK = "#6e4c34";
const PLANK_DARK = "#4a3222";
const FRAME = "#3a2a1e";
const TIN = "#eab85a";
const TIN_DARK = "#a27a38";
const BRASS = "#e0b45e";
const PANE_LOW = "#ffb45e";
const PANE_TOP = "#ffdc9e";

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** 판자벽: 높이를 판자 줄로 나눠 줄마다 색을 조금씩 다르게 칠한다 (앞·옆면 모두) */
function planked(geo: THREE.BufferGeometry, y0: number, plank: number, seed: number) {
  const g = colored(geo, PLANK);
  const pos = g.getAttribute("position");
  const col = g.getAttribute("color");
  const a = new THREE.Color(PLANK_DARK);
  const b = new THREE.Color(PLANK);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const row = Math.floor((y - y0) / plank);
    c.lerpColors(a, b, 0.45 + hash(row, seed) * 0.55);
    for (let j = 0; j < 3; j++) col.setXYZ(i + j, c.r, c.g, c.b);
  }
  return g;
}

/**
 * 골함석 지붕면: origin에서 u(폭, x 방향)·v(경사) 방향으로 펼친 판. 꼭짓점을 한 칸씩 위아래로
 * 엇갈려 골을 만들고, 골마루는 밝은 황동빛, 골은 어둡게. 판(약 0.9m)마다 색이 조금 다르고
 * 처마 쪽에 녹물이 번진다. 밑면(처마 안쪽)도 어둡게 함께 만든다.
 */
function tinFace(
  origin: THREE.Vector3,
  u: THREE.Vector3,
  v: THREE.Vector3,
  nu: number,
  nv: number,
): THREE.BufferGeometry[] {
  const n = new THREE.Vector3().crossVectors(u, v).normalize();
  if (n.y < 0) n.negate();
  const ridge = new THREE.Color(TIN);
  const groove = new THREE.Color(TIN_DARK);
  const rust = new THREE.Color("#8a4a26");
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const P = (i: number, j: number) =>
    origin
      .clone()
      .addScaledVector(u, i / nu)
      .addScaledVector(v, j / nv)
      .addScaledVector(n, i % 2 === 0 ? 0.025 : -0.025);
  const C = (i: number, j: number) => {
    const sheet = Math.floor(i / 10);
    c.copy(i % 2 === 0 ? ridge : groove).multiplyScalar(0.85 + hash(sheet, 3) * 0.25);
    // 처마 쪽 녹물 (판마다 다르게)
    const r = Math.max(0, 1 - j / (nv * 0.45)) * hash(sheet, 7) * 0.7;
    return c.lerp(rust, r).clone();
  };
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const q = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j],
        [i + 1, j + 1],
        [i, j + 1],
      ] as const;
      for (const [a, b] of q) {
        const p = P(a, b);
        pos.push(p.x, p.y, p.z);
        const cc = C(a, b);
        col.push(cc.r, cc.g, cc.b);
      }
    }
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  top.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const flip = (g: THREE.BufferGeometry) => {
    for (const attr of [g.getAttribute("position"), g.getAttribute("color")]) {
      for (let i = 0; i < attr.count; i += 3) {
        const x = attr.getX(i + 1);
        const y = attr.getY(i + 1);
        const z = attr.getZ(i + 1);
        attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
        attr.setXYZ(i + 2, x, y, z);
      }
    }
  };
  top.computeVertexNormals();
  // 위를 향하게 맞춘다 (평균 법선으로 판단)
  const nrm = top.getAttribute("normal");
  let ny = 0;
  for (let i = 0; i < nrm.count; i++) ny += nrm.getY(i);
  if (ny < 0) {
    flip(top);
    top.computeVertexNormals();
  }
  const under = top.clone();
  under.translate(-n.x * 0.05, -n.y * 0.05, -n.z * 0.05);
  flip(under);
  under.computeVertexNormals();
  return [top, colored(under, "#2e2420")];
}

/** 아몬드 모양 눈 (가운데 원점, 폭 w, 높이 h) */
function almond(w: number, h: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.quadraticCurveTo(0, h, w / 2, 0);
  s.quadraticCurveTo(0, -h, -w / 2, 0);
  return new THREE.ShapeGeometry(s, 10);
}

/** "용하다" 깃발 천 그림 (테스트처럼 DOM이 없으면 만들지 않는다) */
function flagTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 384;
  const draw = () => {
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#f2e8d2";
    ctx.fillRect(0, 0, w, h);
    // 천 결과 얼룩
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#6a4a2a";
    for (let i = 0; i < 40; i++) ctx.fillRect(0, (h / 40) * i, w, 1);
    ctx.globalAlpha = 1;
    // 붉은 테두리 + 아래 술
    ctx.fillStyle = "#b8322a";
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, 0, 10, h);
    ctx.fillRect(w - 10, 0, 10, h);
    ctx.fillRect(0, h - 22, w, 22);
    ctx.fillStyle = "#1e1612";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '700 84px "Gowun Batang", "AppleMyungjo", "Noto Serif KR", serif';
    ["용", "하", "다"].forEach((ch, i) => ctx.fillText(ch, w / 2, 76 + i * 104));
  };
  draw();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  document.fonts?.load('700 80px "Gowun Batang"').then(() => {
    draw();
    tex.needsUpdate = true;
  });
  return tex;
}

/** 문 옆 장대에 매단 "용하다" 깃발: 바람에 천천히 펄럭인다 (드로우콜 1) */
function addFlag(kit: Kit, px: number, pz: number) {
  const W = 0.5;
  const H = 1.45;
  const top = 3.45;
  const geo = kit.track(new THREE.PlaneGeometry(W, H, 5, 8));
  // 장대 쪽(오른쪽 끝)이 x = 0이 되게
  geo.translate(-W / 2 - 0.05, top - H / 2, 0);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const base = Float32Array.from(pos.array as Float32Array);
  const map = flagTexture();
  const mat = kit.track(
    new THREE.MeshLambertMaterial(
      map
        ? { map: kit.track(map), side: THREE.DoubleSide, emissive: "#3a2a20" }
        : { color: "#f2e8d2", side: THREE.DoubleSide },
    ),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(px, 0, pz);
  kit.group.add(mesh);
  kit.updaters.push((t) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3] as number;
      const y = base[i * 3 + 1] as number;
      const far = Math.min(1, -x / W);
      pos.setZ(i, Math.sin(t * 2.2 + x * 6 + y * 1.5) * 0.06 * far);
      pos.setX(i, x + Math.sin(t * 1.3 + y) * 0.015 * far);
    }
    pos.needsUpdate = true;
  });
}

export function buildJokjipge(kit: Kit): Building {
  const { bz } = kit;
  const parts: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const glows: GlowSpot[] = [];

  // 시멘트 기단 + 계단 둘
  const base = 0.36;
  parts.push(
    gradient(at(new THREE.BoxGeometry(6.6, base, 3.9), 0, base / 2, bz), "#4e4a48", "#8a847c"),
  );
  parts.push(
    gradient(at(new THREE.BoxGeometry(1.7, 0.24, 0.35), 0, 0.12, bz + 2.125), "#4e4a48", "#948e84"),
  );
  parts.push(
    gradient(at(new THREE.BoxGeometry(1.7, 0.12, 0.35), 0, 0.06, bz + 2.475), "#4e4a48", "#948e84"),
  );
  const frontEdge = bz + 2.9;

  // 판자벽 몸채 (위는 지붕 밑까지)
  const W = 6.0;
  const D = 3.0;
  const E = 3.44;
  const zf = bz + D / 2;
  parts.push(
    planked(
      at(new THREE.BoxGeometry(W, E - base, D, 1, 16, 1), 0, (E + base) / 2, bz),
      base,
      (E - base) / 16,
      2,
    ),
  );
  // 모서리·문설주 기둥, 아래 굽도리
  for (const x of [-2.98, -0.72, 0.72, 2.98])
    parts.push(
      colored(at(new THREE.BoxGeometry(0.16, E - base, 0.12), x, (E + base) / 2, zf + 0.04), FRAME),
    );
  parts.push(
    colored(at(new THREE.BoxGeometry(W + 0.04, 0.16, 0.06), 0, base + 0.08, zf + 0.03), FRAME),
  );
  parts.push(
    colored(at(new THREE.BoxGeometry(W + 0.04, 0.1, 0.08), 0, E - 0.08, zf + 0.04), FRAME),
  );

  // 큰 미닫이 유리창 둘: 따뜻한 빛 + 두 짝 창틀(살짝 엇갈림) + 안쪽 실루엣
  const wy0 = 0.82;
  const wy1 = 2.1;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -2.72 : 0.98;
    const x1 = s < 0 ? -0.98 : 2.72;
    const cx = (x0 + x1) / 2;
    const ww = x1 - x0;
    const wh = wy1 - wy0;
    lit.push(
      gradient(
        at(new THREE.PlaneGeometry(ww, wh, 1, 2), cx, (wy0 + wy1) / 2, zf + 0.012),
        PANE_LOW,
        PANE_TOP,
      ),
    );
    // 안쪽 실루엣 (유리 너머 선반과 물건)
    const sil = "#5a3420";
    if (s < 0) {
      parts.push(
        colored(at(new THREE.BoxGeometry(ww - 0.1, 0.04, 0.004), cx, 1.38, zf + 0.016), sil),
      );
      for (const [dx, w, h] of [
        [-0.62, 0.14, 0.24],
        [-0.42, 0.1, 0.16],
        [-0.12, 0.2, 0.3],
        [0.2, 0.12, 0.2],
        [0.52, 0.16, 0.12],
      ] as const)
        parts.push(
          colored(at(new THREE.BoxGeometry(w, h, 0.004), cx + dx, 1.4 + h / 2, zf + 0.016), sil),
        );
      // 아래: 책 더미
      for (let k = 0; k < 4; k++)
        parts.push(
          colored(
            at(
              new THREE.BoxGeometry(0.34 - k * 0.04, 0.06, 0.004),
              cx - 0.45,
              0.92 + k * 0.065,
              zf + 0.016,
            ),
            sil,
          ),
        );
    } else {
      // 오른쪽: 매달린 안경·돋보기 그림자
      for (const [dx, r] of [
        [-0.5, 0.1],
        [0.1, 0.14],
        [0.55, 0.08],
      ] as const) {
        const ring = new THREE.TorusGeometry(r, 0.018, 4, 14);
        parts.push(colored(at(ring, cx + dx, 1.62, zf + 0.016), sil));
        parts.push(
          colored(
            at(
              new THREE.BoxGeometry(0.02, 0.32 - r, 0.004),
              cx + dx,
              1.62 + r + (0.32 - r) / 2,
              zf + 0.016,
            ),
            sil,
          ),
        );
      }
      for (const dx of [-0.08, 0.08])
        parts.push(
          colored(
            at(new THREE.TorusGeometry(0.06, 0.012, 4, 12), cx - 0.2 + dx, 1.2, zf + 0.016),
            sil,
          ),
        );
    }
    // 창틀: 바깥 틀 + 두 짝 (오른짝을 살짝 앞에)
    parts.push(
      colored(at(new THREE.BoxGeometry(ww + 0.12, 0.08, 0.1), cx, wy0 - 0.02, zf + 0.05), FRAME),
    );
    parts.push(
      colored(at(new THREE.BoxGeometry(ww + 0.12, 0.08, 0.08), cx, wy1 + 0.02, zf + 0.04), FRAME),
    );
    for (const half of [0, 1]) {
      const hx0 = x0 + (ww / 2) * half - (half ? 0.03 : 0);
      const hx1 = hx0 + ww / 2 + 0.03;
      const zz = zf + 0.03 + half * 0.025;
      for (const x of [hx0, hx1])
        parts.push(
          colored(at(new THREE.BoxGeometry(0.06, wh, 0.03), x, (wy0 + wy1) / 2, zz), FRAME),
        );
      // 살: 세로 하나, 가로 둘
      parts.push(
        colored(
          at(new THREE.BoxGeometry(0.03, wh, 0.025), (hx0 + hx1) / 2, (wy0 + wy1) / 2, zz),
          FRAME,
        ),
      );
      for (const y of [wy0 + wh / 3, wy0 + (2 * wh) / 3])
        parts.push(
          colored(at(new THREE.BoxGeometry(hx1 - hx0, 0.03, 0.025), (hx0 + hx1) / 2, y, zz), FRAME),
        );
    }
    // 창턱
    parts.push(
      colored(at(new THREE.BoxGeometry(ww + 0.2, 0.05, 0.2), cx, wy0 - 0.08, zf + 0.1), "#5a3c28"),
    );
    glows.push({ x: cx - ww / 4, y: 1.5, z: zf + 0.4, size: 2.4, color: "#ffb860", flicker: 0.04 });
    glows.push({ x: cx + ww / 4, y: 1.5, z: zf + 0.4, size: 2.4, color: "#ffb860", flicker: 0.04 });
  }

  // 유리 미닫이 문: 빛나는 유리 + 나무 문틀 + 가로살 + 손잡이
  const doorW = 1.1;
  const doorH = 1.95;
  lit.push(
    gradient(
      at(new THREE.PlaneGeometry(doorW, doorH, 1, 2), 0, base + doorH / 2, zf + 0.012),
      PANE_LOW,
      PANE_TOP,
    ),
  );
  for (const x of [-doorW / 2, 0, doorW / 2])
    parts.push(
      colored(at(new THREE.BoxGeometry(0.07, doorH, 0.04), x, base + doorH / 2, zf + 0.03), FRAME),
    );
  for (const y of [0.05, 0.62, 1.25, doorH - 0.03])
    parts.push(
      colored(
        at(new THREE.BoxGeometry(doorW, y < 0.1 ? 0.1 : 0.04, 0.04), 0, base + y, zf + 0.03),
        FRAME,
      ),
    );
  for (const s of [-1, 1])
    parts.push(
      colored(at(new THREE.BoxGeometry(0.03, 0.14, 0.03), s * 0.08, base + 0.95, zf + 0.06), BRASS),
    );
  glows.push({ x: 0, y: base + 1.1, z: zf + 0.5, size: 3.2, color: "#ffc070", flicker: 0.04 });

  // 현판 받침 (문 위)
  const signY = 2.8;
  parts.push(colored(at(new THREE.BoxGeometry(1.62, 0.54, 0.05), 0, signY, zf + 0.035), "#2a1a10"));

  // 맞배지붕 (용마루가 x 방향): 처마 z ±2.35 높이 3.05 → 용마루 4.25
  const eaveY = 3.05;
  const ridgeY = 4.25;
  const half = 3.45;
  const ez = 2.35;
  for (const s of [-1, 1]) {
    parts.push(
      ...tinFace(
        v3(-half, eaveY, bz + s * ez),
        v3(half * 2, 0, 0),
        v3(0, ridgeY - eaveY, -s * ez),
        72,
        7,
      ),
    );
    // 박공널
    for (const sx of [-1, 1])
      parts.push(
        colored(
          beam(
            v3(sx * (half + 0.02), eaveY - 0.06, bz + s * (ez + 0.04)),
            v3(sx * (half + 0.02), ridgeY + 0.02, bz),
            0.08,
            0.16,
          ),
          FRAME,
        ),
      );
    // 처마 끝 함석 물받이
    const gutter = new THREE.CylinderGeometry(0.05, 0.05, half * 2 + 0.1, 8, 1, false, 0, Math.PI);
    gutter.rotateZ(Math.PI / 2);
    gutter.rotateX(Math.PI / 2);
    parts.push(colored(at(gutter, 0, eaveY - 0.04, bz + s * (ez + 0.04)), "#9a8a6a"));
  }
  // 용마루 덮개
  {
    const cap = new THREE.CylinderGeometry(0.1, 0.1, half * 2 + 0.1, 10, 1, false, 0, Math.PI);
    cap.rotateZ(Math.PI / 2);
    parts.push(colored(at(cap, 0, ridgeY - 0.02, bz), "#b88a3e"));
  }
  // 옆 박공벽 (판자 오각형)
  for (const sx of [-1, 1]) {
    const roofAtWall = eaveY + (ridgeY - eaveY) * ((ez - D / 2) / ez);
    const gable = new THREE.Shape([
      new THREE.Vector2(-D / 2, 0),
      new THREE.Vector2(D / 2, 0),
      new THREE.Vector2(D / 2, roofAtWall - E),
      new THREE.Vector2(0, ridgeY - E - 0.05),
      new THREE.Vector2(-D / 2, roofAtWall - E),
    ]);
    const g = new THREE.ExtrudeGeometry(gable, { depth: 0.06, bevelEnabled: false });
    g.translate(0, 0, -0.03);
    g.rotateY(Math.PI / 2);
    parts.push(colored(at(g, sx * (W / 2 - 0.02), E, bz), "#5e4230"));
  }
  // 처마 끝 전구 줄
  {
    const zz = bz + ez + 0.06;
    const pt = (t: number) => v3(-3.3 + 6.6 * t, eaveY - 0.08 - 0.14 * 4 * t * (1 - t), zz);
    for (let k = 0; k < 12; k++)
      parts.push(colored(beam(pt(k / 12), pt((k + 1) / 12), 0.016, 0.016), "#1e1a18"));
    for (let k = 1; k < 12; k++) {
      const p = pt(k / 12);
      const bulb = new THREE.SphereGeometry(0.05, 7, 5);
      bulb.scale(1, 1.25, 1);
      lit.push(colored(at(bulb, p.x, p.y - 0.1, p.z), k % 3 === 0 ? "#ffd08a" : "#ffe6b0"));
      glows.push({ x: p.x, y: p.y - 0.1, z: p.z, size: 1.1, color: "#ffb25a", flicker: 0.05 });
    }
  }

  // 큰 돋보기 간판: 처마에 쇠사슬로 매단 황동 테 + 빛나는 렌즈 + 가운데 눈 + 손잡이
  {
    const mx = 1.78;
    const my = 2.36;
    const mz = zf + 0.55;
    const r = 0.36;
    const roofY = eaveY + (ridgeY - eaveY) * ((bz + ez - mz) / ez);
    for (const dx of [-0.2, 0.2])
      parts.push(
        colored(
          beam(v3(mx + dx * 0.6, my + r * 0.9, mz), v3(mx + dx, roofY, mz), 0.015, 0.015),
          "#2a2420",
        ),
      );
    lit.push(gradient(at(new THREE.CircleGeometry(r, 28), mx, my, mz), "#ffd896", "#fff2d2"));
    parts.push(
      colored(at(new THREE.TorusGeometry(r + 0.02, 0.05, 8, 32), mx, my, mz + 0.01), BRASS),
    );
    parts.push(
      colored(at(new THREE.TorusGeometry(r + 0.075, 0.015, 4, 32), mx, my, mz), "#a87a30"),
    );
    // 눈: 짙은 테두리 → 흰자 → 홍채 → 눈동자 → 반짝이
    lit.push(colored(at(almond(0.5, 0.36), mx, my, mz + 0.012), "#2a1a10"));
    lit.push(colored(at(almond(0.44, 0.29), mx, my, mz + 0.016), "#fffaf0"));
    lit.push(colored(at(new THREE.CircleGeometry(0.085, 18), mx, my, mz + 0.02), "#6a4424"));
    lit.push(colored(at(new THREE.CircleGeometry(0.045, 14), mx, my, mz + 0.024), "#140c08"));
    lit.push(
      colored(at(new THREE.CircleGeometry(0.018, 8), mx + 0.03, my + 0.03, mz + 0.028), "#ffffff"),
    );
    // 속눈썹 세 가닥
    for (const a of [-0.5, 0, 0.5])
      parts.push(
        colored(
          beam(
            v3(mx + Math.sin(a) * 0.16, my + 0.13, mz + 0.03),
            v3(mx + Math.sin(a) * 0.22, my + 0.2, mz + 0.03),
            0.012,
            0.012,
          ),
          "#2a1a10",
        ),
      );
    // 손잡이 (오른쪽 아래로)
    const a = -0.72;
    const h0 = v3(mx + Math.cos(a) * (r + 0.06), my + Math.sin(a) * (r + 0.06), mz);
    const h1 = v3(mx + Math.cos(a) * (r + 0.2), my + Math.sin(a) * (r + 0.2), mz);
    const h2 = v3(mx + Math.cos(a) * (r + 0.66), my + Math.sin(a) * (r + 0.66), mz);
    parts.push(colored(beam(h0, h1, 0.07, 0.07), BRASS));
    parts.push(colored(beam(h1, h2, 0.1, 0.1), "#5a3420"));
    parts.push(colored(at(new THREE.SphereGeometry(0.06, 8, 6), h2.x, h2.y, h2.z), BRASS));
    glows.push({ x: mx, y: my, z: mz + 0.2, size: 2.6, color: "#ffd890", flicker: 0.05 });
  }

  // "용하다" 깃발: 문 옆 대나무 장대
  const fx = -1.28;
  const fz = bz + 2.85;
  parts.push(
    gradient(
      at(new THREE.CylinderGeometry(0.035, 0.05, 3.7, 7), fx, 1.85, fz),
      "#6a5a2a",
      "#b8a060",
    ),
  );
  for (const y of [0.8, 1.6, 2.4, 3.2])
    parts.push(colored(at(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 7), fx, y, fz), "#7a6a32"));
  parts.push(colored(beam(v3(fx, 3.47, fz), v3(fx - 0.62, 3.47, fz), 0.025, 0.025), "#7a6a32"));
  parts.push(
    gradient(at(new THREE.BoxGeometry(0.3, 0.12, 0.3), fx, 0.06, fz), "#3a3634", "#6a6460"),
  );
  addFlag(kit, fx, fz);

  // 평상 (마당 오른쪽): 판자 상판 + 다리 + 돗자리, 노란 양은 주전자와 사발 둘
  const px = 3.95;
  const pz = bz + 4.0;
  {
    const top = new THREE.BoxGeometry(2.0, 0.08, 1.2, 10, 1, 1);
    parts.push(planked(at(top, px, 0.46, pz), 0, 1, 5));
    for (let i = 0; i < 10; i++)
      parts.push(
        colored(
          at(new THREE.BoxGeometry(0.012, 0.005, 1.2), px - 1 + i * 0.2, 0.503, pz),
          PLANK_DARK,
        ),
      );
    for (const sx of [-1, 0, 1])
      for (const sz of [-1, 1])
        parts.push(
          colored(
            at(new THREE.BoxGeometry(0.08, 0.42, 0.08), px + sx * 0.9, 0.21, pz + sz * 0.52),
            FRAME,
          ),
        );
    parts.push(colored(at(new THREE.BoxGeometry(1.1, 0.01, 0.8), px + 0.25, 0.51, pz), "#c9b07a"));
    // 양은 주전자
    const kx = px + 0.1;
    const kz = pz - 0.05;
    parts.push(
      gradient(
        at(new THREE.CylinderGeometry(0.1, 0.13, 0.17, 12), kx, 0.6, kz),
        "#a8862e",
        "#e8c860",
      ),
    );
    parts.push(
      colored(at(new THREE.CylinderGeometry(0.06, 0.09, 0.04, 12), kx, 0.705, kz), "#e8c860"),
    );
    parts.push(colored(at(new THREE.SphereGeometry(0.02, 6, 4), kx, 0.735, kz), "#a8862e"));
    parts.push(
      colored(beam(v3(kx + 0.1, 0.58, kz), v3(kx + 0.22, 0.68, kz), 0.025, 0.025), "#d8b850"),
    );
    const handle = new THREE.TorusGeometry(0.09, 0.01, 4, 12, Math.PI);
    parts.push(colored(at(handle, kx, 0.69, kz, Math.PI / 2), "#a8862e"));
    for (const [dx, dz] of [
      [0.42, 0.15],
      [0.55, -0.12],
    ] as const) {
      const bowl = new THREE.CylinderGeometry(0.075, 0.045, 0.06, 12);
      parts.push(gradient(at(bowl, px + dx, 0.545, pz + dz), "#bfb8a8", "#f4f0e6"));
      const drink = new THREE.CircleGeometry(0.065, 12);
      drink.rotateX(-Math.PI / 2);
      parts.push(colored(at(drink, px + dx, 0.572, pz + dz), "#e8e2cc"));
    }
    // 접어 둔 방석
    parts.push(
      gradient(
        at(new THREE.BoxGeometry(0.42, 0.08, 0.42), px - 0.6, 0.55, pz + 0.1),
        "#7a2a2a",
        "#a84a3a",
      ),
    );
  }

  // 나무 궤짝 (마당 왼쪽): 둘을 놓고 하나를 올린다. 맨 위는 뚜껑이 없고 사과가 담겼다
  const cx0 = -3.95;
  const cz0 = bz + 3.9;
  {
    const crate = (x: number, y: number, z: number, ry: number, open: boolean) => {
      const out: THREE.BufferGeometry[] = [];
      const w = 0.72;
      const h = 0.42;
      const d = 0.5;
      out.push(colored(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), "#5a3e26"));
      for (const y0 of [0.08, 0.21, 0.34]) {
        out.push(
          colored(new THREE.BoxGeometry(w + 0.02, 0.09, d + 0.02).translate(0, y0, 0), "#9a7448"),
        );
      }
      for (const sx of [-1, 1])
        out.push(
          colored(
            new THREE.BoxGeometry(0.05, h, d + 0.03).translate(sx * (w / 2 - 0.02), h / 2, 0),
            "#6a4a2e",
          ),
        );
      if (open)
        for (let k = 0; k < 6; k++) {
          const ax = -0.22 + (k % 3) * 0.22;
          const az = k < 3 ? -0.1 : 0.1;
          out.push(
            colored(
              new THREE.SphereGeometry(0.085, 8, 6).translate(ax, h - 0.02 + (k % 2) * 0.02, az),
              k % 4 === 0 ? "#c84a2a" : "#b8322a",
            ),
          );
        }
      return place(out, x, y, z, ry);
    };
    parts.push(...crate(cx0 - 0.38, 0, cz0, 0.05, false));
    parts.push(...crate(cx0 + 0.4, 0, cz0 + 0.05, -0.08, false));
    parts.push(...crate(cx0, 0.43, cz0, 0.12, true));
  }

  return {
    parts,
    lit,
    glows,
    sign: {
      x: 0,
      y: signY,
      z: zf + 0.065,
      w: 1.5,
      h: 0.44,
      style: { bgTop: "#3a2614", bgBottom: "#1e120a", border: BRASS, text: "#ffe0a0" },
    },
    door: { x: 0, y: 1.3, z: zf + 0.3 },
    steps: [
      [bz + 2.65, 0.12],
      [bz + 2.3, 0.24],
      [bz + 1.95, base],
    ],
    doorway: {
      z: zf + 0.012,
      shape: "rect",
      w: doorW,
      h: doorH,
      y0: base,
      leaves: 2,
      leaf: "#ffcf86",
      frame: FRAME,
      paper: true,
    },
    frontEdge,
    blockRects: [[-3.4, bz - 2.2, 3.4, frontEdge - 0.1]],
    blockers: [
      [cx0, cz0, 0.75],
      [px, pz, 1.15],
      [fx, fz, 0.15],
    ],
    clearRects: [
      [-3.7, bz - 2.4, 3.7, bz + 2.6],
      [cx0 - 0.9, cz0 - 0.6, cx0 + 0.9, cz0 + 0.6],
      [px - 1.2, pz - 0.8, px + 1.2, pz + 0.8],
    ],
    pools: [
      { x: 0, z: bz + 3.0, r: 2.4, k: 0.55, color: "#ffb860" },
      { x: -1.85, z: bz + 2.4, r: 1.4, k: 0.35, color: "#ffb860" },
      { x: 1.85, z: bz + 2.4, r: 1.4, k: 0.35, color: "#ffb860" },
    ],
  };
}
