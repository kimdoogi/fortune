/**
 * 점집 내부 장면 (F04, 06 §6, 08 §1 점집별 내부). 나만의 공간이라 서버 동기화가 없다 (D-007).
 * 방 껍데기(마루, 한지 벽, 머름, 서까래)는 공통이고 점집마다 소품과 색이 다르다 (decor.ts).
 * 정적 배경은 조명을 버텍스 컬러에 구워 MeshBasic 한 덩어리로 그린다 (bake.ts, 07 §3: 드로우콜 60·삼각형 8만 이하).
 * 화면 아래 약 45%는 대사 상자가 덮으므로 점술가 얼굴과 탁자는 위쪽 55% 안에 둔다.
 */
import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { type BakeEnv, bakeLighting } from "./bake";
import { Chibi, type ChibiLook } from "./chibi";
import { DECOR, type Palette } from "./decor";
import { type Kit, box, cushion, newKit } from "./furniture";
import { colored, gradient, hash } from "./geo";
import { glowMaterial, glowPoints } from "./glow";
import { Npc, type NpcAction } from "./npc";

/** 방 크기 (m). 뒷벽이 -z, 카메라는 +z 쪽 */
export const ROOM = { minX: -2.3, maxX: 2.3, minZ: -1.75, maxZ: 3.6, height: 2.55 };
/** 머름(아래 나무판) 높이와 위 인방 높이 */
const WAIN = 0.5;
const BEAM_Y = 2.05;
/** 점술가·탁자·플레이어 자리 */
export const SEATS = {
  npc: { x: 0, z: -0.74 },
  table: { x: 0, z: -0.06, w: 1.36, d: 0.78, h: 0.36 },
  player: { x: -0.42, z: 0.9 },
  cushionH: 0.09,
};

export interface Interior {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  npc: Npc;
  /** 점술가 동작 + 방 안 연출 */
  act(a: NpcAction): void;
  resize(w: number, h: number, pixelRatio: number): void;
  update(dt: number, time: number): void;
  dispose(): void;
}

/** 세로 화면 → 가로 화면 카메라. 사이는 화면비로 섞는다 */
const FRAMING = {
  portrait: { fov: 56, pos: [0.3, 2.15, 2.75], look: [0, 0.05, -0.8] },
  landscape: { fov: 42, pos: [0.75, 1.95, 2.45], look: [-0.05, 0.6, -0.8] },
} as const;

export function cameraFor(aspect: number) {
  // 세로 0.46(375×812) → 0, 가로 1.6 이상 → 1
  const t = Math.max(0, Math.min(1, (aspect - 0.5) / 1.1));
  const p = FRAMING.portrait;
  const l = FRAMING.landscape;
  const mix = (a: readonly number[], b: readonly number[]) =>
    new THREE.Vector3(...a.map((v, i) => v + ((b[i] as number) - v) * t));
  return { fov: p.fov + (l.fov - p.fov) * t, pos: mix(p.pos, l.pos), look: mix(p.look, l.look) };
}

/** 화면 가장자리를 어둡게 하는 비네트 (전체 화면 사각형 하나, 드로우콜 1) */
function vignette(color: string, strength: number) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        vec2 d = (vUv - 0.5) * vec2(1.0, 1.25);
        float a = smoothstep(0.32, 0.85, length(d)) * uStrength;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false;
  m.renderOrder = 100;
  return m;
}

/** 지오메트리에서 조건에 맞는 삼각형을 뺀다 (둥근 창 구멍 등) */
function punch(geo: THREE.BufferGeometry, keep: (x: number, y: number, z: number) => boolean) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const names = Object.keys(g.attributes);
  const src = names.map((n) => g.getAttribute(n) as THREE.BufferAttribute);
  const out: number[][] = names.map(() => []);
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    if (!keep(cx, cy, cz)) continue;
    src.forEach((a, k) => {
      for (let j = 0; j < 3; j++)
        for (let c = 0; c < a.itemSize; c++)
          (out[k] as number[]).push(a.array[(i + j) * a.itemSize + c] as number);
    });
  }
  const res = new THREE.BufferGeometry();
  names.forEach((n, k) =>
    res.setAttribute(
      n,
      new THREE.Float32BufferAttribute(
        out[k] as number[],
        (src[k] as THREE.BufferAttribute).itemSize,
      ),
    ),
  );
  g.dispose();
  if (g !== geo) geo.dispose();
  return res;
}

