/**
 * 점집 거리 장면을 코드로 만든다 (D-029, D-047: 점집마다 거리가 따로, D-065: 밤 골목, D-075: 점집마다 다른 건물·분위기).
 * 건물은 buildings/, 거리 분위기 설정은 street-env.ts, 배경 조각은 street-kit.ts·street-ground.ts·street-fx.ts.
 * 정적 배경은 지오메트리를 합치고, 반복 물체는 InstancedMesh로 그린다 (07 §4).
 * 조명은 바닥 버텍스 컬러(빛 웅덩이)와 가산 혼합 점(빛무리)으로 구워 넣는다.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildBuilding } from "./buildings";
import type { WishTree } from "./buildings/tree";
import type { SignStyle } from "./buildings/types";
import { type DoorAnim, buildDoorAnim } from "./door-anim";
import { rng } from "./geo";
import { type GlowSpot, glowMaterial, glowPoints } from "./glow";
import { NavGrid, type Point } from "./nav";
import { buildSky } from "./sky";
import { type PlaceId, STREET_ENVS, type StreetLighting } from "./street-env";
import { addMist } from "./street-fx";
import { buildGround, buildPath } from "./street-ground";
import {
  type Kit,
  buildHills,
  placeBorder,
  placeLamps,
  placeNeighbors,
  placeTrees,
} from "./street-kit";

export type { StreetLighting } from "./street-env";

export interface Street {
  group: THREE.Group;
  nav: NavGrid;
  spawn: Point;
  /** 문 앞 지점. 여기까지 걸어오면 "들어가기"를 묻는다 */
  doorFront: Point;
  /** 탭 판정용: 이 메시를 누르면 문으로 간다 */
  doorTargets: THREE.Object3D[];
  /** 들어갈 때 여는 문 (D-094) */
  door: DoorAnim;
  /** 문 안쪽 한 걸음 (여기까지 걸어 들어가며 사라진다) */
  doorInside: Point;
  /** 당산나무만: 오색 천·돌탑 (F18) */
  wishTree: WishTree | null;
  /** 그 자리 발밑 높이: 문 앞 계단·기단을 밟고 올라간다 (평소 길은 0) */
  groundAt(z: number): number;
  ground: THREE.Mesh;
  fogColor: THREE.Color;
  /** 안개 시작·끝 거리 (없으면 16~44) */
  fogRange?: [number, number];
  /** 반구광·방향광 색 (없으면 사주집 기본값) */
  lighting?: StreetLighting;
  /** 매 프레임 (불빛 깜빡임, 반딧불이, 안개·구름 등) */
  update(time: number): void;
  /** 그리기 버퍼 높이(px)가 바뀌면 불빛 크기를 맞춘다 */
  setViewportHeight(px: number): void;
  dispose(): void;
}

function setUniform(mat: THREE.ShaderMaterial, key: string, value: number) {
  const u = mat.uniforms[key];
  if (u) u.value = value;
}

const SIGN_FONT = '"Gowun Batang", "AppleMyungjo", "Noto Serif KR", serif';

/** 현판 기본: 짙은 나무 바탕에 금박 글씨 */
const SIGN_DEFAULT: SignStyle = {
  bgTop: "#47291a",
  bgBottom: "#2a170d",
  border: "#f2d38a",
  text: "#f6dc97",
};

