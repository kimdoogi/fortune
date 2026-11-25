/**
 * 아기도령: 으스스한 신당 초가집 (08 §1 점집별 외관, D-075).
 * 둥글고 덥수룩한 짚 지붕, 흙벽, 기울어진 기둥, 처마 아래 금줄, 문 옆 오방기·천 조각,
 * 마당의 장승 한 쌍·솟대·서낭당 돌무더기. 무섭되 귀엽게 (피·해골 없음).
 */
import * as THREE from "three";
import { at, beam, colored, gradient, hash, noise } from "../geo";
import type { GlowSpot } from "../glow";
import { lattice } from "../hanok";
import { addCrows } from "../street-fx";
import type { Kit } from "../street-kit";
import { deadTree } from "../street-kit";
import { rope } from "./common";
import type { Building } from "./types";

const POST = "#5e4632";
const POST_DARK = "#2e2118";
const STRAW = "#d8b468";
const STRAW_DARK = "#a07a42";
const PAPER = "#f4f1ea";
/** 오방색 (빛바랜) */
const OBANG = ["#c8443a", "#e8c14a", "#3d66b8", "#efe9dc", "#4b9058"];

/** 초가 지붕 모양: 둥근 사각(squircle) 평면 위에 볼록한 높이 */
const SQ = 3;
function squircleR(x: number, z: number, a: number, b: number) {
  return (Math.abs(x / a) ** SQ + Math.abs(z / b) ** SQ) ** (1 / SQ);
}
function thatchY(s: number, h: number) {
  return h * Math.max(0, 1 - s ** 2.2) ** 0.55;
}

/**
 * 둥글고 덥수룩한 초가 지붕. 가운데에서 바깥으로 고리를 늘려 만들고,
 * 맨 바깥 고리는 아래로 처진 짚 끝(들쭉날쭉)이다. 이끼 얼룩은 버텍스 컬러, 새끼줄 그물은 지붕면을 따라가는 막대로 그린다.
 */