/** 바닥: 마루(널 방향 z) 또는 장판(네모 종이) */
function floor(kit: Kit, pal: Palette) {
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  const plank = 0.23;
  const nx = pal.floorKind === "plank" ? Math.round(W / plank) * 2 : 46;
  const g = new THREE.PlaneGeometry(W, D, nx, 44);
  g.rotateX(-Math.PI / 2);
  g.translate((ROOM.minX + ROOM.maxX) / 2, 0, (ROOM.minZ + ROOM.maxZ) / 2);
  const f = colored(g, pal.floor);
  const pos = f.getAttribute("position");
  const col = f.getAttribute("color");
  const a = new THREE.Color(pal.floor);
  const b = new THREE.Color(pal.floor2);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    let k: number;
    if (pal.floorKind === "plank") {
      const n = Math.floor((cx - ROOM.minX) / plank);
      // 널마다 이음매 위치가 달라 한 줄 안에서도 색이 바뀐다
      const seam = Math.floor((cz + hash(n, 3) * 2.4) / 2.4);
      k = hash(n, seam);
    } else {
      const s = 0.62;
      k = hash(Math.floor(cx / s), Math.floor(cz / s)) * 0.6 + 0.2;
    }
    c.lerpColors(a, b, k);
    for (let j = 0; j < 3; j++) col.setXYZ(i + j, c.r, c.g, c.b);
  }
  kit.parts.push(f);
  // 널 사이 / 장판 이음 선
  const seam = new THREE.Color(pal.floor2).multiplyScalar(0.55);
  if (pal.floorKind === "plank") {
    for (let x = ROOM.minX + plank; x < ROOM.maxX; x += plank)
      kit.parts.push(
        colored(
          new THREE.BoxGeometry(0.008, 0.002, D).translate(x, 0.001, (ROOM.minZ + ROOM.maxZ) / 2),
          seam,
        ),
      );
  } else {
    const s = 0.62;
    for (let x = Math.ceil(ROOM.minX / s) * s; x < ROOM.maxX; x += s)
      kit.parts.push(
        colored(
          new THREE.BoxGeometry(0.01, 0.002, D).translate(x, 0.001, (ROOM.minZ + ROOM.maxZ) / 2),
          seam,
        ),
      );
    for (let z = Math.ceil(ROOM.minZ / s) * s; z < ROOM.maxZ; z += s)
      kit.parts.push(colored(new THREE.BoxGeometry(W, 0.002, 0.01).translate(0, 0.001, z), seam));
  }
}

/** 벽 하나: 위 한지 + 아래 머름 + 인방. 구멍(창)을 낼 수 있다 */
function wall(
  kit: Kit,
  pal: Palette,
  side: "back" | "left" | "right",
  hole?: (u: number, y: number) => boolean,
) {
  const H = ROOM.height;
  const len = side === "back" ? ROOM.maxX - ROOM.minX : ROOM.maxZ - ROOM.minZ;
  const u0 = side === "back" ? ROOM.minX : ROOM.minZ;
  const place = (g: THREE.BufferGeometry) => {
    if (side === "back") g.translate((ROOM.minX + ROOM.maxX) / 2, 0, ROOM.minZ);
    else {
      g.rotateY(side === "left" ? Math.PI / 2 : -Math.PI / 2);
      g.translate(side === "left" ? ROOM.minX : ROOM.maxX, 0, (ROOM.minZ + ROOM.maxZ) / 2);
    }
    return g;
  };
  // 한지 면: 아래로 갈수록 살짝 짙다
  let paper: THREE.BufferGeometry = new THREE.PlaneGeometry(
    len,
    H - WAIN,
    Math.round(len / 0.12),
    Math.round((H - WAIN) / 0.12),
  );
  paper.translate(0, WAIN + (H - WAIN) / 2, 0);
  paper = gradient(paper, pal.wallLow, pal.wall);
  if (hole) {
    // 월드 좌표(뒷벽은 x, 옆벽은 z)로 구멍 판정. 왼벽은 돌리면 좌우가 뒤집힌다
    const mid = u0 + len / 2;
    paper = punch(paper, (x, y) => !hole(side === "left" ? mid - x : mid + x, y));
  }
  kit.parts.push(place(paper));
  // 머름: 판 + 세로 동자 + 위 띠
  const wain = new THREE.BoxGeometry(len, WAIN, 0.06, Math.round(len / 0.2), 3, 1);
  wain.translate(0, WAIN / 2, 0.03);
  kit.parts.push(place(gradient(wain, pal.woodDark, pal.wood)));
  for (let u = 0.3; u < len; u += 0.6) {
    const st = new THREE.BoxGeometry(0.05, WAIN - 0.04, 0.075, 1, 3, 1);
    st.translate(u - len / 2, WAIN / 2, 0.04);
    kit.parts.push(place(colored(st, pal.woodDark)));
  }
  for (const [y, h] of [
    [WAIN, 0.07],
    [BEAM_Y, 0.12],
    [H - 0.06, 0.12],
  ] as const) {
    const r = new THREE.BoxGeometry(len, h, 0.1, Math.round(len / 0.2), 1, 1);
    r.translate(0, y, 0.05);
    kit.parts.push(place(colored(r, pal.wood)));
  }
}

