/**
 * 점집 내부 조명 굽기 (D-065, 07 §3: 실시간 광원·그림자 없음).
 * 등불마다 거리·방향에 따른 밝기를 버텍스 컬러에 한 번 곱해 두고, 그릴 때는 MeshBasic으로 빛 계산 없이 그린다.
 * 벽·바닥 모서리와 가구 밑은 살짝 어둡게(가짜 AO) 해서 방이 붙어 보이게 한다.
 */
import * as THREE from "three";

export interface BakeLight {
  x: number;
  y: number;
  z: number;
  color: THREE.ColorRepresentation;
  /** 1m 거리에서의 밝기 */
  intensity: number;
  /** 이 거리에서 밝기가 절반 */
  range: number;
}

/** 바닥에 드리우는 둥근 접지 그림자 (탁자, 방석, 사람 밑) */
export interface ContactShadow {
  x: number;
  z: number;
  rx: number;
  rz: number;
  /** 0~1 어두운 정도 */
  k: number;
}

export interface BakeEnv {
  /** 위에서 오는 은은한 빛 (천장 반사) */
  sky: THREE.ColorRepresentation;
  /** 아래에서 오는 빛 (바닥 반사) */
  ground: THREE.ColorRepresentation;
  lights: BakeLight[];
  /** 방 크기: 모서리 어둡게 하기용 */
  room: { minX: number; maxX: number; minZ: number; maxZ: number; height: number };
  /** 모서리 어둡기 (0~1) */
  ao: number;
  shadows: ContactShadow[];
}

/** 밝은 쪽은 부드럽게 눌러 하얗게 날아가지 않게 한다 */
export function softClamp(v: number): number {
  const knee = 0.78;
  if (v <= knee) return v;
  return knee + (1 - knee) * (1 - Math.exp(-(v - knee) / (1 - knee)));
}

/** 버텍스 하나의 빛(색 곱하기 전)을 구하는 함수를 만든다. 색은 미리 바꿔 둔다 */
export function lighter(env: BakeEnv) {
  const sky = new THREE.Color(env.sky);
  const ground = new THREE.Color(env.ground);
  const lights = env.lights.map((l) => ({ ...l, c: new THREE.Color(l.color) }));
  const r = env.room;
  return (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => {
    out.lerpColors(ground, sky, n.y * 0.5 + 0.5);
    for (const l of lights) {
      const dx = l.x - p.x;
      const dy = l.y - p.y;
      const dz = l.z - p.z;
      const d = Math.hypot(dx, dy, dz) || 1e-4;
      // 감싸는 램버트: 등진 면도 조금 밝게 (부드러운 실내 느낌)
      const ndl = (n.x * dx + n.y * dy + n.z * dz) / d;
      const k = (l.intensity * Math.max(0, (ndl + 0.45) / 1.45)) / (1 + (d / l.range) ** 2);
      out.r += l.c.r * k;
      out.g += l.c.g * k;
      out.b += l.c.b * k;
    }
    // 모서리 AO: 이 점이 놓인 면을 뺀 가장 가까운 방 경계까지의 거리
    let m = Number.POSITIVE_INFINITY;
    for (const d of [p.y, r.height - p.y, p.x - r.minX, r.maxX - p.x, p.z - r.minZ, r.maxZ - p.z])
      if (d > 0.015 && d < m) m = d;
    let shade = 1 - env.ao * Math.exp(-m / 0.28);
    // 바닥 접지 그림자
    if (p.y < 0.5) {
      const low = 1 - p.y / 0.5;
      for (const s of env.shadows) {
        const e = ((p.x - s.x) / s.rx) ** 2 + ((p.z - s.z) / s.rz) ** 2;
        shade *= 1 - s.k * low * Math.exp(-e * 1.6);
      }
    }
    return out.multiplyScalar(shade);
  };
}

/** 지오메트리의 버텍스 컬러에 빛을 곱한다 (position·normal·color 필요) */
export function bakeLighting(geo: THREE.BufferGeometry, env: BakeEnv) {
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const col = geo.getAttribute("color");
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const l = new THREE.Color();
  const light = lighter(env);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    light(p, n, l);
    col.setXYZ(
      i,
      softClamp(col.getX(i) * l.r),
      softClamp(col.getY(i) * l.g),
      softClamp(col.getZ(i) * l.b),
    );
  }
  col.needsUpdate = true;
}
