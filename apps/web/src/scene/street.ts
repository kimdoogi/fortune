/**
 * 점집 거리 장면을 코드로 만든다 (D-029, D-047: 점집마다 거리가 따로, D-065: 밤의 한옥 골목).
 * 정적 배경은 지오메트리를 합치고, 반복 물체는 InstancedMesh로 그린다 (07 §4).
 * 조명은 바닥 버텍스 컬러(빛 웅덩이)와 가산 혼합 점(빛무리)으로 구워 넣는다.
 */
import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { at, colored, gradient, hash, noise, rng } from "./geo";
import { type GlowSpot, glowMaterial, glowPoints } from "./glow";
import { type HanokStyle, buildHanok } from "./hanok";
import { NavGrid, type Point } from "./nav";
import { buildProps } from "./props";
import { buildSky } from "./sky";

export interface ShopTheme extends HanokStyle {
  name: string;
  /** 지평선·안개 색 */
  horizon: string;
  /** 반딧불이 수 */
  fireflies: number;
}

export const THEMES: Record<ShopId, ShopTheme> = {
  saju: {
    name: "사주집",
    roof: "#3c4250",
    wall: "#f3e7cf",
    trim: "#6e4429",
    paper: "#ffcf86",
    horizon: "#3b2d5c",
    fireflies: 24,
  },
  tarot: {
    name: "타로집",
    roof: "#5a3f8f",
    wall: "#ece0ef",
    trim: "#6e4429",
    paper: "#d9b8ff",
    horizon: "#3a2563",
    fireflies: 24,
  },
  dolyeong: {
    name: "아기도령",
    roof: "#a83a35",
    wall: "#f3e7cf",
    trim: "#6e4429",
    paper: "#ffcf86",
    horizon: "#43284f",
    fireflies: 24,
  },
  dream: {
    name: "꿈해몽",
    roof: "#2f7470",
    wall: "#eae3d2",
    trim: "#6e4429",
    paper: "#ffe6b0",
    horizon: "#263a5c",
    fireflies: 60,
  },
};

export interface Street {
  group: THREE.Group;
  nav: NavGrid;
  spawn: Point;
  /** 문 앞 지점. 여기까지 걸어오면 "들어가기"를 묻는다 */
  doorFront: Point;
  /** 탭 판정용: 이 메시를 누르면 문으로 간다 */
  doorTargets: THREE.Object3D[];
  ground: THREE.Mesh;
  fogColor: THREE.Color;
  /** 매 프레임 (불빛 깜빡임, 반딧불이) */
  update(time: number): void;
  /** 그리기 버퍼 높이(px)가 바뀌면 불빛 크기를 맞춘다 */
  setViewportHeight(px: number): void;
  dispose(): void;
}

const lambert = (color: THREE.ColorRepresentation) => new THREE.MeshLambertMaterial({ color });

function setUniform(mat: THREE.ShaderMaterial, key: string, value: number) {
  const u = mat.uniforms[key];
  if (u) u.value = value;
}

const SIGN_FONT = '"Gowun Batang", "AppleMyungjo", "Noto Serif KR", serif';

