/**
 * 점술가 NPC 4명 (04a 캐릭터 설정, 08 §1 캐릭터 구성 규칙). 방석에 앉아 탁자 너머 플레이어(+z)를 본다.
 * 기본 도형으로 만들고 뼈마다 합쳐 1명 드로우콜 약 12개, 5,000 삼각형 이하 (07 §3).
 * 애니메이션은 코드로 계산한다: 동작마다 자세를 함수로 정하고, 동작이 바뀌면 0.35초 동안 섞는다.
 */
import type { ShopId } from "@fortune/shared-types";
import type * as THREE from "three";
import { LOOKS } from "./npc-looks";
import { type NpcBones, bump, makeBones, talkMouth } from "./npc-parts";
import { RigBuilder, countMeshes, countTriangles, flatMaterial, selfLitMaterial } from "./rig";

export type NpcAction = "idle" | "greet" | "talk" | "present" | "celebrate";

/** 한 번만 하고 돌아가는 동작의 길이(초). 나머지는 다른 동작을 부를 때까지 이어진다 */
export const ONE_SHOT: Partial<Record<NpcAction, number>> = { greet: 1.9, celebrate: 1.8 };

const KEYS = [
  "lean",
  "twist",
  "sway",
  "bob",
  "headX",
  "headY",
  "headZ",
  "armLx",
  "armLy",
  "armLz",
  "armRx",
  "armRy",
  "armRz",
  "handLx",
  "handLy",
  "handLz",
  "handRx",
  "handRy",
  "handRz",
  "mouth",
  "squint",
  "prop",
] as const;
export type Pose = Record<(typeof KEYS)[number], number>;

/** 탁자 가장자리에 두 손을 얹은 기본 자세 */
const REST: Pose = {
  lean: 0,
  twist: 0,
  sway: 0,
  bob: 0,
  // 카메라가 위에 있으니 고개를 살짝 들어 플레이어를 본다
  headX: -0.1,
  headY: 0,
  headZ: 0,
  armLx: -0.95,
  armLy: 0,
  armLz: 0.22,
  armRx: -0.95,
  armRy: 0,
  armRz: -0.22,
  handLx: 0,
  handLy: 0,
  handLz: 0,
  handRx: 0,
  handRy: 0,
  handRz: 0,
  mouth: 0,
  squint: 0,
  prop: 0,
};

export interface Character {
  /** 몸 크기 (아이는 작게) */
  scale: number;
  /** 엉덩이 높이 (몸 뼈 y) */
  hipY: number;
  /** 쉬는 자세 덮어쓰기 */
  rest?: Partial<Pose>;
  /** 동작별 자세: 공통 자세 계산 뒤에 불린다. t = 동작 시작 후 초, time = 전체 시간 */
  act?(a: NpcAction, t: number, p: Pose, time: number): void;
  /** p.prop 같은 소품 상태를 뼈에 반영한다 */
  apply?(p: Pose, time: number): void;
}

export type LookBuilder = (rig: RigBuilder, b: NpcBones) => Character;

/** 공통 동작 자세 */
function basePose(a: NpcAction, t: number, time: number, p: Pose) {
  // 쉴 때도 고개가 아주 천천히 움직인다
  p.headZ += Math.sin(time * 0.7) * 0.035;
  p.headY += Math.sin(time * 0.37) * 0.06;
  switch (a) {
    case "idle":
      break;
    case "greet": {
      // 고개 숙여 인사
      const e = bump(t, 0.35, 1.6, 0.45);
      p.lean += 0.3 * e;
      p.headX += 0.25 * e;
      p.squint = e;
      p.mouth = 0.25 * bump(t, 0.2, 0.9);
      break;
    }
    case "talk":
      p.mouth = talkMouth(t);
      p.headX += Math.sin(t * 3.3) * 0.045;
      p.headZ += Math.sin(t * 1.7) * 0.06;
      p.armRx += -0.28 - 0.16 * Math.sin(t * 2.1);
      p.armRz += -0.12 * (0.5 + 0.5 * Math.sin(t * 1.3));
      p.handRz += 0.2 * Math.sin(t * 2.1 + 0.6);
      break;
    case "present": {
      // 몸을 숙여 탁자 위를 내민다
      const e = Math.min(1, t / 0.5);
      p.lean += 0.1 * e;
      p.headX += 0.04 * e;
      p.armLx = -1.32;
      p.armRx = -1.32;
      p.armLz = 0.16;
      p.armRz = -0.16;
      break;
    }
    case "celebrate": {
      const e = bump(t, 0.15, 1.7, 0.35);
      p.bob += Math.abs(Math.sin(t * 10)) * 0.05 * e;
      p.squint = e;
      p.mouth = 0.55 * e;
      p.headX -= 0.12 * e;
      p.armLx += (-0.75 - p.armLx) * e;
      p.armRx += (-0.75 - p.armRx) * e;
      p.armLz += (2.3 - p.armLz) * e;
      p.armRz += (-2.3 - p.armRz) * e;
      p.armLz += Math.sin(t * 10) * 0.15 * e;
      p.armRz -= Math.sin(t * 10) * 0.15 * e;
      break;
    }
  }
}

