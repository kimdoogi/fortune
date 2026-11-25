/**
 * 밤하늘: 그라데이션 돔, 별, 보름달 (D-065). 안개를 받지 않는다.
 */
import * as THREE from "three";
import { rng } from "./geo";

export const SKY = {
  top: "#141634",
  horizon: "#3b2d5c",
};

export function buildSky(horizon: THREE.ColorRepresentation = SKY.horizon) {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  // 돔: 꼭대기 → 지평선으로 색이 바뀐다
  const domeGeo = new THREE.SphereGeometry(80, 24, 16);
  const top = new THREE.Color(SKY.top);
  const hor = new THREE.Color(horizon);
  const warm = new THREE.Color("#6b4466");
  const pos = domeGeo.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 80; // -1 ~ 1
    if (h > 0) {
      c.lerpColors(hor, top, Math.min(1, h ** 0.55));
    } else {
      c.copy(hor);
    }
    // 지평선 바로 위에 붉은 보라 띠
    const band = Math.max(0, 1 - Math.abs(h - 0.03) / 0.12);
    c.lerp(warm, band * 0.35);
    col.set([c.r, c.g, c.b], i * 3);
  }
  domeGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const domeMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.renderOrder = -10;
  group.add(dome);
  disposables.push(domeGeo, domeMat);

  // 별: 위쪽 반구에만, 밝기를 섞는다
  const rand = rng(7);
  const n = 260;
  const starPos = new Float32Array(n * 3);
  const starCol = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const theta = rand() * Math.PI * 2;
    const y = 0.08 + rand() ** 0.8 * 0.92;
    const r = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(theta) * r * 70, y * 70, Math.sin(theta) * r * 70], i * 3);
    const b = 0.35 + rand() * 0.65;
    const tint = rand();
    starCol.set([b, b * (0.9 + tint * 0.1), b * (0.85 + (1 - tint) * 0.15)], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
  const starMat = new THREE.PointsMaterial({
    size: 2.2,
    sizeAttenuation: false,
    vertexColors: true,
    fog: false,
    depthWrite: false,
    transparent: true,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -9;
  group.add(stars);
  disposables.push(starGeo, starMat);

  // 보름달 (지붕 오른쪽 위. 왼쪽 위는 지도 버튼 자리)
  const moonGeo = new THREE.CircleGeometry(2.0, 32);
  const moonMat = new THREE.MeshBasicMaterial({ color: "#fff4d6", fog: false, depthWrite: false });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.set(12.5, 10.5, -62);
  moon.lookAt(0, 4, 10);
  moon.renderOrder = -8;
  group.add(moon);
  disposables.push(moonGeo, moonMat);

  return {
    group,
    moonPosition: moon.position.clone(),
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
