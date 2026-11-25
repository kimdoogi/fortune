/**
 * 2등신 캐릭터를 코드로 만든다 (D-004, D-029, 08 §1 캐릭터 구성 규칙).
 * 머리 지름 ≈ 몸 높이, 전체 약 1.1m. 머리카락은 앞머리·뒷머리 덩어리로 나눠 뒤에서 봐도 머리 모양이 보이게 한다.
 * 같은 모양의 지오메트리는 모듈에서 한 번만 만들어 모든 캐릭터가 공유한다 (07 §4). 1명 3,000 삼각형 이하.
 *
 * 꾸미기 (F17, D-098): 종족·머리·옷·옷 색·장식·머리색·피부를 골라 같은 뼈(몸·머리·팔·다리·눈)에 파츠를 붙인다.
 * 꾸미기가 없으면 성별·나이대 기본 값(defaultStyle)으로 그려 예전 모습과 같다.
 * 새 파츠는 이미 있는 뼈에만 붙이고 불투명 Lambert/Basic 재질만 써서, mergeRig로 합친 뒤 메시 수가 늘지 않는다.
 */
import type { AvatarStyle } from "@fortune/shared-types";
import * as THREE from "three";
import { colorsOf, defaultStyle } from "./avatar-parts";
import { flatMaterial, mergeRig, selfLitMaterial } from "./rig";

export type AgeBand = "10대" | "20대" | "30대" | "40대 이상";
export type Gender = "male" | "female";

export interface ChibiLook {
  gender: Gender;
  ageBand: AgeBand;
  /** 캐릭터 꾸미기 (F17). 없으면 성별·나이대 기본 모습 */
  style?: AvatarStyle | null;
}

/** 이 외모로 그릴 꾸미기 값 (없으면 기본 값) */
export function styleOf(look: ChibiLook): AvatarStyle {
  return look.style ?? defaultStyle(look.gender, look.ageBand);
}

const lathe = (pts: number[][], seg = 16) =>
  new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );

