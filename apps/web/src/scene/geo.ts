/**
 * 장면 생성용 작은 도구들. 정적 배경은 버텍스 컬러를 입힌 뒤 한 덩어리로 합친다 (07 §4).
 */
import * as THREE from "three";

/** 지오메트리 전체에 한 색을 버텍스 컬러로 입힌다 (합치기 전에 쓴다) */
export function colored(
  geo: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const c = new THREE.Color(color);
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute("uv");
  return g;
}

/** 위아래로 색이 바뀌게 입힌다 (아래가 어두운 돌, 벽 등) */
export function gradient(
  geo: THREE.BufferGeometry,
  bottom: THREE.ColorRepresentation,
  top: THREE.ColorRepresentation,
): THREE.BufferGeometry {
  const g = colored(geo, bottom);
  g.computeBoundingBox();
  const box = g.boundingBox as THREE.Box3;
  const span = Math.max(box.max.y - box.min.y, 1e-6);
  const b = new THREE.Color(bottom);
  const t = new THREE.Color(top);
  const pos = g.getAttribute("position");
  const col = g.getAttribute("color");
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.lerpColors(b, t, (pos.getY(i) - box.min.y) / span);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  return g;
}

export function at(geo: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) {
  if (ry) geo.rotateY(ry);
  geo.translate(x, y, z);
  return geo;
}

/** 두 점을 잇는 각진 막대 (추녀마루, 금줄 등) */
export function beam(
  a: THREE.Vector3,
  b: THREE.Vector3,
  w: number,
  h: number,
): THREE.BufferGeometry {
  const dir = b.clone().sub(a);
  const geo = new THREE.BoxGeometry(dir.length(), h, w);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    dir.clone().normalize(),
  );
  geo.applyQuaternion(q);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  geo.translate(mid.x, mid.y, mid.z);
  return geo;
}

/** 0~1 사이 값을 주는 결정적 해시 (같은 거리는 매번 같은 모양) */
export function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** 부드러운 값 노이즈 (바닥 풀 얼룩) */
export function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** 시드가 있는 난수 (소품 배치용) */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
