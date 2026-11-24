/**
 * 점집 거리 장면을 코드로 만든다 (D-029, D-047: 점집마다 거리가 따로).
 * 정적 배경은 지오메트리를 합치고, 반복 물체는 InstancedMesh로 그린다 (07 §4).
 */
import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NavGrid, type Point } from "./nav";

export interface ShopTheme {
  name: string;
  roof: string;
  wall: string;
  trim: string;
  sky: string;
}

export const THEMES: Record<ShopId, ShopTheme> = {
  saju: { name: "사주집", roof: "#3d4451", wall: "#efe3cf", trim: "#8a5a3b", sky: "#2a2340" },
  tarot: { name: "타로집", roof: "#5b3f8c", wall: "#2f3a5f", trim: "#d8c27a", sky: "#1e1838" },
  dolyeong: { name: "아기도령", roof: "#b23a3a", wall: "#f5efe6", trim: "#2e6b4f", sky: "#2b2036" },
  dream: { name: "꿈해몽", roof: "#2f7d7a", wall: "#eadbc8", trim: "#7a5c43", sky: "#1f2a3d" },
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
  dispose(): void;
}

const lambert = (color: THREE.ColorRepresentation) => new THREE.MeshLambertMaterial({ color });

function colored(
  geo: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute("uv");
  return g;
}

function at(geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) {
  geo.rotateY(ry);
  geo.translate(x, y, z);
  return geo;
}