function drawSign(canvas: HTMLCanvasElement, text: string, style: SignStyle) {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const w = canvas.width;
  const h = canvas.height;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, style.bgTop);
  bg.addColorStop(1, style.bgBottom);
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
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 7;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.fillStyle = style.text;
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.font = `700 ${Math.round(h * 0.5)}px ${SIGN_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + 4);
  ctx.shadowColor = "transparent";
}

/** 현판 텍스처 (테스트처럼 DOM이 없으면 만들지 않는다) */
function signTexture(text: string, style: SignStyle): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 164;
  drawSign(canvas, text, style);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // 글꼴이 늦게 오면 다시 그린다
  document.fonts?.load(`700 80px ${SIGN_FONT}`).then(() => {
    drawSign(canvas, text, style);
    tex.needsUpdate = true;
  });
  return tex;
}

export function buildStreet(shop: PlaceId): Street {
  const env = STREET_ENVS[shop];
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };

  // 거리 범위: x -9~9, z -14~8. 건물은 북쪽(-z), 캐릭터는 남쪽에서 시작
  const nav = new NavGrid(-9, -14, 9, 8, 0.5);
  const bz = -10;
  const kit: Kit = {
    bz,
    parts: [],
    lit: [],
    glows: [],
    pools: [],
    nav,
    rand: rng(shop.length * 97 + 13),
    group,
    track,
    updaters: [],
    noGrass: [],
  };
  const { parts, lit, glows } = kit;

  const sky = buildSky(env.sky);
  group.add(sky.group);
  disposables.push(sky);
  // 달무리
  const mp = sky.moonPosition;
  glows.push({
    x: mp.x,
    y: mp.y,
    z: mp.z + 1,
    size: env.halo.size,
    color: env.halo.color,
    flicker: 0,
  });

  // 길 양옆 불빛 → 길 → 울타리 → 건물 → 바닥(빛 웅덩이를 모은 뒤 굽는다)
  placeLamps(kit, env.lamp, env.lampSpots);
  buildPath(kit, env.path, env.ground);
  placeBorder(kit, env.border, env.borderRoof);
  const building = buildBuilding(shop, kit);
  parts.push(...building.parts);
  lit.push(...building.lit);
  glows.push(...building.glows);
  for (const [x0, z0, x1, z1] of building.blockRects) nav.blockRect(x0, z0, x1, z1);
  for (const [x, z, r] of building.blockers) nav.blockCircle(x, z, r);
  for (const p of building.pools)
    kit.pools.push({ x: p.x, z: p.z, r: p.r, k: p.k, color: new THREE.Color(p.color) });
  for (const [x0, z0, x1, z1] of building.clearRects)
    kit.noGrass.push((x, z) => x > x0 && x < x1 && z > z0 && z < z1);
  const ground = buildGround(kit, env.ground);

  placeNeighbors(kit, env.neighbors);
  placeTrees(kit, env.trees, env.treeSpots);

  // 정적 배경 하나로 합치기
  const merged = track(mergeGeometries(parts) as THREE.BufferGeometry);
  for (const g of parts) g.dispose();
  group.add(new THREE.Mesh(merged, track(new THREE.MeshLambertMaterial({ vertexColors: true }))));
  const litMerged = track(mergeGeometries(lit) as THREE.BufferGeometry);
  for (const g of lit) g.dispose();
  group.add(new THREE.Mesh(litMerged, track(new THREE.MeshBasicMaterial({ vertexColors: true }))));

  // 먼 산 (안개 없이 실루엣으로)
  {
    const hills = buildHills(env.hills, env.sky.horizon ?? env.fog.color, env.hillHeight);
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
  const signMap = signTexture(env.name, building.sign.style ?? SIGN_DEFAULT);
  const sign = new THREE.Mesh(
    track(new THREE.PlaneGeometry(building.sign.w, building.sign.h)),
    track(new THREE.MeshBasicMaterial(signMap ? { map: track(signMap) } : { color: "#47291a" })),
  );
  sign.position.set(building.sign.x, building.sign.y, building.sign.z);
  group.add(sign);

  // 문 탭 판정용 투명 상자 (문보다 넉넉하게)
  const doorHit = new THREE.Mesh(
    track(new THREE.BoxGeometry(2.4, 2.4, 0.8)),
    track(new THREE.MeshBasicMaterial({ visible: false })),
  );
  doorHit.position.set(building.door.x, building.door.y, building.door.z);
  group.add(doorHit);

  // 들어갈 때 열리는 문짝 (평소에는 숨김)
  const door = buildDoorAnim(building.doorway);
  disposables.push(door);
  group.add(door.group);

  // 풀숲과 꽃 (길·마당·집을 피해서)
  {
    const { rand } = kit;
    const tuftMax = env.grass.tufts;
    const flowerMax = env.grass.flowerCount;
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
    const flowerColors = env.grass.flowers.map((c) => new THREE.Color(c));
    const grassC = new THREE.Color();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const e = new THREE.Euler();
    const pathClear = env.ground.pathHalf + 0.25;
    const free = (x: number, z: number) =>
      Math.abs(x) > pathClear &&
      !kit.noGrass.some((f) => f(x, z)) &&
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
          tuft.setColorAt(ti, grassC.set(env.grass.tuft).multiplyScalar(0.75 + rand() * 0.5));
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
  }

  if (env.mist) addMist(kit, env.mist);

  // 빛무리 (모든 등불을 점 하나로)
  const glowMat = track(glowMaterial(0.85));
  const glowPts = glowPoints(glows, glowMat);
  disposables.push(glowPts.geometry);
  group.add(glowPts);

  // 반딧불이 (아기도령은 도깨비불)
  const ffMat = track(glowMaterial(0.9));
  const ffBase: THREE.Vector3[] = [];
  const ffSpots: GlowSpot[] = [];
  const ff0 = env.fireflies;
  for (let i = 0; i < ff0.count; i++) {
    const { rand } = kit;
    const v = new THREE.Vector3((rand() - 0.5) * 15, 0.4 + rand() * 1.8, -12 + rand() * 19);
    ffBase.push(v);
    ffSpots.push({
      x: v.x,
      y: v.y,
      z: v.z,
      size: ff0.size,
      color: ff0.colors[i % ff0.colors.length] as string,
      flicker: ff0.flicker,
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
    doorFront: { x: 0, z: building.frontEdge + 0.4 },
    doorTargets: [doorHit, sign],
    door,
    doorInside: { x: 0, z: building.doorway.z - 0.5 },
    wishTree: building.wishTree ?? null,
    groundAt(z) {
      let y = 0;
      // 발끝이 단 앞면을 넘으면 그 단 위 (캐릭터 발 반지름만큼 앞에서)
      for (const [front, top] of building.steps) if (z <= front + 0.06) y = top;
      return y;
    },
    ground,
    fogColor: new THREE.Color(env.fog.color),
    fogRange: [env.fog.near, env.fog.far],
    lighting: env.light,
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
      for (const u of kit.updaters) u(time);
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