function thatchRoof(cx: number, y0: number, cz: number, a: number, b: number, h: number) {
  const K = 12;
  const S = 72;
  const pos: number[] = [];
  const col: number[] = [];
  const straw = new THREE.Color(STRAW);
  const strawDark = new THREE.Color(STRAW_DARK);
  const old = new THREE.Color("#5e4529");
  const moss = new THREE.Color("#56603a");
  const c = new THREE.Color();
  for (let k = 0; k <= K + 1; k++) {
    for (let i = 0; i < S; i++) {
      const th = (i / S) * Math.PI * 2;
      const ct = Math.cos(th);
      const st = Math.sin(th);
      const ex = Math.sign(ct) * Math.abs(ct) ** (2 / SQ);
      const ez = Math.sign(st) * Math.abs(st) ** (2 / SQ);
      let x: number;
      let y: number;
      let z: number;
      if (k <= K) {
        const s = Math.max(0.001, k / K);
        x = a * s * ex;
        z = b * s * ez;
        y = thatchY(s, h) + (noise(x * 2.3 + 4, z * 2.3) - 0.5) * 0.08 * s;
        c.lerpColors(straw, strawDark, noise(x * 1.7, z * 1.7 + 3));
        c.lerp(old, s ** 4 * 0.35);
        if (noise(x * 0.9 + 3, z * 0.9) > 0.7) c.lerp(moss, 0.45);
      } else {
        // 처진 짚 끝: 들쭉날쭉
        const j = hash(i * 0.73, 2.1);
        x = a * (1.04 + j * 0.05) * ex;
        z = b * (1.04 + j * 0.05) * ez;
        y = -0.16 - j * 0.34;
        c.copy(strawDark).lerp(old, 0.5 + j * 0.3);
      }
      pos.push(cx + x, y0 + y, cz + z);
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
  // 바깥쪽이 앞면이 되게 감기 방향을 확인한다 (꼭대기 법선이 위를 향해야 한다)
  const n = geo.getAttribute("normal");
  if ((n.getY(S + 1) as number) < 0) {
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

/** 장승: 나무 기둥에 큰 눈·주먹코·이 드러낸 웃음. 천하대장군은 사모를 쓴다 */
function jangseung(parts: THREE.BufferGeometry[], x: number, z: number, general: boolean) {
  const wood = general ? "#8f6a4c" : "#9e7f60";
  const ink = "#1a1410";
  parts.push(
    gradient(at(new THREE.CylinderGeometry(0.2, 0.24, 1.3, 8), x, 0.65, z), POST_DARK, wood),
  );
  parts.push(colored(at(new THREE.CylinderGeometry(0.28, 0.22, 0.78, 10), x, 1.66, z), wood));
  const fz = z + 0.25;
  // 몸통 글씨 띠 (먹 글자 대신 점 몇 개)
  parts.push(colored(at(new THREE.BoxGeometry(0.15, 0.95, 0.02), x, 0.72, z + 0.22), "#e6dcc6"));
  for (let i = 0; i < 5; i++)
    parts.push(
      colored(at(new THREE.BoxGeometry(0.08, 0.06, 0.012), x, 1.06 - i * 0.17, z + 0.235), ink),
    );
  // 눈: 흰자 + 동그란 눈동자 (살짝 몰려서 귀엽게)
  for (const sx of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.09, 10, 8);
    eye.scale(1, 1.05, 0.5);
    parts.push(colored(at(eye, x + sx * 0.115, 1.76, fz - 0.01), "#f6f1e6"));
    parts.push(
      colored(at(new THREE.SphereGeometry(0.045, 8, 6), x + sx * 0.1, 1.75, fz + 0.03), ink),
    );
    // 치켜 올라간 눈썹
    const brow = new THREE.BoxGeometry(0.17, 0.05, 0.05);
    brow.rotateZ(sx * (general ? -0.4 : -0.2));
    parts.push(colored(at(brow, x + sx * 0.12, 1.9, fz), ink));
    // 볼
    const cheek = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10);
    cheek.rotateX(Math.PI / 2);
    parts.push(colored(at(cheek, x + sx * 0.19, 1.56, fz - 0.03), "#d9655a"));
  }
  // 주먹코
  const nose = new THREE.SphereGeometry(0.07, 8, 6);
  nose.scale(1, 1.25, 0.9);
  parts.push(colored(at(nose, x, 1.62, fz + 0.03), new THREE.Color(wood).multiplyScalar(0.8)));
  // 이 드러낸 웃음
  parts.push(colored(at(new THREE.BoxGeometry(0.3, 0.1, 0.04), x, 1.45, fz - 0.01), "#3a1d16"));
  for (let i = 0; i < 4; i++)
    parts.push(
      colored(
        at(new THREE.BoxGeometry(0.055, 0.05, 0.02), x - 0.09 + i * 0.06, 1.475, fz + 0.015),
        "#f6f1e6",
      ),
    );
  if (general) {
    // 사모: 검은 관 + 양옆 날개
    parts.push(colored(at(new THREE.CylinderGeometry(0.22, 0.25, 0.2, 10), x, 2.14, z), "#1d1a1e"));
    const dome = new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    parts.push(colored(at(dome, x, 2.22, z - 0.04), "#1d1a1e"));
    parts.push(colored(at(new THREE.BoxGeometry(0.7, 0.07, 0.02), x, 2.26, z - 0.12), "#1d1a1e"));
  } else {
    // 여장군: 둥근 정수리 + 붉은 입술
    parts.push(
      colored(
        at(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), x, 2.05, z),
        wood,
      ),
    );
    parts.push(colored(at(new THREE.BoxGeometry(0.32, 0.03, 0.045), x, 1.505, fz), "#c8443a"));
  }
}

/** 솟대: 긴 장대 끝의 나무 새 (옆모습) */
function sotdae(parts: THREE.BufferGeometry[], x: number, z: number, h: number, lean: number) {
  const pole = new THREE.CylinderGeometry(0.035, 0.055, h, 5);
  pole.rotateZ(lean);
  parts.push(gradient(at(pole, x, h / 2, z), POST_DARK, "#7a6048"));
  const tx = x - Math.sin(lean) * h;
  const ty = Math.cos(lean) * h;
  const bird = "#8f7458";
  const body = new THREE.SphereGeometry(0.13, 8, 6);
  body.scale(1.6, 0.7, 0.75);
  parts.push(colored(at(body, tx, ty + 0.07, z), bird));
  parts.push(colored(at(new THREE.SphereGeometry(0.075, 8, 6), tx + 0.2, ty + 0.17, z), bird));
  const beak = new THREE.ConeGeometry(0.03, 0.12, 5);
  beak.rotateZ(-Math.PI / 2);
  parts.push(colored(at(beak, tx + 0.32, ty + 0.16, z), "#5a4634"));
  const tail = new THREE.BoxGeometry(0.16, 0.04, 0.1);
  tail.rotateZ(0.5);
  parts.push(colored(at(tail, tx - 0.24, ty + 0.12, z), bird));
}

/** 서낭당 돌무더기: 층층이 쌓은 막돌 + 새끼줄 고리 */
function stonePile(parts: THREE.BufferGeometry[], x: number, z: number) {
  const tiers: [number, number, number, number][] = [
    [9, 0.55, 0.12, 0.21],
    [6, 0.36, 0.36, 0.19],
    [4, 0.18, 0.58, 0.16],
    [1, 0, 0.78, 0.15],
  ];
  tiers.forEach(([n, r, y, s], t) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.6;
      const stone = new THREE.IcosahedronGeometry(s * (0.85 + hash(i, t) * 0.35), 0);
      stone.scale(1.15, 0.8, 1);
      parts.push(
        colored(
          at(stone, x + Math.cos(a) * r, y, z + Math.sin(a) * r, hash(t, i) * 3),
          new THREE.Color("#7c766e").multiplyScalar(0.7 + hash(i * 3, t) * 0.45),
        ),
      );
    }
  });
  const ring = new THREE.TorusGeometry(0.47, 0.035, 4, 18);
  ring.rotateX(Math.PI / 2);
  parts.push(colored(at(ring, x, 0.3, z), "#a08048"));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    parts.push(
      colored(
        at(
          new THREE.BoxGeometry(0.06, 0.16, 0.01),
          x + Math.cos(a) * 0.49,
          0.2,
          z + Math.sin(a) * 0.49,
          -a + Math.PI / 2,
        ),
        PAPER,
      ),
    );
  }
}