function signTexture(text: string, theme: ShopTheme): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = theme.trim;
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = "#f6e7b8";
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 496, 144);
  ctx.fillStyle = "#fff7e0";
  ctx.font = "bold 84px 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 86);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildStreet(shop: ShopId): Street {
  const theme = THEMES[shop];
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };

  // 거리 범위: x -9~9, z -14~8. 건물은 북쪽(-z), 캐릭터는 남쪽에서 시작
  const nav = new NavGrid(-9, -14, 9, 8, 0.5);

  // 바닥
  const groundGeo = track(new THREE.PlaneGeometry(40, 40));
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, track(lambert("#4f6b3c")));
  group.add(ground);

  // 정적 배경을 한 덩어리로 합친다: 길, 담장, 건물
  const parts: THREE.BufferGeometry[] = [];
  const path = new THREE.BoxGeometry(3.2, 0.04, 20);
  parts.push(colored(at(path, 0, 0.02, -2), "#c9b99a"));
  for (let z = -11; z <= 7; z += 1.6) {
    parts.push(
      colored(
        at(new THREE.BoxGeometry(0.9, 0.05, 0.7), -0.8 + ((z * 7) % 3) * 0.4, 0.045, z),
        "#b5a586",
      ),
    );
  }
  // 담장 (양옆)
  for (const side of [-1, 1]) {
    parts.push(colored(at(new THREE.BoxGeometry(0.5, 0.9, 22), side * 8.8, 0.45, -3), "#8c7b6a"));
    parts.push(colored(at(new THREE.BoxGeometry(0.7, 0.18, 22), side * 8.8, 0.98, -3), theme.roof));
    nav.blockRect(side * 8.8 - 0.4, -14, side * 8.8 + 0.4, 8);
  }
  // 건물 (한옥풍): 기단, 벽, 기둥, 지붕
  const bz = -10;
  parts.push(colored(at(new THREE.BoxGeometry(7, 0.45, 4.6), 0, 0.225, bz), "#a39380"));
  parts.push(colored(at(new THREE.BoxGeometry(5.8, 2.2, 3.4), 0, 1.55, bz), theme.wall));
  for (const px of [-2.9, -1, 1, 2.9]) {
    parts.push(
      colored(at(new THREE.CylinderGeometry(0.12, 0.12, 2.3, 8), px, 1.6, bz + 1.75), theme.trim),
    );
  }
  const roof = new THREE.CylinderGeometry(1.6, 5.2, 1.4, 4, 1);
  roof.rotateY(Math.PI / 4);
  roof.scale(1, 1, 0.7);
  parts.push(colored(at(roof, 0, 3.35, bz), theme.roof));
  parts.push(colored(at(new THREE.BoxGeometry(3.4, 0.2, 0.5), 0, 4.1, bz), theme.roof));
  // 문
  parts.push(colored(at(new THREE.BoxGeometry(1.3, 1.7, 0.08), 0, 1.3, bz + 1.73), "#5a3a26"));
  nav.blockRect(-3.6, bz - 2.4, 3.6, bz + 2.3);

  const merged = track(mergeGeometries(parts) as THREE.BufferGeometry);
  for (const p of parts) p.dispose();
  const staticMesh = new THREE.Mesh(
    merged,
    track(new THREE.MeshLambertMaterial({ vertexColors: true })),
  );
  group.add(staticMesh);

  // 간판
  const signTex = track(signTexture(theme.name, theme));
  const sign = new THREE.Mesh(
    track(new THREE.PlaneGeometry(2.2, 0.7)),
    track(new THREE.MeshBasicMaterial({ map: signTex })),
  );
  sign.position.set(0, 2.3, bz + 1.76);
  group.add(sign);

  // 문 탭 판정용 투명 상자 (문보다 넉넉하게)
  const doorHit = new THREE.Mesh(
    track(new THREE.BoxGeometry(2.2, 2.6, 0.6)),
    track(new THREE.MeshBasicMaterial({ visible: false })),
  );
  doorHit.position.set(0, 1.3, bz + 1.9);
  group.add(doorHit);

  // 나무 (InstancedMesh: 줄기 + 잎)
  const treeSpots: Point[] = [
    { x: -6.5, z: -6 },
    { x: 6.5, z: -6.5 },
    { x: -6.8, z: 0 },
    { x: 6.2, z: 1 },
    { x: -6, z: 5.5 },
    { x: 6.8, z: 5 },
    { x: -5.2, z: -12.5 },
    { x: 5.4, z: -12.6 },
  ];
  const trunk = new THREE.InstancedMesh(
    track(new THREE.CylinderGeometry(0.14, 0.18, 1, 8)),
    track(lambert("#6b4a33")),
    treeSpots.length,
  );
  const leaves = new THREE.InstancedMesh(
    track(new THREE.ConeGeometry(1.1, 2.2, 10)),
    track(lambert("#2f6d45")),
    treeSpots.length,
  );
  const m = new THREE.Matrix4();
  treeSpots.forEach((t, i) => {
    trunk.setMatrixAt(i, m.makeTranslation(t.x, 0.5, t.z));
    leaves.setMatrixAt(i, m.makeTranslation(t.x, 2, t.z));
    nav.blockCircle(t.x, t.z, 0.5);
  });
  group.add(trunk, leaves);

  // 등불 (기둥 + 빛나는 등)
  const lanternSpots: Point[] = [];
  for (let z = -7; z <= 6; z += 3.25) lanternSpots.push({ x: -2.3, z }, { x: 2.3, z });
  const post = new THREE.InstancedMesh(
    track(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6)),
    track(lambert("#3b2b22")),
    lanternSpots.length,
  );
  const lamp = new THREE.InstancedMesh(
    track(new THREE.SphereGeometry(0.2, 12, 8)),
    track(new THREE.MeshBasicMaterial({ color: "#ffb347" })),
    lanternSpots.length,
  );
  lanternSpots.forEach((l, i) => {
    post.setMatrixAt(i, m.makeTranslation(l.x, 0.8, l.z));
    lamp.setMatrixAt(i, m.makeTranslation(l.x, 1.7, l.z));
    nav.blockCircle(l.x, l.z, 0.2);
  });
  group.add(post, lamp);

  return {
    group,
    nav,
    spawn: { x: 0, z: 6 },
    doorFront: { x: 0, z: bz + 2.9 },
    doorTargets: [doorHit, sign],
    ground,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