const GEO = {
  head: new THREE.SphereGeometry(0.32, 18, 12),
  hairCap: new THREE.SphereGeometry(0.336, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
  hairBack: new THREE.SphereGeometry(0.3, 12, 8),
  bang: new THREE.SphereGeometry(0.1, 6, 4),
  sideLock: new THREE.CapsuleGeometry(0.06, 0.16, 2, 6),
  longHair: new THREE.CapsuleGeometry(0.2, 0.22, 3, 10),
  tail: new THREE.CapsuleGeometry(0.07, 0.2, 2, 8),
  bun: new THREE.SphereGeometry(0.12, 10, 8),
  curl: new THREE.SphereGeometry(0.09, 5, 4),
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
  /**
   * 통 원피스 (D-086·D-087): 어깨부터 치맛단까지 한 덩어리로 돌려 깎는다. 상하체가 나뉘지 않는다.
   * 치맛단(아래)은 무릎 위라 다리가 보인다
   */
  onePiece: lathe([
    [0.285, 0.12],
    [0.262, 0.17],
    [0.225, 0.25],
    [0.188, 0.32],
    [0.172, 0.38],
    [0.176, 0.45],
    [0.172, 0.51],
    [0.148, 0.56],
    [0.1, 0.6],
    [0.0, 0.615],
  ]),
  /** 치마저고리의 치마: 가슴 아래에서 발목 위까지 (F17) */
  chimaSkirt: lathe(
    [
      [0.3, 0.09],
      [0.29, 0.14],
      [0.262, 0.23],
      [0.228, 0.32],
      [0.204, 0.4],
      [0.194, 0.45],
      [0.172, 0.475],
      [0.0, 0.485],
    ],
    12,
  ),
  /** 도포: 어깨부터 정강이까지 길게 */
  dopoRobe: lathe(
    [
      [0.27, 0.11],
      [0.256, 0.17],
      [0.222, 0.29],
      [0.192, 0.39],
      [0.182, 0.47],
      [0.168, 0.54],
      [0.125, 0.595],
      [0.0, 0.615],
    ],
    12,
  ),
  sash: new THREE.TorusGeometry(0.19, 0.022, 4, 14),
  hood: new THREE.SphereGeometry(0.2, 10, 6),
  pocket: new THREE.BoxGeometry(0.2, 0.08, 0.03),
  string: new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4),
  /** 원피스 흰 동그란 깃 한 쪽 */
  roundCollar: new THREE.SphereGeometry(0.075, 8, 4),
  bowLoop: new THREE.SphereGeometry(0.045, 6, 4),
  sleeve: new THREE.CapsuleGeometry(0.058, 0.14, 2, 8),
  hand: new THREE.SphereGeometry(0.048, 6, 4),
  leg: new THREE.CapsuleGeometry(0.06, 0.08, 2, 6),
  shoe: new THREE.SphereGeometry(0.06, 6, 4),
  shadow: new THREE.CircleGeometry(0.3, 20),
  hatBrim: new THREE.CylinderGeometry(0.44, 0.44, 0.015, 20),
  hatTop: new THREE.CylinderGeometry(0.15, 0.17, 0.2, 12),
  // 머리 장식 (F17)
  petal: new THREE.SphereGeometry(0.045, 5, 3),
  bead: new THREE.SphereGeometry(0.028, 5, 3),
  crown: new THREE.CylinderGeometry(0.095, 0.125, 0.09, 6),
  beanie: new THREE.SphereGeometry(0.35, 14, 5, 0, Math.PI * 2, 0, Math.PI * 0.46),
  beanieRim: new THREE.TorusGeometry(0.335, 0.045, 4, 14),
  pom: new THREE.SphereGeometry(0.08, 6, 4),
  // 동물 (F17): 귀·꼬리·코·주둥이
  earCone: new THREE.ConeGeometry(0.1, 0.17, 6),
  earConeIn: new THREE.ConeGeometry(0.062, 0.115, 6),
  earFox: new THREE.ConeGeometry(0.12, 0.22, 6),
  earFoxIn: new THREE.ConeGeometry(0.072, 0.15, 6),
  earLong: new THREE.CapsuleGeometry(0.056, 0.26, 2, 6),
  earLongIn: new THREE.CapsuleGeometry(0.032, 0.2, 2, 5),
  earFlop: new THREE.CapsuleGeometry(0.075, 0.13, 2, 6),
  earRound: new THREE.SphereGeometry(0.085, 7, 5),
  earRoundIn: new THREE.SphereGeometry(0.05, 5, 3),
  muzzle: new THREE.SphereGeometry(0.11, 8, 6),
  nose: new THREE.SphereGeometry(0.028, 5, 3),
  tailThin: new THREE.CapsuleGeometry(0.035, 0.3, 2, 5),
  tailShort: new THREE.CapsuleGeometry(0.045, 0.12, 2, 5),
  tailBig: new THREE.CapsuleGeometry(0.085, 0.22, 2, 7),
  puff: new THREE.SphereGeometry(0.075, 6, 5),
};

/** 밤 장면에서도 캐릭터가 묻히지 않게 자기 색을 조금 스스로 낸다 */
const mat = (color: THREE.ColorRepresentation) =>
  new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.22) });
const MAT = {
  eye: new THREE.MeshBasicMaterial({ color: "#2a1d1a" }),
  white: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
  mouth: new THREE.MeshBasicMaterial({ color: "#9b4a45" }),
  noseDark: new THREE.MeshBasicMaterial({ color: "#2a1d1a" }),
  nosePink: new THREE.MeshBasicMaterial({ color: "#e47f90" }),
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
  earPink: mat("#f6a8b5"),
  sock: mat("#f6f2ea"),
  denim: mat("#3d4a63"),
  flowerCore: mat("#f7d24a"),
  petal: mat("#ff8fb0"),
  /** 족두리: 검정은 검은 머리에 묻혀서 짙은 자주 */
  jokduri: mat("#5a2d6e"),
};

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  return o;
}