/** 나뭇가지·장대에 매단 낡은 천 조각 */
function clothStrips(
  parts: THREE.BufferGeometry[],
  x: number,
  y: number,
  z: number,
  n: number,
  seed: number,
) {
  for (let i = 0; i < n; i++) {
    const len = 0.35 + hash(seed, i) * 0.4;
    const strip = new THREE.BoxGeometry(0.09, len, 0.012);
    strip.translate(0, -len / 2, 0);
    strip.rotateZ((hash(i, seed) - 0.5) * 0.4);
    strip.rotateY(hash(seed + i, 1) * 3);
    parts.push(
      colored(
        at(strip, x + (i - (n - 1) / 2) * 0.1, y, z),
        new THREE.Color(OBANG[(i + seed) % OBANG.length] as string).multiplyScalar(0.8),
      ),
    );
  }
}

/** 앉아 있는 까마귀 (동글동글, 흰 눈 점) */
function crow(parts: THREE.BufferGeometry[], x: number, y: number, z: number, ry: number) {
  const black = "#17131d";
  const g: THREE.BufferGeometry[] = [];
  const body = new THREE.SphereGeometry(0.13, 8, 6);
  body.scale(0.85, 0.9, 1.2);
  g.push(colored(at(body, 0, 0.12, 0), black));
  g.push(colored(at(new THREE.SphereGeometry(0.085, 8, 6), 0, 0.26, 0.11), black));
  const beak = new THREE.ConeGeometry(0.03, 0.1, 5);
  beak.rotateX(Math.PI / 2);
  g.push(colored(at(beak, 0, 0.25, 0.22), "#4a4450"));
  const tail = new THREE.BoxGeometry(0.1, 0.03, 0.16);
  tail.rotateX(0.4);
  g.push(colored(at(tail, 0, 0.08, -0.18), black));
  for (const sx of [-1, 1])
    g.push(colored(at(new THREE.SphereGeometry(0.02, 6, 4), sx * 0.055, 0.29, 0.17), "#f4efe4"));
  for (const p of g) {
    p.rotateY(ry);
    p.translate(x, y, z);
    parts.push(p);
  }
}