/** 기둥 (네모, 잘게 나눔) */
function post(kit: Kit, pal: Palette, x: number, z: number) {
  const g = new THREE.BoxGeometry(0.16, ROOM.height, 0.16, 1, 10, 1);
  g.translate(x, ROOM.height / 2, z);
  kit.parts.push(gradient(g, pal.woodDark, pal.wood));
}

/** 옆벽 창호: 달빛이 비치는 창호지 + 띠살 */
function sideWindow(kit: Kit, pal: Palette, side: -1 | 1) {
  const x = side < 0 ? ROOM.minX : ROOM.maxX;
  const z0 = 0.15;
  const z1 = 1.55;
  const y0 = 0.85;
  const y1 = 1.85;
  const paper = new THREE.PlaneGeometry(z1 - z0, y1 - y0);
  paper.rotateY(side < 0 ? Math.PI / 2 : -Math.PI / 2);
  paper.translate(x - side * 0.005, (y0 + y1) / 2, (z0 + z1) / 2);
  kit.lit.push(colored(paper, pal.moonPaper));
  /** 창살 하나 (z 폭 w, 높이 h, 가운데 cz·cy) */
  const bar = (w: number, h: number, cz: number, cy: number) =>
    kit.parts.push(box(0.04, h, w, x - side * 0.03, cy - h / 2, cz, pal.woodDark));
  bar(z1 - z0 + 0.08, 0.06, (z0 + z1) / 2, y0);
  bar(z1 - z0 + 0.08, 0.06, (z0 + z1) / 2, y1);
  for (let i = 0; i <= 6; i++) {
    const cz = z0 + ((z1 - z0) * i) / 6;
    bar(i === 0 || i === 6 || i === 3 ? 0.06 : 0.022, y1 - y0, cz, (y0 + y1) / 2);
  }
  for (const yy of [y0 + 0.25, y0 + 0.5, y0 + 0.75]) bar(z1 - z0, 0.018, (z0 + z1) / 2, yy);
  kit.lights.push({
    x: x - side * 0.4,
    y: 1.35,
    z: (z0 + z1) / 2,
    color: pal.moonLight,
    intensity: 0.35,
    range: 1.2,
  });
}

/** 천장: 어두운 판 + 서까래 + 대들보 */
function ceiling(kit: Kit, pal: Palette) {
  const H = ROOM.height;
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  const c = new THREE.PlaneGeometry(W, D, 16, 18);
  c.rotateX(Math.PI / 2);
  c.translate(0, H, (ROOM.minZ + ROOM.maxZ) / 2);
  kit.parts.push(colored(c, pal.ceiling));
  for (let x = ROOM.minX + 0.2; x < ROOM.maxX; x += 0.32) {
    const r = new THREE.CylinderGeometry(0.035, 0.035, D, 6, 12);
    r.rotateX(Math.PI / 2);
    r.translate(x, H - 0.04, (ROOM.minZ + ROOM.maxZ) / 2);
    kit.parts.push(colored(r, pal.wood));
  }
  const beam = new THREE.BoxGeometry(W, 0.24, 0.22, 20, 1, 1);
  beam.translate(0, H - 0.17, 0.9);
  kit.parts.push(colored(beam, pal.woodDark));
}