/** 현판: 짙은 나무 바탕에 금박 글씨 */
function drawSign(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const w = canvas.width;
  const h = canvas.height;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#47291a");
  bg.addColorStop(1, "#2a170d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // 나뭇결
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#000";
  for (let i = 0; i < 14; i++) {
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    const y = (h / 14) * i + 4;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#f2d38a";
  ctx.lineWidth = 7;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.fillStyle = "#f6dc97";
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.font = `700 ${Math.round(h * 0.5)}px ${SIGN_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + 4);
  ctx.shadowColor = "transparent";
}

function signTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 164;
  drawSign(canvas, text);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // 글꼴이 늦게 오면 다시 그린다
  document.fonts?.load(`700 80px ${SIGN_FONT}`).then(() => {
    drawSign(canvas, text);
    tex.needsUpdate = true;
  });
  return tex;
}

/** 석등 하나 (돌 부분은 정적 조각, 불 켜진 화사석은 빛 조각) */
function stoneLantern(
  x: number,
  z: number,
  parts: THREE.BufferGeometry[],
  lit: THREE.BufferGeometry[],
) {
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
}

/** 담장: 돌 몸통 + 기와 갓 (z 방향 또는 x 방향) */
function wall(
  cx: number,
  cz: number,
  length: number,
  alongZ: boolean,
  roofColor: string,
  parts: THREE.BufferGeometry[],
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

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function buildStreet(shop: ShopId): Street {
  const theme = THEMES[shop];
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const rand = rng(shop.length * 97 + 13);

  // 거리 범위: x -9~9, z -14~8. 건물은 북쪽(-z), 캐릭터는 남쪽에서 시작
  const nav = new NavGrid(-9, -14, 9, 8, 0.5);
  const bz = -10;

  const sky = buildSky(theme.horizon);
  group.add(sky.group);
  disposables.push(sky);

  const parts: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const glows: GlowSpot[] = [];
  // 달무리
  const mp = sky.moonPosition;
  glows.push({ x: mp.x, y: mp.y, z: mp.z + 1, size: 16, color: "#cfc8ff", flicker: 0 });

  // 석등 (길 양옆)
  const lanterns: Point[] = [];
  for (const z of [5.2, 1.6, -2.0, -5.4]) lanterns.push({ x: -2.35, z }, { x: 2.35, z });
  for (const l of lanterns) {
    stoneLantern(l.x, l.z, parts, lit);
    glows.push({ x: l.x, y: 0.9, z: l.z, size: 3.0, color: "#ffad55", flicker: 0.1 });
    nav.blockCircle(l.x, l.z, 0.25);
  }

  // 바닥: 풀 얼룩 + 흙길 + 마당 + 등불 빛 웅덩이를 버텍스 컬러로 굽는다
  const groundGeo = track(new THREE.PlaneGeometry(56, 56, 112, 112));
  groundGeo.rotateX(-Math.PI / 2);
  {
    const pos = groundGeo.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    const g1 = new THREE.Color("#2f4a2c");
    const g2 = new THREE.Color("#58793f");
    const dirt = new THREE.Color("#8c7457");
    const yardC = new THREE.Color("#9d8667");
    const warm = new THREE.Color("#ffb066");
    const doorWarm = new THREE.Color(theme.paper);
    const c = new THREE.Color();
    const pools = [
      ...lanterns.map((l) => ({ x: l.x, z: l.z, r: 1.5, k: 0.55, color: warm })),
      { x: 0, z: bz + 3.2, r: 2.4, k: 0.5, color: doorWarm },
    ];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const n = noise(x * 0.3, z * 0.3) * 0.7 + noise(x * 1.3 + 7, z * 1.3) * 0.3;
      c.lerpColors(g1, g2, n);
      // 흙길 (가장자리가 살짝 구불)
      const pathHalf = 1.75 + (noise(z * 0.8, 3) - 0.5) * 0.35;
      c.lerp(dirt, clamp01((pathHalf - Math.abs(x)) / 0.35) * (z > bz + 2 ? 1 : 0));
      // 집 앞 마당
      const yardW =
        clamp01((4.8 - Math.abs(x)) / 0.6) *
        clamp01((z - (bz + 1.8)) / 0.3) *
        clamp01((bz + 4.6 - z) / 0.8);
      c.lerp(yardC, yardW);
      // 빛 웅덩이
      for (const p of pools) {
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
    groundGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  }
  const ground = new THREE.Mesh(
    groundGeo,
    track(new THREE.MeshLambertMaterial({ vertexColors: true })),
  );
  group.add(ground);

  // 디딤돌 (길 위)
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
      parts.push(
        colored(
          at(stone, x, 0.035, z + (rand() - 0.5) * 0.1, rand() * Math.PI),
          new THREE.Color("#a89a80").multiplyScalar(tone),
        ),
      );
    }
  }

  // 담장 (양옆 + 뒤)
  for (const side of [-1, 1]) {
    wall(side * 8.8, -3, 22, true, theme.roof, parts);
    nav.blockRect(side * 8.8 - 0.4, -14, side * 8.8 + 0.4, 8);
  }
  wall(0, -13.8, 18.1, false, theme.roof, parts);

  // 한옥 + 점집 소품
  const hanok = buildHanok(theme, bz);
  parts.push(...hanok.parts);
  lit.push(...hanok.lit);
  glows.push(...hanok.glows);
  nav.blockRect(-3.7, bz - 2.4, 3.7, hanok.frontEdge - 0.1);
  const props = buildProps(shop, bz);
  parts.push(...props.parts);
  lit.push(...props.lit);
  glows.push(...props.glows);
  for (const [x, z, r] of props.blockers) nav.blockCircle(x, z, r);

  // 담장 너머 이웃 지붕 실루엣
  const roofs: [number, number, number, number][] = [
    [-13, -4, 5, 3.5],
    [13.5, -7, 6, 4],
    [-12, -18, 6, 4],
    [5, -19, 7, 4.2],
    [-3, -21, 5, 3.6],
  ];
  for (const [x, z, w, d] of roofs) {
    parts.push(colored(at(new THREE.BoxGeometry(w * 0.75, 2.2, d * 0.7), x, 1.1, z), "#3a3045"));
    const r = new THREE.CylinderGeometry(0.4, w * 0.62, 1.4, 4);
    r.rotateY(Math.PI / 4);
    r.scale(1, 1, d / w);
    parts.push(colored(at(r, x, 2.9, z), "#262033"));
  }

  // 정적 배경 하나로 합치기
  const merged = track(mergeGeometries(parts) as THREE.BufferGeometry);
  for (const g of parts) g.dispose();
  group.add(new THREE.Mesh(merged, track(new THREE.MeshLambertMaterial({ vertexColors: true }))));
  const litMerged = track(mergeGeometries(lit) as THREE.BufferGeometry);
  for (const g of lit) g.dispose();
  group.add(new THREE.Mesh(litMerged, track(new THREE.MeshBasicMaterial({ vertexColors: true }))));

  // 먼 산 (안개 없이 실루엣으로)
  {
    const hills: THREE.BufferGeometry[] = [];
    const ridge: [number, number, number, number, string][] = [
      [-30, -60, 22, 11, "#2b2547"],
      [0, -66, 26, 14, "#2b2547"],
      [28, -58, 20, 9, "#2b2547"],
      [-16, -48, 16, 7, "#221d3a"],
      [18, -46, 15, 6.5, "#221d3a"],
    ];
    for (const [x, z, r, h, c] of ridge) {
      const cone = new THREE.ConeGeometry(r, h, 6, 1);
      cone.scale(1, 1, 0.5);
      hills.push(
        colored(
          at(cone, x, h / 2 - 0.5, z),
          new THREE.Color(c).lerp(new THREE.Color(theme.horizon), 0.15),
        ),
      );
    }
    const hillGeo = track(mergeGeometries(hills) as THREE.BufferGeometry);
    for (const h of hills) h.dispose();
    const hillMesh = new THREE.Mesh(
      hillGeo,
      track(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })),
    );
    hillMesh.renderOrder = -5;
    group.add(hillMesh);
  }

  // 현판
  const sign = new THREE.Mesh(
    track(new THREE.PlaneGeometry(hanok.sign.w, hanok.sign.h)),
    track(new THREE.MeshBasicMaterial({ map: track(signTexture(theme.name)) })),
  );
  sign.position.set(hanok.sign.x, hanok.sign.y, hanok.sign.z);
  group.add(sign);

  // 문 탭 판정용 투명 상자 (문보다 넉넉하게)
  const doorHit = new THREE.Mesh(
    track(new THREE.BoxGeometry(2.4, 2.4, 0.8)),
    track(new THREE.MeshBasicMaterial({ visible: false })),
  );
  doorHit.position.set(hanok.door.x, hanok.door.y, hanok.door.z);
  group.add(doorHit);

  // 나무 (InstancedMesh: 줄기 + 둥근 잎 덩어리 3개)
  const treeSpots: { x: number; z: number; pink: boolean }[] = [
    { x: -6.6, z: -6.3, pink: true },
    { x: 6.6, z: -3.8, pink: false },
    { x: -6.8, z: 0.2, pink: false },
    { x: 6.4, z: 1.6, pink: true },
    { x: -6.2, z: 5.4, pink: false },
    { x: 6.8, z: 5.6, pink: false },
    { x: -5.6, z: -12.4, pink: false },
    { x: 5.8, z: -12.4, pink: true },
  ];
  const trunk = new THREE.InstancedMesh(
    track(new THREE.CylinderGeometry(0.12, 0.2, 1.6, 6)),
    track(lambert("#5a3a26")),
    treeSpots.length,
  );
  const leaves = new THREE.InstancedMesh(
    track(new THREE.IcosahedronGeometry(1, 1)),
    track(new THREE.MeshLambertMaterial({ flatShading: true })),
    treeSpots.length * 3,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const e = new THREE.Euler();
  const greens = ["#3d6b3a", "#4b7c42", "#335c36"].map((c) => new THREE.Color(c));
  const pinks = ["#e7a2bc", "#f1bccd", "#d98fae"].map((c) => new THREE.Color(c));
  const blobs: [number, number, number, number][] = [
    [0, 2.1, 0, 1.15],
    [-0.65, 1.65, 0.2, 0.8],
    [0.6, 1.75, -0.15, 0.85],
  ];
  treeSpots.forEach((t, i) => {
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
      leaves.setColorAt(i * 3 + k, (t.pink ? pinks : greens)[k] as THREE.Color);
    });
    nav.blockCircle(t.x, t.z, 0.45);
  });
  group.add(trunk, leaves);

  // 풀숲과 꽃 (길·마당·집을 피해서)
  const tuftMax = 780;
  const flowerMax = 70;
  const tuft = new THREE.InstancedMesh(
    track(new THREE.ConeGeometry(0.05, 0.3, 3)),
    track(new THREE.MeshLambertMaterial()),
    tuftMax,
  );
  const flowers = new THREE.InstancedMesh(
    track(new THREE.IcosahedronGeometry(0.05, 0)),
    track(new THREE.MeshLambertMaterial()),
    flowerMax,
  );
  const flowerColors = ["#f4f1ea", "#ffd66b", "#f3a3c0", "#c9b6ff"].map((c) => new THREE.Color(c));
  const grassC = new THREE.Color();
  const free = (x: number, z: number) =>
    Math.abs(x) > 2.0 &&
    !(Math.abs(x) < 5.2 && z < bz + 4.6 && z > bz - 3) &&
    Math.abs(x) < 8.4 &&
    z > -13.4 &&
    z < 9;
  let ti = 0;
  let fi = 0;
  for (let tries = 0; tries < 3000 && (ti < tuftMax || fi < flowerMax); tries++) {
    const x = (rand() - 0.5) * 17;
    const z = -13.5 + rand() * 22.5;
    if (!free(x, z)) continue;
    if (ti < tuftMax) {
      for (let k = 0; k < 3 && ti < tuftMax; k++, ti++) {
        q.setFromEuler(e.set((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5));
        const h = 0.7 + rand() * 0.6;
        tuft.setMatrixAt(
          ti,
          m.compose(
            p.set(x + (rand() - 0.5) * 0.2, 0.15 * h, z + (rand() - 0.5) * 0.2),
            q,
            s.set(1, h, 1),
          ),
        );
        tuft.setColorAt(ti, grassC.set("#4f7a3c").multiplyScalar(0.75 + rand() * 0.5));
      }
    } else {
      flowers.setMatrixAt(
        fi,
        m.compose(p.set(x, 0.1, z), q.identity(), s.setScalar(0.8 + rand() * 0.6)),
      );
      flowers.setColorAt(fi, flowerColors[fi % flowerColors.length] as THREE.Color);
      fi++;
    }
  }
  tuft.count = ti;
  flowers.count = fi;
  group.add(tuft, flowers);

  // 빛무리 (모든 등불을 점 하나로)
  const glowMat = track(glowMaterial(0.85));
  const glowPts = glowPoints(glows, glowMat);
  disposables.push(glowPts.geometry);
  group.add(glowPts);

  // 반딧불이
  const ffMat = track(glowMaterial(0.9));
  const ffBase: THREE.Vector3[] = [];
  const ffSpots: GlowSpot[] = [];
  for (let i = 0; i < theme.fireflies; i++) {
    const v = new THREE.Vector3((rand() - 0.5) * 15, 0.4 + rand() * 1.8, -12 + rand() * 19);
    ffBase.push(v);
    ffSpots.push({
      x: v.x,
      y: v.y,
      z: v.z,
      size: 0.32,
      color: shop === "dream" ? "#b8f0ff" : "#e6ff9a",
      flicker: 0.45,
    });
  }
  const ff = glowPoints(ffSpots, ffMat);
  disposables.push(ff.geometry);
  group.add(ff);
  const ffPos = ff.geometry.getAttribute("position") as THREE.BufferAttribute;

  return {
    group,
    nav,
    spawn: { x: 0, z: 6 },
    doorFront: { x: 0, z: hanok.frontEdge + 0.4 },
    doorTargets: [doorHit, sign],
    ground,
    fogColor: new THREE.Color(theme.horizon),
    update(time) {
      setUniform(glowMat, "uTime", time);
      setUniform(ffMat, "uTime", time);
      for (let i = 0; i < ffBase.length; i++) {
        const b = ffBase[i] as THREE.Vector3;
        const ph = i * 1.37;
        ffPos.setXYZ(
          i,
          b.x + Math.sin(time * 0.35 + ph) * 0.9,
          b.y + Math.sin(time * 0.8 + ph * 2) * 0.3,
          b.z + Math.cos(time * 0.3 + ph) * 0.9,
        );
      }
      ffPos.needsUpdate = true;
    },
    setViewportHeight(px) {
      setUniform(glowMat, "uScale", px / 2);
      setUniform(ffMat, "uScale", px / 2);
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
