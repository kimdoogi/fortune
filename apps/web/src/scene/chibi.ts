/**
 * 2등신 캐릭터를 코드로 만든다 (D-004, D-029). 머리 높이 ≈ 몸 높이, 전체 약 1.1m.
 * 같은 모양의 지오메트리는 모듈에서 한 번만 만들어 모든 캐릭터가 공유한다 (07 §4).
 */
import * as THREE from "three";

export type AgeBand = "10대" | "20대" | "30대" | "40대 이상";
export type Gender = "male" | "female";

export interface ChibiLook {
  gender: Gender;
  ageBand: AgeBand;
}

// 공유 지오메트리 (캐릭터 1명 약 2,000 삼각형)
const GEO = {
  head: new THREE.SphereGeometry(0.32, 20, 14),
  hair: new THREE.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  bun: new THREE.SphereGeometry(0.11, 10, 8),
  body: new THREE.CapsuleGeometry(0.17, 0.16, 4, 12),
  skirt: new THREE.ConeGeometry(0.26, 0.3, 14, 1, true),
  leg: new THREE.CapsuleGeometry(0.055, 0.1, 3, 8),
  arm: new THREE.CapsuleGeometry(0.05, 0.14, 3, 8),
  eye: new THREE.SphereGeometry(0.035, 8, 6),
  cheek: new THREE.CircleGeometry(0.04, 10),
  shadow: new THREE.CircleGeometry(0.28, 20),
  hatBrim: new THREE.CylinderGeometry(0.42, 0.42, 0.015, 20),
  hatTop: new THREE.CylinderGeometry(0.16, 0.18, 0.2, 14),
};

const mat = (color: THREE.ColorRepresentation) => new THREE.MeshLambertMaterial({ color });
const MAT = {
  skin: mat("#f6d5b8"),
  eye: new THREE.MeshBasicMaterial({ color: "#2a1d1a" }),
  cheek: new THREE.MeshBasicMaterial({ color: "#f3a3a3", transparent: true, opacity: 0.8 }),
  shadow: new THREE.MeshBasicMaterial({
    color: "#000000",
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  }),
  hat: mat("#22201f"),
};

/** 성별 × 나이대 기본 아바타 8종의 색 (05 §2). 외형 상세는 아트 가이드(08)에서 다듬는다 */
const PALETTE: Record<Gender, Record<AgeBand, { top: string; bottom: string; hair: string }>> = {
  female: {
    "10대": { top: "#ffd166", bottom: "#ef476f", hair: "#3a2418" },
    "20대": { top: "#f7b2d9", bottom: "#7b5cd6", hair: "#2b1b14" },
    "30대": { top: "#a8dadc", bottom: "#1d3557", hair: "#2b1b14" },
    "40대 이상": { top: "#e9c46a", bottom: "#6d4c41", hair: "#5a4a42" },
  },
  male: {
    "10대": { top: "#90e0ef", bottom: "#0077b6", hair: "#2b1b14" },
    "20대": { top: "#b7e4c7", bottom: "#2d6a4f", hair: "#1f1410" },
    "30대": { top: "#dee2e6", bottom: "#495057", hair: "#1f1410" },
    "40대 이상": { top: "#d4a373", bottom: "#3d2b1f", hair: "#6c5f58" },
  },
};

export class Chibi {
  readonly root = new THREE.Group();
  private readonly bodyGroup = new THREE.Group();
  private readonly legs: THREE.Mesh[] = [];
  private readonly arms: THREE.Mesh[] = [];
  private phase = 0;

  constructor(look: ChibiLook) {
    const pal = PALETTE[look.gender][look.ageBand];
    const top = mat(pal.top);
    const bottom = mat(pal.bottom);
    const hair = mat(pal.hair);

    const shadow = new THREE.Mesh(GEO.shadow, MAT.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.root.add(shadow, this.bodyGroup);

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(GEO.leg, bottom);
      leg.position.set(side * 0.08, 0.1, 0);
      this.legs.push(leg);
      const arm = new THREE.Mesh(GEO.arm, top);
      arm.position.set(side * 0.21, 0.38, 0);
      arm.rotation.z = side * 0.35;
      this.arms.push(arm);
      this.bodyGroup.add(leg, arm);
    }

    const body = new THREE.Mesh(GEO.body, top);
    body.position.y = 0.36;
    this.bodyGroup.add(body);
    if (look.gender === "female") {
      const skirt = new THREE.Mesh(GEO.skirt, bottom);
      skirt.position.y = 0.2;
      this.bodyGroup.add(skirt);
    }

    const head = new THREE.Group();
    head.position.y = 0.82;
    const face = new THREE.Mesh(GEO.head, MAT.skin);
    const hairCap = new THREE.Mesh(GEO.hair, hair);
    hairCap.rotation.x = -0.35;
    hairCap.position.set(0, 0.02, -0.02);
    head.add(face, hairCap);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(GEO.eye, MAT.eye);
      eye.position.set(side * 0.11, 0.0, 0.29);
      const cheek = new THREE.Mesh(GEO.cheek, MAT.cheek);
      cheek.position.set(side * 0.18, -0.07, 0.27);
      cheek.rotation.y = side * 0.5;
      head.add(eye, cheek);
    }
    if (look.gender === "female") {
      const bun = new THREE.Mesh(GEO.bun, hair);
      bun.position.set(0, 0.12, -0.3);
      head.add(bun);
    } else if (look.ageBand === "30대" || look.ageBand === "40대 이상") {
      const brim = new THREE.Mesh(GEO.hatBrim, MAT.hat);
      brim.position.y = 0.2;
      const topPart = new THREE.Mesh(GEO.hatTop, MAT.hat);
      topPart.position.y = 0.3;
      head.add(brim, topPart);
    }
    this.bodyGroup.add(head);
  }

  /** 걷는 동안 몸을 통통 튀기고 팔다리를 흔든다 */
  update(dt: number, moving: boolean) {
    this.phase = moving ? this.phase + dt * 12 : this.phase * 0.85;
    const s = Math.sin(this.phase);
    this.bodyGroup.position.y = moving ? Math.abs(s) * 0.05 : 0;
    this.legs[0]?.rotation.set(s * 0.6, 0, 0);
    this.legs[1]?.rotation.set(-s * 0.6, 0, 0);
    if (this.arms[0]) this.arms[0].rotation.x = -s * 0.5;
    if (this.arms[1]) this.arms[1].rotation.x = s * 0.5;
  }
}