export class Npc {
  readonly root: THREE.Group;
  private readonly bones: NpcBones;
  private readonly char: Character;
  private readonly owned: { dispose(): void }[] = [];
  private action: NpcAction = "idle";
  /** 한 번짜리 동작이 끝나면 돌아갈 동작 */
  private loop: NpcAction = "idle";
  private t = 0;
  private time = 0;
  private fade = 1;
  private from: Pose = { ...REST };
  private cur: Pose = { ...REST };
  private readonly target: Pose = { ...REST };
  private nextBlink = 2;
  /** 동작이 바뀔 때 (방 안 소품 연출용) */
  onAction?: (a: NpcAction) => void;

  constructor(shop: ShopId) {
    const b = makeBones();
    this.bones = b;
    this.root = b.root;
    const rig = new RigBuilder();
    this.char = LOOKS[shop](rig, b);
    const lit = selfLitMaterial(0.2);
    const flat = flatMaterial();
    this.owned.push(lit, flat, ...rig.build(lit, flat));
    b.root.scale.setScalar(this.char.scale);
    b.body.position.y = this.char.hipY;
    this.cur = this.restPose();
    this.from = { ...this.cur };
    this.update(0);
  }

  private restPose(): Pose {
    return { ...REST, ...this.char.rest };
  }

  get current(): NpcAction {
    return this.action;
  }

  play(a: NpcAction) {
    this.from = { ...this.cur };
    this.fade = 0;
    this.action = a;
    this.t = 0;
    if (!ONE_SHOT[a]) this.loop = a;
    this.onAction?.(a);
  }

  update(dt: number) {
    this.t += dt;
    this.time += dt;
    this.fade = Math.min(1, this.fade + dt / 0.35);
    const dur = ONE_SHOT[this.action];
    if (dur !== undefined && this.t >= dur) this.play(this.loop);

    const p = this.target;
    Object.assign(p, this.restPose());
    basePose(this.action, this.t, this.time, p);
    this.char.act?.(this.action, this.t, p, this.time);
    const f = this.fade * this.fade * (3 - 2 * this.fade);
    for (const k of KEYS) this.cur[k] = this.from[k] + (p[k] - this.from[k]) * f;

    const c = this.cur;
    const b = this.bones;
    const breathe = Math.sin(this.time * 2.0) * 0.01;
    b.body.position.y = this.char.hipY + c.bob;
    b.body.rotation.set(c.lean, c.twist, c.sway);
    b.body.scale.set(1 - breathe * 0.4, 1 + breathe, 1 - breathe * 0.4);
    b.head.rotation.set(c.headX, c.headY, c.headZ);
    b.armL.rotation.set(c.armLx, c.armLy, c.armLz);
    b.armR.rotation.set(c.armRx, c.armRy, c.armRz);
    b.handL.rotation.set(c.handLx, c.handLy, c.handLz);
    b.handR.rotation.set(c.handRx, c.handRy, c.handRz);
    const talking = c.mouth > 0.1;
    b.smile.visible = !talking;
    b.open.visible = talking;
    b.open.scale.set(0.8 + c.mouth * 0.3, 0.25 + c.mouth * 0.95, 1);

    // 깜빡임 + 눈웃음
    this.nextBlink -= dt;
    const closed = this.nextBlink < 0.12 && this.nextBlink > 0;
    if (this.nextBlink <= 0) this.nextBlink = 2.2 + Math.random() * 3;
    b.eyes.scale.y = closed ? 0.12 : 1 - 0.55 * c.squint;
    this.char.apply?.(c, this.time);
  }

  /** 삼각형 수 (숨겨 둔 소품 포함, 07 §3 한도 확인용) */
  triangles(): number {
    return countTriangles(this.root);
  }

  meshes(): number {
    return countMeshes(this.root);
  }

  dispose() {
    for (const d of this.owned) d.dispose();
    this.owned.length = 0;
  }
}
