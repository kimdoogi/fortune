/**
 * 밤하늘: 그라데이션 돔, 별, 달 (D-065). 안개를 받지 않는다.
 * 점집마다 하늘색·달 크기·달 모양이 다르다 (D-075, 08 §1 점집별 외관).
 */
import * as THREE from "three";
import { rng } from "./geo";

export const SKY = {
  top: "#141634",
  horizon: "#3b2d5c",
};

export interface SkyOptions {
  top?: THREE.ColorRepresentation;
  horizon?: THREE.ColorRepresentation;
  /** 지평선 바로 위 띠 색과 세기 */
  band?: THREE.ColorRepresentation;
  bandStrength?: number;
  /** 별 수와 밝기 */
  stars?: number;
  starBrightness?: number;
  moon?: {
    x: number;
    y: number;
    z: number;
    radius: number;
    color: THREE.ColorRepresentation;
    /** 초승달 (0이면 보름달, 클수록 가늘다) */
    crescent?: number;
  };
}

const DEFAULT_MOON = { x: 12.5, y: 10.5, z: -62, radius: 2.0, color: "#fff4d6", crescent: 0 };

/** 초승달 모양: 바깥 원호와 안쪽(어긋난) 원호로 닫는다 */
function crescentShape(r: number, cut: number): THREE.Shape {
  const s = new THREE.Shape();
  const off = r * cut;
  // 두 원의 교점 각도
  const a = Math.acos(Math.min(1, off / (2 * r)));
  s.absarc(0, 0, r, a, Math.PI * 2 - a, false);
  s.absarc(off, 0, r, Math.PI * 2 - (Math.PI - a), Math.PI - a, true);
  return s;
}

export function buildSky(o: SkyOptions = {}) {
  const horizon = o.horizon ?? SKY.horizon;
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  // 돔: 꼭대기 → 지평선으로 색이 바뀐다
  const domeGeo = new THREE.SphereGeometry(80, 24, 16);
  const top = new THREE.Color(o.top ?? SKY.top);
  const hor = new THREE.Color(horizon);
  const warm = new THREE.Color(o.band ?? "#6b4466");
  const bandK = o.bandStrength ?? 0.35;
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
    // 지평선 바로 위 띠
    const band = Math.max(0, 1 - Math.abs(h - 0.03) / 0.12);
    c.lerp(warm, band * bandK);
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
  const n = o.stars ?? 260;
  const bright = o.starBrightness ?? 1;
  const starPos = new Float32Array(n * 3);
  const starCol = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const theta = rand() * Math.PI * 2;
    const y = 0.08 + rand() ** 0.8 * 0.92;
    const r = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(theta) * r * 70, y * 70, Math.sin(theta) * r * 70], i * 3);
    const b = (0.35 + rand() * 0.65) * bright;
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

  // 달 (기본은 지붕 오른쪽 위. 왼쪽 위는 지도 버튼 자리)
  const m = { ...DEFAULT_MOON, ...o.moon };
  const moonGeo = m.crescent
    ? new THREE.ShapeGeometry(crescentShape(m.radius, m.crescent), 24)
    : new THREE.CircleGeometry(m.radius, 40);
  const moonMat = new THREE.MeshBasicMaterial({ color: m.color, fog: false, depthWrite: false });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.set(m.x, m.y, m.z);
  moon.lookAt(0, 4, 10);
  if (m.crescent) moon.rotateZ(0.5);
  moon.renderOrder = -8;
  group.add(moon);
  disposables.push(moonGeo, moonMat);

  // 달무리 자리: 초승달이면 밝은 쪽으로 옮긴다
  moon.updateMatrixWorld();
  const glowAt = moon.localToWorld(new THREE.Vector3(m.crescent ? -m.radius * 0.45 : 0, 0, 0));

  return {
    group,
    moonPosition: glowAt,
    moonRadius: m.radius,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