/** 궁합(F16): 둘이 나란히 앉는 자리. 초대한 사람이 왼쪽 */
export const PAIR_SEATS = { me: { x: -0.46, z: 0.9 }, partner: { x: 0.46, z: 0.9 } };

export function buildInterior(shop: ShopId, look: ChibiLook, partner?: ChibiLook | null): Interior {
  const decor = DECOR[shop];
  const pal = decor.palette;
  const kit = newKit();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(pal.bg);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 30);

  // 방 껍데기
  floor(kit, pal);
  wall(kit, pal, "back", decor.backHole);
  const win = (u: number, y: number) => u > 0.15 && u < 1.55 && y > 0.85 && y < 1.85;
  wall(kit, pal, "left", win);
  wall(kit, pal, "right", win);
  sideWindow(kit, pal, -1);
  sideWindow(kit, pal, 1);
  for (const x of [ROOM.minX + 0.08, ROOM.maxX - 0.08]) {
    post(kit, pal, x, ROOM.minZ + 0.08);
    post(kit, pal, x, -0.1);
    post(kit, pal, x, 1.95);
  }
  for (const x of [-1.55, 1.55]) post(kit, pal, x, ROOM.minZ + 0.08);
  ceiling(kit, pal);
  // 점집 소품 (탁자·방석 포함)
  decor.build(kit);
  // 궁합: 상대 방석 하나 더 (F16)
  if (partner) cushion(kit, PAIR_SEATS.partner.x, PAIR_SEATS.partner.z, 0.72, "#3c6fd6", "#2a4fa8");

  // 조명 굽기 → 정적 배경 한 덩어리 (빛나는 조각은 굽지 않고 함께 합친다)
  const env: BakeEnv = {
    sky: pal.sky,
    ground: pal.ground,
    lights: kit.lights,
    room: ROOM,
    ao: 0.42,
    shadows: [
      ...kit.shadows,
      { x: SEATS.npc.x, z: SEATS.npc.z, rx: 0.5, rz: 0.45, k: 0.4 },
      { x: SEATS.player.x, z: SEATS.player.z, rx: 0.45, rz: 0.42, k: 0.35 },
    ],
  };
  const baked = mergeGeometries(kit.parts);
  if (!baked) throw new Error("interior merge failed");
  for (const g of kit.parts) g.dispose();
  bakeLighting(baked, env);
  const all = kit.lit.length ? mergeGeometries([baked, ...kit.lit]) : baked;
  if (!all) throw new Error("interior merge failed");
  if (all !== baked) baked.dispose();
  for (const g of kit.lit) g.dispose();
  const staticMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  scene.add(new THREE.Mesh(all, staticMat));
  const owned: { dispose(): void }[] = [all, staticMat, ...kit.disposables];

  // 그림 (병풍·일월오봉도): 텍스처 한 장 + 구운 버텍스 컬러
  if (kit.painted.length) {
    const pg = mergeGeometries(kit.painted);
    if (!pg) throw new Error("painting merge failed");
    for (const g of kit.painted) g.dispose();
    bakeLighting(pg, env);
    const pm = new THREE.MeshBasicMaterial({ vertexColors: true, map: kit.paintedMap });
    scene.add(new THREE.Mesh(pg, pm));
    owned.push(pg, pm);
    if (kit.paintedMap) owned.push(kit.paintedMap);
  }
  for (const o of kit.objects) scene.add(o);

  // 캐릭터용 빛: 등불 쪽 따뜻한 빛 + 창 쪽 차가운 윤곽빛 (그림자 없음)
  scene.add(new THREE.HemisphereLight(pal.hemiSky, pal.hemiGround, 1.25));
  const key = new THREE.DirectionalLight(pal.key, 1.15);
  key.position.set(-1.4, 2.4, 1.6);
  const rim = new THREE.DirectionalLight(pal.rim, 0.7);
  rim.position.set(1.6, 2.0, -2.2);
  scene.add(key, rim);

  // 점술가
  const npc = new Npc(shop);
  npc.root.position.set(SEATS.npc.x, SEATS.cushionH, SEATS.npc.z);
  scene.add(npc.root);
  owned.push(npc);

  // 내 캐릭터: 탁자 앞 방석에 앉아 점술가를 본다 (뒷모습). 궁합이면 둘이 나란히 (F16)
  const seats: [ChibiLook, { x: number; z: number }][] = partner
    ? [
        [look, PAIR_SEATS.me],
        [partner, PAIR_SEATS.partner],
      ]
    : [[look, SEATS.player]];
  const sitters: Chibi[] = [];
  for (const [l, seat] of seats) {
    const c = new Chibi(l).sit().compact();
    sitters.push(c);
    c.root.position.set(seat.x, SEATS.cushionH, seat.z);
    // 점술가 쪽으로 몸을 돌린다
    c.root.rotation.y = Math.atan2(SEATS.npc.x - seat.x, SEATS.npc.z - seat.z);
    scene.add(c.root);
    owned.push(c);
  }

  // 빛무리 + 떠다니는 먼지
  const glowMat = glowMaterial(0.75);
  const glows = glowPoints(kit.glows, glowMat);
  scene.add(glows);
  const dustMat = glowMaterial(0.8);
  const dustBase: THREE.Vector3[] = [];
  for (let i = 0; i < pal.dust; i++) {
    // 점술가 얼굴 앞은 비운다 (양옆이나 뒤쪽에만)
    const side = hash(i, 4) < 0.5 ? -1 : 1;
    const behind = hash(i, 5) < 0.35;
    dustBase.push(
      new THREE.Vector3(
        behind ? (hash(i, 1) - 0.5) * 3.0 : side * (0.65 + hash(i, 1) * 1.1),
        0.4 + hash(i, 2) * 1.8,
        behind ? -1.55 + hash(i, 3) * 0.3 : -1.4 + hash(i, 3) * 2.4,
      ),
    );
  }
  const dust = glowPoints(
    dustBase.map((v) => ({
      x: v.x,
      y: v.y,
      z: v.z,
      size: 0.07 + hash(v.x, v.y) * 0.05,
      color: pal.dustColor,
      flicker: 0.5,
    })),
    dustMat,
  );
  scene.add(dust);
  const dustPos = dust.geometry.getAttribute("position") as THREE.BufferAttribute;
  owned.push(glowMat, glows.geometry, dustMat, dust.geometry);
  const vig = vignette(pal.bg, pal.vignette ?? 0.75);
  scene.add(vig);
  owned.push(vig.geometry, vig.material as THREE.Material);

  const setScale = (px: number) => {
    for (const m of [glowMat, dustMat, ...kit.glowMaterials]) {
      const u = m.uniforms.uScale;
      if (u) u.value = px / 2;
    }
  };

  return {
    scene,
    camera,
    npc,
    act(a) {
      npc.play(a);
      for (const f of kit.onAction) f(a);
    },
    resize(w, h, pr) {
      const f = cameraFor(w / h);
      camera.aspect = w / h;
      camera.fov = f.fov;
      camera.position.copy(f.pos);
      camera.lookAt(f.look);
      camera.updateProjectionMatrix();
      setScale(h * pr);
    },
    update(dt, time) {
      npc.update(dt);
      for (const c of sitters) c.update(dt, false);
      for (const f of kit.updaters) f(dt, time);
      for (const m of [glowMat, dustMat]) {
        const u = m.uniforms.uTime;
        if (u) u.value = time;
      }
      for (let i = 0; i < dustBase.length; i++) {
        const b = dustBase[i] as THREE.Vector3;
        const ph = i * 1.37;
        // 아주 천천히 위로 떠오르며 흔들린다
        const rise = ((time * 0.05 + hash(i, 9)) % 1) * 0.6;
        dustPos.setXYZ(
          i,
          b.x + Math.sin(time * 0.21 + ph) * 0.25,
          b.y + rise + Math.sin(time * 0.5 + ph * 2) * 0.08,
          b.z + Math.cos(time * 0.17 + ph) * 0.2,
        );
      }
      dustPos.needsUpdate = true;
    },
    dispose() {
      for (const o of owned) o.dispose();
      scene.clear();
    },
  };
}