/**
 * 여러 조각을 한 묶음 좌표로 놓은 뒤 뼈에 바로 붙인다.
 * 묶음(Group)을 남기면 mergeRig가 뼈로 보고 드로우콜이 늘어서, 묶음의 변환을 조각마다 굽는다
 */
function attach(bone: THREE.Object3D, frame: THREE.Object3D, parts: THREE.Object3D[]) {
  frame.updateMatrix();
  for (const p of parts) {
    p.updateMatrix();
    p.applyMatrix4(frame.matrix);
    bone.add(p);
  }
}

/** 두 색 섞기 (k = 0 이면 a, 1 이면 b) */
const mix = (a: string, b: string, k: number) =>
  `#${new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()}`;

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
  /** 색이 같은 재질은 한 번만 만든다 */
  private readonly mats = new Map<string, THREE.MeshLambertMaterial>();

  constructor(look: ChibiLook) {
    const style = styleOf(look);
    const c = colorsOf(style, look.gender, look.ageBand);

    const shadow = mesh(GEO.shadow, MAT.shadow, 0, 0.01, 0);
    shadow.rotation.x = -Math.PI / 2;
    this.root.add(shadow, this.body);

    const backZ = this.buildOutfit(style, c);
    const skin = this.mat(c.skin);

    // 팔 (어깨를 축으로 흔든다)
    const wide = style.outfit === "dopo";
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.2, 0.5, 0);
      arm.rotation.z = side * 0.32;
      const sleeve = mesh(GEO.sleeve, this.mat(this.sleeveColor(style, c)), 0, -0.11, 0);
      if (wide) sleeve.scale.set(1.3, 1, 1.3);
      arm.add(sleeve);
      arm.add(mesh(GEO.hand, skin, 0, -0.23, 0));
      this.arms.push(arm);
      this.body.add(arm);
    }

    // 머리
    this.head.position.y = 0.84;
    this.body.add(this.head);
    const face = mesh(GEO.head, skin);
    face.scale.set(1, 0.95, 0.97);
    this.head.add(face);
    if (style.species === "human") {
      for (const side of [-1, 1]) this.head.add(mesh(GEO.ear, skin, side * 0.31, -0.03, 0));
    }

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
    const snout = style.species === "dog" || style.species === "fox" || style.species === "bear";
    const mouth = mesh(GEO.mouth, MAT.mouth, 0, snout ? -0.14 : -0.1, snout ? 0.33 : 0.3);
    mouth.rotation.z = Math.PI;
    this.head.add(mouth);

    if (style.species !== "human") this.buildAnimal(style, c, backZ);
    this.buildHair(style, c);
    this.buildAccessory(style, c);
  }

  private mat(color: string): THREE.MeshLambertMaterial {
    let m = this.mats.get(color);
    if (!m) {
      m = mat(color);
      this.mats.set(color, m);
      this.owned.push(m);
    }
    return m;
  }

  private sleeveColor(s: AvatarStyle, c: { main: string; sub: string }) {
    return s.outfit === "dress" || s.outfit === "hoodie" ? c.main : c.sub;
  }

  /** 옷과 다리. 등 뒤 겉면의 z(꼬리를 붙일 자리)를 돌려준다 */
  private buildOutfit(s: AvatarStyle, c: ReturnType<typeof colorsOf>): number {
    const main = this.mat(c.main);
    const sub = this.mat(c.sub);
    const accent = this.mat(c.accent);
    const legMat =
      s.outfit === "jeogori"
        ? main
        : s.outfit === "hoodie"
          ? MAT.denim
          : s.outfit === "dress"
            ? this.mat(c.leg)
            : MAT.sock;
    const shoe = this.mat(c.shoe);

    // 다리 (엉덩이를 축으로 흔든다)
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.08, 0.2, 0);
      leg.add(mesh(GEO.leg, legMat, 0, -0.09, 0));
      const foot = mesh(GEO.shoe, shoe, 0, -0.17, 0.03);
      foot.scale.set(1, 0.6, 1.45);
      leg.add(foot);
      this.legs.push(leg);
      this.body.add(leg);
    }

    const goreums = (y: number, z: number, long: number) => {
      for (const [x, rz] of [
        [0.05, 0.35],
        [0.09, -0.1],
      ] as const) {
        const g = mesh(GEO.goreum, accent, x, y, z);
        g.rotation.z = rz;
        g.scale.y = long;
        this.body.add(g);
      }
    };
    const whiteCollar = () => {
      const collar = mesh(GEO.collar, MAT.collar, 0, 0.54, 0);
      collar.rotation.x = Math.PI / 2 - 0.15;
      this.body.add(collar);
    };

    switch (s.outfit) {
      case "dress": {
        // 통 원피스 (D-086·D-087): 한 덩어리 + 흰 동그란 깃 + 목 리본
        this.body.add(mesh(GEO.onePiece, main));
        for (const side of [-1, 1]) {
          const col = mesh(GEO.roundCollar, MAT.collar, side * 0.065, 0.525, 0.1);
          col.scale.set(1, 0.32, 0.85);
          col.rotation.set(-0.35, 0, side * -0.25);
          this.body.add(col);
        }
        for (const side of [-1, 1]) {
          const loop = mesh(GEO.bowLoop, accent, side * 0.035, 0.49, 0.16);
          loop.scale.set(0.8, 0.5, 0.4);
          loop.rotation.z = side * 0.4;
          this.body.add(loop);
        }
        return 0.25;
      }
      case "chima": {
        // 짧은 저고리 + 가슴부터 내려오는 치마 + 긴 고름
        const top = mesh(GEO.torso, sub, 0, 0.5, 0);
        top.scale.set(1.02, 0.55, 1.02);
        this.body.add(top, mesh(GEO.chimaSkirt, main));
        whiteCollar();
        goreums(0.44, 0.17, 1.5);
        return 0.27;
      }
      case "hoodie": {
        const torso = mesh(GEO.torso, main, 0, 0.37, 0);
        torso.scale.set(1.08, 1, 1.08);
        const hood = mesh(GEO.hood, main, 0, 0.6, -0.15);
        hood.scale.set(1.15, 0.55, 0.75);
        const pocket = mesh(GEO.pocket, this.mat(mix(c.main, "#000000", 0.12)), 0, 0.27, 0.172);
        this.body.add(torso, hood, pocket);
        for (const side of [-1, 1]) {
          this.body.add(mesh(GEO.string, MAT.collar, side * 0.04, 0.49, 0.168));
        }
        return 0.19;
      }
      case "dopo": {
        // 도포: 긴 겉옷 + 가슴 띠(세조대)
        this.body.add(mesh(GEO.dopoRobe, sub));
        whiteCollar();
        const sash = mesh(GEO.sash, main, 0, 0.42, 0);
        sash.rotation.x = Math.PI / 2;
        this.body.add(sash);
        for (const [x, rz] of [
          [0.05, 0.2],
          [0.09, -0.15],
        ] as const) {
          const t = mesh(GEO.goreum, main, x, 0.33, 0.2);
          t.rotation.z = rz;
          t.scale.set(0.6, 1.1, 1);
          this.body.add(t);
        }
        return 0.25;
      }
      default: {
        // 저고리·바지: 몸통 (저고리) + 동정 + 고름
        this.body.add(mesh(GEO.torso, sub, 0, 0.37, 0));
        whiteCollar();
        goreums(0.4, 0.165, 1);
        return 0.17;
      }
    }
  }

  /** 동물 (F17): 귀, 코, 주둥이, 꼬리. 얼굴·손은 이미 털 색 */
  private buildAnimal(s: AvatarStyle, c: ReturnType<typeof colorsOf>, backZ: number) {
    const fur = this.mat(c.skin);
    const light = this.mat(mix(c.skin, "#ffffff", 0.55));
    const h = this.head;

    /** 머리 위쪽 표면(옆으로 ang만큼)에서 바깥으로 기운 귀 한 쌍 */
    const ears = (
      geo: THREE.BufferGeometry,
      inner: THREE.BufferGeometry | null,
      innerMat: THREE.Material,
      ang: number,
      tilt: number,
      lift: number,
      flat: number,
    ) => {
      for (const side of [-1, 1]) {
        const dx = Math.sin(tilt) * side;
        const dy = Math.cos(tilt);
        const bx = Math.sin(ang) * 0.31 * side;
        const by = Math.cos(ang) * 0.31 * 0.95;
        const e = mesh(geo, fur, bx + dx * lift, by + dy * lift, -0.02);
        e.rotation.z = -tilt * side;
        e.scale.z = flat;
        h.add(e);
        if (inner) {
          const i = mesh(inner, innerMat, bx + dx * lift * 0.9, by + dy * lift * 0.9, 0.035);
          i.rotation.z = -tilt * side;
          i.scale.z = 0.4;
          h.add(i);
        }
      }
    };

    switch (s.species) {
      case "cat":
        ears(GEO.earCone, GEO.earConeIn, MAT.earPink, 0.62, 0.42, 0.06, 0.6);
        break;
      case "fox":
        ears(GEO.earFox, GEO.earFoxIn, light, 0.6, 0.38, 0.08, 0.6);
        break;
      case "rabbit":
        ears(GEO.earLong, GEO.earLongIn, MAT.earPink, 0.32, 0.14, 0.17, 0.55);
        break;
      case "bear":
        ears(GEO.earRound, GEO.earRoundIn, light, 0.72, 0.6, 0.0, 0.55);
        break;
      case "dog":
        // 늘어진 귀: 머리 옆에 매달린다
        for (const side of [-1, 1]) {
          const e = mesh(
            GEO.earFlop,
            this.mat(mix(c.skin, "#3a2418", 0.25)),
            side * 0.35,
            0.1,
            -0.02,
          );
          e.rotation.z = side * 0.55;
          e.scale.set(0.6, 1.1, 0.9);
          h.add(e);
        }
        break;
      default:
    }

    // 코와 주둥이 (강아지·여우·곰은 주둥이가 나온다)
    if (s.species === "dog" || s.species === "fox" || s.species === "bear") {
      const m = mesh(GEO.muzzle, light, 0, -0.11, 0.25);
      m.scale.set(1.15, 0.75, 0.75);
      h.add(m);
      const n = mesh(GEO.nose, MAT.noseDark, 0, -0.075, 0.322);
      n.scale.set(1.35, 0.95, 0.8);
      h.add(n);
    } else {
      const n = mesh(GEO.nose, MAT.nosePink, 0, -0.058, 0.3);
      n.scale.set(1, 0.75, 0.7);
      h.add(n);
    }

    // 꼬리: 등 뒤 겉면(backZ)에서 뒤로
    const tail = (geo: THREE.BufferGeometry, m: THREE.Material, tiltBack: number, len: number) => {
      const t = mesh(
        geo,
        m,
        0,
        0.22 + Math.cos(tiltBack) * len,
        -backZ + 0.01 - Math.sin(tiltBack) * len,
      );
      t.rotation.x = -tiltBack;
      this.body.add(t);
      return t;
    };
    switch (s.species) {
      case "cat":
        tail(GEO.tailThin, fur, 0.7, 0.17);
        break;
      case "dog":
        tail(GEO.tailShort, fur, 0.45, 0.09);
        break;
      case "fox": {
        tail(GEO.tailBig, fur, 1.0, 0.16);
        // 흰 꼬리 끝
        const len = 0.36;
        this.body.add(
          mesh(GEO.puff, light, 0, 0.22 + Math.cos(1.0) * len, -backZ + 0.01 - Math.sin(1.0) * len),
        );
        break;
      }
      case "rabbit":
        this.body.add(mesh(GEO.puff, light, 0, 0.23, -backZ - 0.03));
        break;
      case "bear": {
        const b = mesh(GEO.puff, fur, 0, 0.23, -backZ - 0.02);
        b.scale.setScalar(0.75);
        this.body.add(b);
        break;
      }
      default:
    }
  }

  /** 머리카락: 정수리 덮개 + 뒷머리 + 앞머리 + 옆머리, 그리고 모양마다 덧붙이는 것 */
  private buildHair(s: AvatarStyle, c: ReturnType<typeof colorsOf>) {
    if (s.hair === "none") return;
    const hair = this.mat(c.hair);
    const h = this.head;
    // 털모자를 쓰면 정수리는 가려지므로 덮개를 그리지 않는다 (삼각형 한도, 07 §3)
    const hat = s.acc === "beanie";
    if (!hat) {
      const cap = mesh(GEO.hairCap, hair, 0, 0.02, -0.03);
      cap.rotation.x = -0.62;
      h.add(cap);
    }
    const back = mesh(GEO.hairBack, hair, 0, -0.05, -0.11);
    back.scale.set(1.06, 1.02, 0.95);
    h.add(back);

    if (s.hair === "curly") {
      // 뽀글머리: 이마를 따라 다섯, 옆에 둘, 정수리에 셋
      for (let i = 0; i < 5; i++) {
        const ang = (i / 4 - 0.5) * 1.8;
        h.add(mesh(GEO.curl, hair, Math.sin(ang) * 0.27, 0.17, Math.cos(ang) * 0.22));
      }
      for (const side of [-1, 1]) h.add(mesh(GEO.curl, hair, side * 0.3, -0.02, -0.02));
      for (let i = 0; i < (hat ? 0 : 3); i++) {
        const az = (i / 3) * Math.PI * 2;
        h.add(mesh(GEO.curl, hair, Math.sin(az) * 0.15, 0.3, Math.cos(az) * 0.13 - 0.07));
      }
      return;
    }

    // 짧은 앞머리·옆머리(짧은머리·상투) / 긴 앞머리·옆머리(그 밖)
    const short = s.hair === "short" || s.hair === "topknot";
    const fringe = short ? 4 : 5;
    for (let i = 0; i < fringe; i++) {
      const t = i / (fringe - 1) - 0.5; // -0.5 ~ 0.5
      const ang = t * (short ? 1.4 : 1.7);
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
      h.add(b);
    }
    for (const side of [-1, 1]) {
      const lock = mesh(GEO.sideLock, hair, side * 0.285, short ? 0.02 : -0.06, 0.06);
      lock.scale.set(1, short ? 0.65 : 1.15, 0.8);
      lock.rotation.z = side * 0.12;
      h.add(lock);
    }

    const accent = this.mat(c.accent);
    switch (s.hair) {
      case "braid": {
        // 댕기머리
        const tail = mesh(GEO.tail, hair, 0, -0.2, -0.3);
        tail.rotation.x = 0.25;
        h.add(tail, mesh(GEO.ribbon, accent, 0, -0.36, -0.27));
        break;
      }
      case "long": {
        const long = mesh(GEO.longHair, hair, 0, -0.27, -0.17);
        long.scale.set(0.95, 1, 0.6);
        h.add(long);
        break;
      }
      case "bun":
        // 쪽머리
        h.add(mesh(GEO.bun, hair, 0, -0.12, -0.31));
        break;
      case "pigtails":
        for (const side of [-1, 1]) {
          const t = mesh(GEO.tail, hair, side * 0.3, -0.16, -0.1);
          t.rotation.z = side * 0.35;
          t.scale.set(0.95, 0.85, 0.95);
          const tie = mesh(GEO.bead, accent, side * 0.27, -0.02, -0.1);
          h.add(t, tie);
        }
        break;
      case "ponytail": {
        const t = mesh(GEO.tail, hair, 0, -0.04, -0.38);
        t.rotation.x = -0.45;
        h.add(t, mesh(GEO.bead, accent, 0, 0.1, -0.33));
        break;
      }
      case "topknot": {
        // 상투
        const k = mesh(GEO.bun, hair, 0, 0.33, -0.06);
        k.scale.set(0.62, 0.7, 0.62);
        h.add(k);
        break;
      }
      default:
    }
  }

  /** 머리 장식 (F17) */
  private buildAccessory(s: AvatarStyle, c: ReturnType<typeof colorsOf>) {
    const h = this.head;
    const accent = this.mat(c.accent);
    switch (s.acc) {
      case "gat":
        h.add(mesh(GEO.hatBrim, MAT.hat, 0, 0.25, 0), mesh(GEO.hatTop, MAT.hat, 0, 0.36, 0));
        break;
      case "binyeo": {
        const pin = mesh(GEO.pin, MAT.gold, 0, -0.12, -0.33);
        pin.rotation.z = Math.PI / 2;
        h.add(pin);
        break;
      }
      case "ribbon": {
        // 정수리 옆 큰 리본
        const f = new THREE.Object3D();
        f.position.set(0.17, 0.29, 0.06);
        f.rotation.set(0.1, 0.35, -0.5);
        f.scale.setScalar(1.3);
        const parts: THREE.Object3D[] = [];
        for (const side of [-1, 1]) {
          const loop = mesh(GEO.bowLoop, accent, side * 0.07, 0, 0);
          loop.scale.set(1.7, 1.15, 0.7);
          loop.rotation.z = side * 0.35;
          parts.push(loop);
        }
        parts.push(mesh(GEO.bead, accent, 0, 0, 0.012));
        attach(h, f, parts);
        break;
      }
      case "flower": {
        // 귀 위 꽃 한 송이 (꽃잎 다섯 + 가운데)
        const f = new THREE.Object3D();
        f.position.set(-0.21, 0.23, 0.17);
        f.rotation.set(-0.2, -0.6, 0);
        f.scale.setScalar(1.5);
        const petal = MAT.petal;
        const parts: THREE.Object3D[] = [];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const p = mesh(GEO.petal, petal, Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0);
          p.scale.set(1, 1, 0.45);
          parts.push(p);
        }
        parts.push(mesh(GEO.bead, MAT.flowerCore, 0, 0, 0.02));
        attach(h, f, parts);
        break;
      }
      case "jokduri": {
        // 족두리: 정수리에 얹는 작은 관 + 구슬
        const f = new THREE.Object3D();
        f.position.set(0, 0.4, -0.01);
        f.rotation.x = -0.2;
        f.scale.setScalar(1.35);
        attach(h, f, [
          mesh(GEO.crown, MAT.jokduri),
          mesh(GEO.bead, MAT.gold, 0, 0.07, 0),
          mesh(GEO.bead, MAT.gold, -0.07, 0.0, 0.09),
          mesh(GEO.bead, accent, 0, 0.01, 0.12),
          mesh(GEO.bead, MAT.gold, 0.07, 0.0, 0.09),
        ]);
        break;
      }
      case "beanie": {
        // 털모자: 정수리를 덮고 이마에 둘레, 위에 방울
        const f = new THREE.Object3D();
        f.position.set(0, 0.035, -0.02);
        f.rotation.x = -0.28;
        const rim = mesh(GEO.beanieRim, this.mat(mix(c.accent, "#ffffff", 0.35)), 0, 0.075, 0);
        rim.rotation.x = Math.PI / 2;
        attach(h, f, [
          mesh(GEO.beanie, accent),
          rim,
          mesh(GEO.pom, this.mat(mix(c.accent, "#ffffff", 0.6)), 0, 0.36, 0),
        ]);
        break;
      }
      default:
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
    // 걸음 빠르기: 걷는 속도(3.0m/s, D-092)에 맞춰 발이 미끄러져 보이지 않게
    this.phase = moving ? this.phase + dt * 14 : this.phase * 0.85;
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
