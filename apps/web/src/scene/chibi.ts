/**
 * 2등신 캐릭터를 코드로 만든다 (D-004, D-029, 08 §1 캐릭터 구성 규칙).
 * 머리 지름 ≈ 몸 높이, 전체 약 1.1m. 머리카락은 앞머리·뒷머리 덩어리로 나눠 뒤에서 봐도 머리 모양이 보이게 한다.
 * 같은 모양의 지오메트리는 모듈에서 한 번만 만들어 모든 캐릭터가 공유한다 (07 §4). 1명 3,000 삼각형 이하.
 */
import * as THREE from "three";
import { flatMaterial, mergeRig, selfLitMaterial } from "./rig";

export type AgeBand = "10대" | "20대" | "30대" | "40대 이상";
export type Gender = "male" | "female";

export interface ChibiLook {
  gender: Gender;
  ageBand: AgeBand;
}

const GEO = {
  head: new THREE.SphereGeometry(0.32, 18, 12),
  hairCap: new THREE.SphereGeometry(0.336, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
  hairBack: new THREE.SphereGeometry(0.3, 12, 8),
  bang: new THREE.SphereGeometry(0.1, 6, 5),
  sideLock: new THREE.CapsuleGeometry(0.06, 0.16, 3, 6),
  longHair: new THREE.CapsuleGeometry(0.2, 0.22, 3, 10),
  tail: new THREE.CapsuleGeometry(0.07, 0.2, 3, 8),
  bun: new THREE.SphereGeometry(0.12, 10, 8),
  pin: new THREE.CylinderGeometry(0.012, 0.012, 0.34, 5),
  ribbon: new THREE.BoxGeometry(0.16, 0.06, 0.02),
  ear: new THREE.SphereGeometry(0.06, 6, 4),
  eye: new THREE.SphereGeometry(0.05, 8, 6),
  shine: new THREE.SphereGeometry(0.016, 5, 3),
  cheek: new THREE.CircleGeometry(0.045, 10),
  mouth: new THREE.TorusGeometry(0.03, 0.009, 4, 8, Math.PI),
  torso: new THREE.CapsuleGeometry(0.17, 0.16, 4, 12),
  collar: new THREE.TorusGeometry(0.13, 0.026, 5, 12),
  goreum: new THREE.BoxGeometry(0.05, 0.17, 0.015),
  skirt: new THREE.ConeGeometry(0.31, 0.44, 16),
  sleeve: new THREE.CapsuleGeometry(0.058, 0.14, 3, 8),
  hand: new THREE.SphereGeometry(0.048, 6, 5),
  leg: new THREE.CapsuleGeometry(0.06, 0.08, 3, 8),
  shoe: new THREE.SphereGeometry(0.06, 6, 5),
  shadow: new THREE.CircleGeometry(0.3, 20),
  hatBrim: new THREE.CylinderGeometry(0.44, 0.44, 0.015, 20),
  hatTop: new THREE.CylinderGeometry(0.15, 0.17, 0.2, 12),
};

/** 밤 장면에서도 캐릭터가 묻히지 않게 자기 색을 조금 스스로 낸다 */
const mat = (color: THREE.ColorRepresentation) =>
  new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.22) });
const MAT = {
  skin: mat("#ffdcc2"),
  eye: new THREE.MeshBasicMaterial({ color: "#2a1d1a" }),
  white: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
  mouth: new THREE.MeshBasicMaterial({ color: "#9b4a45" }),
  cheek: new THREE.MeshBasicMaterial({ color: "#f39c9c", transparent: true, opacity: 0.75 }),
  shadow: new THREE.MeshBasicMaterial({
    color: "#000000",
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  }),
  collar: mat("#fbf7ee"),
  hat: mat("#1d1b1f"),
  gold: mat("#e8c46a"),
};

interface Palette {
  top: string;
  bottom: string;
  hair: string;
  accent: string;
  shoe: string;
}

/** 성별 × 나이대 기본 아바타 8종 (05 §2, 08 §1) */
const PALETTE: Record<Gender, Record<AgeBand, Palette>> = {
  female: {
    "10대": {
      top: "#fff3b0",
      bottom: "#ef6f8e",
      hair: "#3a2418",
      accent: "#d9413a",
      shoe: "#f4f1ea",
    },
    "20대": {
      top: "#ffd6e6",
      bottom: "#8a6fe0",
      hair: "#2b1b14",
      accent: "#6a4fc9",
      shoe: "#f4f1ea",
    },
    "30대": {
      top: "#d7efe8",
      bottom: "#2f6f8f",
      hair: "#2b1b14",
      accent: "#c25b7a",
      shoe: "#f4f1ea",
    },
    "40대 이상": {
      top: "#f3e2c0",
      bottom: "#7a4a3a",
      hair: "#5a4a42",
      accent: "#3f7a5a",
      shoe: "#f4f1ea",
    },
  },
  male: {
    "10대": {
      top: "#cdeeff",
      bottom: "#3e6fb0",
      hair: "#2b1b14",
      accent: "#3e6fb0",
      shoe: "#3a2b22",
    },
    "20대": {
      top: "#e3f3dc",
      bottom: "#3f6b4f",
      hair: "#1f1410",
      accent: "#2f5a43",
      shoe: "#3a2b22",
    },
    "30대": {
      top: "#eef0f2",
      bottom: "#4a5260",
      hair: "#1f1410",
      accent: "#4a5260",
      shoe: "#2b2420",
    },
    "40대 이상": {
      top: "#efe2cc",
      bottom: "#5a4030",
      hair: "#6c5f58",
      accent: "#8a5a3b",
      shoe: "#2b2420",
    },
  },
};

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