export function buildDolyeong(kit: Kit): Building {
  const { bz } = kit;
  const parts: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const glows: GlowSpot[] = [];

  // 기단: 흙 다짐 + 앞쪽 막돌
  const base = 0.3;
  parts.push(
    gradient(at(new THREE.BoxGeometry(6.2, base, 3.9), 0, base / 2, bz), "#3a3029", "#6e5d4c"),
  );
  for (let i = 0; i < 10; i++) {
    const stone = new THREE.IcosahedronGeometry(0.17, 0);
    stone.scale(1.4, 0.8, 0.6);
    parts.push(
      colored(
        at(stone, -2.9 + i * 0.64, 0.14, bz + 1.95, hash(i, 1)),
        new THREE.Color("#6f6860").multiplyScalar(0.7 + hash(i, 2) * 0.4),
      ),
    );
  }
  // 디딤돌 하나
  parts.push(
    gradient(at(new THREE.BoxGeometry(1.5, 0.16, 0.5), 0, 0.08, bz + 2.25), "#3e3832", "#7a736a"),
  );
  const frontEdge = bz + 2.9;

  // 흙벽
  const W = 5.0;
  const D = 2.7;
  const wallTop = 2.2;
  const zf = bz + D / 2;
  parts.push(
    gradient(
      at(new THREE.BoxGeometry(W, wallTop - base, D), 0, base + (wallTop - base) / 2, bz),
      "#6e5038",
      "#b8946a",
    ),
  );
  // 덧바른 흙 자국
  const patches: [number, number, number, number, string][] = [
    [-2.0, 0.85, 0.5, 0.34, "#977250"],
    [1.95, 1.75, 0.42, 0.3, "#c7a479"],
    [-1.45, 1.95, 0.3, 0.18, "#a57f58"],
    [2.15, 0.72, 0.36, 0.24, "#8a6646"],
  ];
  for (const [x, y, w, h, c] of patches)
    parts.push(colored(at(new THREE.BoxGeometry(w, h, 0.02), x, y, zf + 0.012), c));

  // 기울어진 기둥
  const posts: [number, number][] = [
    [-2.5, 0.05],
    [-0.78, -0.03],
    [0.78, 0.045],
    [2.5, -0.06],
  ];
  for (const [x, tilt] of posts) {
    const post = new THREE.CylinderGeometry(0.11, 0.13, wallTop - base + 0.1, 7);
    post.rotateZ(tilt);
    post.rotateX(tilt * 0.5);
    parts.push(gradient(at(post, x, base + (wallTop - base) / 2, zf + 0.07), POST_DARK, POST));
  }
  // 도리·하인방 (살짝 비뚤게)
  parts.push(
    colored(
      beam(
        new THREE.Vector3(-2.75, 2.15, zf + 0.1),
        new THREE.Vector3(2.75, 2.22, zf + 0.1),
        0.16,
        0.16,
      ),
      "#4a3626",
    ),
  );
  parts.push(
    colored(
      beam(
        new THREE.Vector3(-2.6, 0.42, zf + 0.06),
        new THREE.Vector3(2.6, 0.4, zf + 0.06),
        0.08,
        0.12,
      ),
      "#4a3626",
    ),
  );

  // 문: 붉게 새어 나오는 창호지 + 거친 문살
  const doorH = 1.55;
  const doorY = 0.45 + doorH / 2;
  lit.push(colored(at(new THREE.PlaneGeometry(1.24, doorH), 0, doorY, zf + 0.012), "#ff9a66"));
  for (const x of [-0.31, 0.31])
    parts.push(...lattice(x, doorY, zf + 0.04, 0.6, doorH, 2, 4, "#3a281c"));
  glows.push({ x: 0, y: doorY, z: zf + 0.4, size: 3.6, color: "#ff6a3a", flicker: 0.14 });
  // 문기둥의 부적
  for (const sx of [-1, 1]) {
    parts.push(
      colored(at(new THREE.BoxGeometry(0.13, 0.36, 0.01), sx * 0.8, 1.55, zf + 0.2), "#f0cc4a"),
    );
    parts.push(
      colored(at(new THREE.BoxGeometry(0.04, 0.24, 0.012), sx * 0.8, 1.55, zf + 0.21), "#c62d22"),
    );
  }
  // 왼쪽 창은 불빛, 오른쪽 창은 판자로 막았다
  lit.push(colored(at(new THREE.PlaneGeometry(0.7, 0.55), -1.65, 1.45, zf + 0.012), "#ff9a66"));
  parts.push(...lattice(-1.65, 1.45, zf + 0.04, 0.7, 0.55, 2, 1, "#3a281c"));
  glows.push({ x: -1.65, y: 1.45, z: zf + 0.3, size: 2.0, color: "#ff6a3a", flicker: 0.14 });
  parts.push(
    colored(at(new THREE.BoxGeometry(0.7, 0.55, 0.02), 1.65, 1.45, zf + 0.012), "#1a1210"),
  );
  for (const s of [-1, 1])
    parts.push(
      colored(
        beam(
          new THREE.Vector3(1.3, 1.45 - s * 0.3, zf + 0.05),
          new THREE.Vector3(2.0, 1.45 + s * 0.3, zf + 0.05),
          0.04,
          0.1,
        ),
        "#6a5038",
      ),
    );

  // 초가 지붕 + 용마름 + 처진 짚 가닥
  const ra = 3.55;
  const rb = 2.15;
  const rh = 1.5;
  const ry = wallTop + 0.05;
  parts.push(thatchRoof(0, ry, bz, ra, rb, rh));
  const roofAt = (x: number, z: number) => ry + thatchY(squircleR(x, z, ra, rb), rh);
  {
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= 10; i++) {
      const x = -2.2 + i * 0.44;
      const p = new THREE.Vector3(x, roofAt(x, 0) + 0.04, bz);
      if (prev) parts.push(colored(beam(prev, p, 0.2, 0.16), i % 2 ? "#7a5a30" : "#5e4425"));
      prev = p;
    }
  }
  // 새끼줄 그물: 앞뒤로 넘어가는 줄 + 지붕을 두르는 줄 (보이는 앞쪽 반만)
  const roofRope = (pts: THREE.Vector3[]) => {
    for (let i = 0; i < pts.length - 1; i++)
      parts.push(
        colored(beam(pts[i] as THREE.Vector3, pts[i + 1] as THREE.Vector3, 0.05, 0.05), "#6e5230"),
      );
  };
  for (let x = -2.45; x <= 2.46; x += 0.7) {
    const pts: THREE.Vector3[] = [];
    const zMax = rb * Math.max(0, 1 - Math.abs(x / ra) ** SQ) ** (1 / SQ) * 0.97;
    for (let k = 0; k <= 8; k++) {
      const z = -0.2 + (zMax + 0.2) * (k / 8);
      pts.push(new THREE.Vector3(x, roofAt(x, z) + 0.03, bz + z));
    }
    roofRope(pts);
  }
  for (const s of [0.62, 0.88]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 16; k++) {
      const th = (k / 16) * Math.PI;
      const ct = Math.cos(th);
      const st = Math.sin(th);
      const x = ra * s * Math.sign(ct) * Math.abs(ct) ** (2 / SQ);
      const z = rb * s * Math.sign(st) * Math.abs(st) ** (2 / SQ);
      pts.push(new THREE.Vector3(x, roofAt(x, z) + 0.03, bz + z));
    }
    roofRope(pts);
  }
  for (let i = 0; i < 70; i++) {
    const th = (i / 70) * Math.PI * 2 + hash(i, 9) * 0.08;
    const ct = Math.cos(th);
    const st = Math.sin(th);
    const x = ra * 1.04 * Math.sign(ct) * Math.abs(ct) ** (2 / SQ);
    const z = rb * 1.04 * Math.sign(st) * Math.abs(st) ** (2 / SQ);
    const len = 0.22 + hash(i, 4) * 0.3;
    const strand = new THREE.ConeGeometry(0.07, len, 3);
    strand.rotateX(Math.PI);
    strand.rotateY(hash(i, 5) * 2);
    parts.push(gradient(at(strand, x, ry - 0.2 - len / 2, bz + z), STRAW_DARK, STRAW));
  }

  // 현판: 처마 끝에 매단 흰 판
  const signY = 2.2;
  const signZ = bz + rb * 1.05 + 0.12;
  for (const sx of [-0.55, 0.55])
    parts.push(
      colored(
        at(new THREE.BoxGeometry(0.03, 0.3, 0.03), sx, signY + 0.32, signZ - 0.02),
        "#6b5030",
      ),
    );

  // 금줄: 처마 아래 기둥 사이 + 마당 입구 장승 사이
  const hangPaper = (r: ReturnType<typeof rope>, n: number) => {
    for (let i = 1; i < n; i++) {
      const p = r.at(i / n);
      if (i % 3 === 0) {
        const sprig = new THREE.ConeGeometry(0.05, 0.16, 4);
        sprig.rotateX(Math.PI);
        parts.push(colored(at(sprig, p.x, p.y - 0.1, p.z), "#2f5a35"));
      } else {
        const strip = new THREE.BoxGeometry(0.07, 0.2, 0.01);
        strip.rotateZ((hash(i, n) - 0.5) * 0.3);
        parts.push(colored(at(strip, p.x, p.y - 0.12, p.z), PAPER));
      }
    }
  };
  const eaveRope = rope(-2.5, 2.5, 1.98, zf + 0.3, 0.1, "#b08a4a", 0.05);
  parts.push(...eaveRope.out);
  hangPaper(eaveRope, 16);

  // 장승 한 쌍 (마당 입구)
  const jz = bz + 4.7;
  jangseung(parts, -2.15, jz, true);
  jangseung(parts, 2.15, jz, false);
  const gateRope = rope(-1.95, 1.95, 1.92, jz + 0.02, 0.26, "#b08a4a", 0.045);
  parts.push(...gateRope.out);
  hangPaper(gateRope, 14);

  // 오방기 (문 오른쪽)
  OBANG.forEach((color, i) => {
    const x = 3.45 + i * 0.36;
    const z = bz + 2.35 + (i % 2) * 0.22;
    const tilt = (i - 2) * 0.05;
    const pole = new THREE.CylinderGeometry(0.025, 0.03, 2.1, 6);
    pole.rotateZ(tilt);
    parts.push(colored(at(pole, x, 1.05, z), POST));
    const flag = new THREE.BoxGeometry(0.46, 0.36, 0.015, 4, 1, 1);
    const p = flag.getAttribute("position");
    for (let k = 0; k < p.count; k++)
      p.setZ(k, p.getZ(k) + Math.sin((p.getX(k) + 0.25) * 5) * 0.05);
    flag.computeVertexNormals();
    parts.push(colored(at(flag, x + 0.25, 1.85 + tilt, z), color));
  });

  // 낡은 천 조각 장대 (문 왼쪽)
  {
    const x = -3.55;
    const z = bz + 2.4;
    parts.push(
      gradient(at(new THREE.CylinderGeometry(0.035, 0.045, 2.2, 6), x, 1.1, z), POST_DARK, POST),
    );
    parts.push(colored(at(new THREE.BoxGeometry(0.75, 0.05, 0.05), x, 2.05, z), POST));
    clothStrips(parts, x, 2.03, z, 6, 2);
  }

  // 솟대 둘 (마당 오른쪽)
  sotdae(parts, 5.2, bz + 4.4, 3.6, 0.04);
  sotdae(parts, 5.9, bz + 3.7, 2.9, -0.06);

  // 서낭당: 돌무더기 + 오색 천 매단 서낭나무 (마당 왼쪽)
  stonePile(parts, -4.6, bz + 4.3);
  const tips = deadTree(kit, -5.6, bz + 2.9, 1.15, 7);
  tips.forEach((t, i) => {
    if (i % 2 === 0) clothStrips(parts, t.x, t.y, t.z, 1, i);
  });
  {
    const ringR = new THREE.TorusGeometry(0.17, 0.035, 4, 12);
    ringR.rotateX(Math.PI / 2);
    parts.push(colored(at(ringR, -5.6, 0.95, bz + 2.9), "#b08a4a"));
  }

  // 까마귀: 지붕 위, 장승 사모 위, 서낭나무 가지
  crow(parts, 1.3, roofAt(1.3, 0) - 0.02, bz, -0.4);
  crow(parts, -2.15, 2.3, jz - 0.05, 0.5);
  const perch = tips[3] ?? tips[0];
  if (perch) crow(parts, perch.x, perch.y - 0.04, perch.z, 0.8);
  addCrows(kit, 2.5, 5.6, bz - 3, 3);

  return {
    parts,
    lit,
    glows,
    sign: {
      x: 0,
      y: signY,
      z: signZ,
      w: 1.3,
      h: 0.42,
      style: { bgTop: "#efe6d2", bgBottom: "#cbbd9e", border: "#7a2a22", text: "#8a1f18" },
    },
    door: { x: 0, y: doorY, z: zf + 0.3 },
    frontEdge,
    blockRects: [[-3.4, bz - 2.3, 3.4, frontEdge - 0.1]],
    blockers: [
      [-2.15, jz, 0.3],
      [2.15, jz, 0.3],
      [4.2, bz + 2.45, 0.9],
      [-3.55, bz + 2.4, 0.3],
      [5.2, bz + 4.4, 0.2],
      [5.9, bz + 3.7, 0.2],
      [-4.6, bz + 4.3, 0.75],
    ],
    clearRects: [[-3.8, bz - 2.6, 3.8, bz + 2.6]],
    pools: [{ x: 0, z: bz + 3.0, r: 1.8, k: 0.4, color: "#ff8a5a" }],
  };
}