export class Chibi {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly arms: THREE.Group[] = [];
  private readonly eyes: THREE.Object3D[] = [];
  private phase = 0;
  /** 걸음 수 (다리 흔들기 반 바퀴 = 한 걸음). 발소리용 */
  private stepIdx = 0;
  private stepped = false;
  private time = Math.random() * 10;
  private nextBlink = 2 + Math.random() * 3;
  /** 점집 안에서 방석에 앉은 자세 */
  private seated = false;
  /** 이 캐릭터만 쓰는 재질·지오메트리 (공유 GEO·MAT는 빼고) */
  private readonly owned: { dispose(): void }[] = [];

  constructor(look: ChibiLook) {
    const pal = PALETTE[look.gender][look.ageBand];
    const top = mat(pal.top);
    const bottom = mat(pal.bottom);
    const hair = mat(pal.hair);
    const accent = mat(pal.accent);
    const shoe = mat(pal.shoe);
    this.owned.push(top, bottom, hair, accent, shoe);
    const female = look.gender === "female";

    const shadow = mesh(GEO.shadow, MAT.shadow, 0, 0.01, 0);
    shadow.rotation.x = -Math.PI / 2;
    this.root.add(shadow, this.body);

    // 다리 (엉덩이를 축으로 흔든다)
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.08, 0.2, 0);
      leg.add(mesh(GEO.leg, bottom, 0, -0.09, 0));
      const foot = mesh(GEO.shoe, shoe, 0, -0.17, 0.03);
      foot.scale.set(1, 0.6, 1.45);
      leg.add(foot);
      this.legs.push(leg);
      this.body.add(leg);
    }

    // 몸통 (저고리) + 동정 + 고름
    this.body.add(mesh(GEO.torso, top, 0, 0.37, 0));
    const collar = mesh(GEO.collar, MAT.collar, 0, 0.54, 0);
    collar.rotation.x = Math.PI / 2 - 0.15;
    this.body.add(collar);
    for (const [x, rz] of [
      [0.05, 0.35],
      [0.09, -0.1],
    ] as const) {
      const g = mesh(GEO.goreum, accent, x, 0.4, 0.165);
      g.rotation.z = rz;
      this.body.add(g);
    }
    if (female) {
      this.body.add(mesh(GEO.skirt, bottom, 0, 0.22, 0));
    }

    // 팔 (어깨를 축으로 흔든다)
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.2, 0.5, 0);
      arm.rotation.z = side * 0.32;
      arm.add(mesh(GEO.sleeve, top, 0, -0.11, 0));
      arm.add(mesh(GEO.hand, MAT.skin, 0, -0.23, 0));
      this.arms.push(arm);
      this.body.add(arm);
    }

    // 머리
    this.head.position.y = 0.84;
    this.body.add(this.head);
    const face = mesh(GEO.head, MAT.skin);
    face.scale.set(1, 0.95, 0.97);
    this.head.add(face);
    for (const side of [-1, 1]) this.head.add(mesh(GEO.ear, MAT.skin, side * 0.31, -0.03, 0));

    // 얼굴: 눈(+반짝이), 볼, 입
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.11, -0.01, 0.285);
      const ball = mesh(GEO.eye, MAT.eye);
      ball.scale.set(1, 1.25, 0.6);
      eye.add(ball, mesh(GEO.shine, MAT.white, 0.016, 0.022, 0.025));
      this.eyes.push(eye);
      const cheek = mesh(GEO.cheek, MAT.cheek, side * 0.19, -0.08, 0.255);
      cheek.rotation.y = side * 0.55;
      this.head.add(eye, cheek);
    }
    const mouth = mesh(GEO.mouth, MAT.mouth, 0, -0.1, 0.3);
    mouth.rotation.z = Math.PI;
    this.head.add(mouth);

    // 머리카락: 정수리 덮개 + 뒷머리 + 앞머리(이마를 따라 작은 덩어리) + 옆머리
    const cap = mesh(GEO.hairCap, hair, 0, 0.02, -0.03);
    cap.rotation.x = -0.62;
    const back = mesh(GEO.hairBack, hair, 0, -0.05, -0.11);
    back.scale.set(1.06, 1.02, 0.95);
    this.head.add(cap, back);
    const fringe = female ? 5 : 4;
    for (let i = 0; i < fringe; i++) {
      const t = i / (fringe - 1) - 0.5; // -0.5 ~ 0.5
      const ang = t * (female ? 1.7 : 1.4);
      const b = mesh(
        GEO.bang,
        hair,
        Math.sin(ang) * 0.27,
        0.19 - Math.abs(t) * 0.07,
        Math.cos(ang) * 0.24,
      );
      b.scale.set(1.1, 0.75, 0.6);
      b.rotation.y = ang;
      b.rotation.z = -t * 0.6;
      this.head.add(b);
    }
    for (const side of [-1, 1]) {
      const lock = mesh(GEO.sideLock, hair, side * 0.285, female ? -0.06 : 0.02, 0.06);
      lock.scale.set(1, female ? 1.15 : 0.65, 0.8);
      lock.rotation.z = side * 0.12;
      this.head.add(lock);
    }

    // 나이대별 머리 모양
    if (female) {
      if (look.ageBand === "10대") {
        // 댕기머리
        const tail = mesh(GEO.tail, hair, 0, -0.2, -0.3);
        tail.rotation.x = 0.25;
        this.head.add(tail, mesh(GEO.ribbon, accent, 0, -0.36, -0.27));
      } else if (look.ageBand === "20대") {
        const long = mesh(GEO.longHair, hair, 0, -0.27, -0.17);
        long.scale.set(0.95, 1, 0.6);
        this.head.add(long);
      } else {
        // 쪽머리 (40대 이상은 비녀)
        this.head.add(mesh(GEO.bun, hair, 0, -0.12, -0.31));
        if (look.ageBand === "40대 이상") {
          const pin = mesh(GEO.pin, MAT.gold, 0, -0.12, -0.33);
          pin.rotation.z = Math.PI / 2;
          this.head.add(pin);
        }
      }
    } else if (look.ageBand === "30대" || look.ageBand === "40대 이상") {
      // 갓
      this.head.add(mesh(GEO.hatBrim, MAT.hat, 0, 0.25, 0), mesh(GEO.hatTop, MAT.hat, 0, 0.36, 0));
    }
  }

  /** 삼각형 수 (07 §3 한도 확인용) */
  triangles(): number {
    let n = 0;
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const g = o.geometry as THREE.BufferGeometry;
        n += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
      }
    });
    return Math.round(n);
  }

  /**
   * 뼈마다 메시를 합쳐 드로우콜을 줄인다 (약 37 → 12). 점집 내부처럼 드로우콜 한도가 낮은 곳에서 쓴다 (07 §3).
   * 합친 뒤에는 이 캐릭터만의 지오메트리가 생기므로 dispose()를 불러야 한다.
   */
  compact(): this {
    const lit = selfLitMaterial(0.22);
    const flat = flatMaterial();
    this.owned.push(lit, flat, ...mergeRig(this.root, lit, flat));
    return this;
  }

  /** 방석에 앉는다 (점집 안). 다리를 앞으로 접고 손은 무릎 위 */
  sit(): this {
    this.seated = true;
    return this;
  }

  dispose() {
    for (const d of this.owned) d.dispose();
    this.owned.length = 0;
  }

  /** 지난 update 이후 한 걸음을 디뎠으면 true (한 번만) */
  takeStep(): boolean {
    const s = this.stepped;
    this.stepped = false;
    return s;
  }

  /** 걸을 때는 통통 튀며 팔다리를 흔들고, 서 있을 때는 숨쉬듯 움직이고 눈을 깜빡인다 */
  update(dt: number, moving: boolean) {
    this.time += dt;
    this.phase = moving ? this.phase + dt * 11 : this.phase * 0.85;
    if (moving) {
      const idx = Math.floor(this.phase / Math.PI);
      if (idx !== this.stepIdx) {
        this.stepIdx = idx;
        this.stepped = true;
      }
    }
    const s = Math.sin(this.phase);
    this.body.position.y = moving ? Math.abs(s) * 0.055 : 0;
    this.body.rotation.x = moving ? 0.07 : 0;
    const breathe = moving ? 0 : Math.sin(this.time * 2.2) * 0.012;
    this.body.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
    this.head.rotation.z = moving
      ? Math.sin(this.phase * 0.5) * 0.05
      : Math.sin(this.time * 0.9) * 0.04;
    if (this.seated) {
      this.body.position.y = -0.13;
      this.body.rotation.x = 0.04;
      this.legs[0]?.rotation.set(-1.45, 0.25, 0);
      this.legs[1]?.rotation.set(-1.45, -0.25, 0);
      for (const arm of this.arms) arm.rotation.x = -0.55 + breathe * 2;
    } else {
      this.legs[0]?.rotation.set(s * 0.6, 0, 0);
      this.legs[1]?.rotation.set(-s * 0.6, 0, 0);
      if (this.arms[0]) this.arms[0].rotation.x = -s * 0.55;
      if (this.arms[1]) this.arms[1].rotation.x = s * 0.55;
    }

    // 깜빡임
    this.nextBlink -= dt;
    const closed = this.nextBlink < 0.12 && this.nextBlink > 0;
    if (this.nextBlink <= 0) this.nextBlink = 2.5 + Math.random() * 3;
    for (const e of this.eyes) e.scale.y = closed ? 0.12 : 1;
  }
}
