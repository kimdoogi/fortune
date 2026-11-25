/**
 * 점술가 NPC 공통 조각 (08 §1 캐릭터 구성 규칙을 따르되 앉은 자세, 머리를 조금 더 크게).
 * 좌표는 각 뼈 기준이다. 머리 뼈는 목에 있고 머리 중심은 그 위 HC.
 */
import * as THREE from "three";
import { at } from "./geo";
import type { RigBuilder } from "./rig";

/** 목(머리 뼈)에서 머리 중심까지 */
export const HC = 0.31;

export interface NpcBones {
  root: THREE.Group;
  /** 엉덩이 축: 숙이기·들썩이기 */
  body: THREE.Group;
  /** 목 축 */
  head: THREE.Group;
  /** 두 눈 (y 크기로 깜빡임) */
  eyes: THREE.Group;
  /** 다문 입 (웃는 선) */
  smile: THREE.Group;
  /** 벌린 입 (말할 때 y 크기) */
  open: THREE.Group;
  /** 어깨 축. R은 점술가 자신의 오른손 (화면에서는 왼쪽, -x) */
  armL: THREE.Group;
  armR: THREE.Group;
  /** 손목 축 (소품을 붙인다) */
  handL: THREE.Group;
  handR: THREE.Group;
}

export function makeBones(): NpcBones {
  const g = () => new THREE.Group();
  const b: NpcBones = {
    root: g(),
    body: g(),
    head: g(),
    eyes: g(),
    smile: g(),
    open: g(),
    armL: g(),
    armR: g(),
    handL: g(),
    handR: g(),
  };
  b.root.add(b.body);
  b.body.add(b.head, b.armL, b.armR);
  b.head.add(b.eyes, b.smile, b.open);
  b.armL.add(b.handL);
  b.armR.add(b.handR);
  b.head.position.y = 0.4;
  b.armL.position.set(0.2, 0.32, 0);
  b.armR.position.set(-0.2, 0.32, 0);
  b.handL.position.y = -0.29;
  b.handR.position.y = -0.29;
  return b;
}

export const sphere = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);

/** 머리 구 표면의 앞쪽 z (얼굴 조각을 붙일 깊이) */
export function faceZ(R: number, x: number, y: number, inset = 0.01) {
  return Math.sqrt(Math.max(0, R * R - x * x - y * y)) * 0.97 - inset;
}

export interface HeadOpts {
  R: number;
  skin: string;
}

/** 얼굴 구 + 귀 */
export function addHead(rig: RigBuilder, b: NpcBones, o: HeadOpts) {
  const face = sphere(o.R, 18, 12);
  face.scale(1, 0.95, 0.97);
  rig.add(b.head, at(face, 0, HC, 0), o.skin);
  for (const s of [-1, 1]) {
    const ear = sphere(0.062, 8, 6);
    ear.scale(0.7, 1, 0.8);
    rig.add(b.head, at(ear, s * o.R * 0.96, HC - 0.03, 0), o.skin);
  }
}

export type EyeKind = "round" | "dot" | "arc";

export interface EyeOpts {
  R: number;
  kind: EyeKind;
  color: string;
  /** 두 눈 사이 반 간격 */
  ex?: number;
  ey?: number;
  size?: number;
  /** 위 속눈썹 선 (달님 언니) */
  lash?: string;
}

/** 두 눈. 눈 뼈 원점을 눈높이에 두어 y 크기만 바꾸면 깜빡인다 */
export function addEyes(rig: RigBuilder, b: NpcBones, o: EyeOpts) {
  const ex = o.ex ?? 0.11;
  const ey = o.ey ?? -0.01;
  const s = o.size ?? 1;
  b.eyes.position.set(0, HC + ey, 0);
  for (const side of [-1, 1]) {
    const x = side * ex;
    const z = faceZ(o.R, x, ey);
    if (o.kind === "arc") {
      // 눈웃음 ∩
      const arc = new THREE.TorusGeometry(0.046 * s, 0.013, 4, 10, Math.PI);
      rig.addFlat(b.eyes, at(arc, x, -0.015, z + 0.005), o.color);
      continue;
    }
    const r = (o.kind === "dot" ? 0.036 : 0.056) * s;
    const ball = sphere(r, 8, 6);
    ball.scale(1, o.kind === "dot" ? 1.15 : 1.28, 0.55);
    rig.addFlat(b.eyes, at(ball, x, 0, z), o.color);
    rig.addFlat(b.eyes, at(sphere(r * 0.34, 6, 4), x + r * 0.35, r * 0.45, z + r * 0.5), "#ffffff");
    if (o.kind === "round")
      rig.addFlat(
        b.eyes,
        at(sphere(r * 0.18, 5, 3), x - r * 0.3, -r * 0.45, z + r * 0.5),
        "#ffffff",
      );
    if (o.lash) {
      const lid = new THREE.TorusGeometry(r * 1.08, 0.011, 4, 10, Math.PI * 0.9);
      lid.rotateZ(Math.PI * 0.05);
      rig.addFlat(b.eyes, at(lid, x, r * 0.15, z + 0.006), o.lash);
      const wing = new THREE.BoxGeometry(0.034, 0.012, 0.01);
      wing.rotateZ(side * 0.5);
      rig.addFlat(b.eyes, at(wing, x + side * r * 1.15, r * 0.55, z - 0.004), o.lash);
    }
  }
}

/** 눈썹: 바깥쪽 끝을 tilt만큼 내린다 */
export function addBrows(
  rig: RigBuilder,
  b: NpcBones,
  R: number,
  color: string,
  o: { y: number; ex?: number; len: number; thick: number; tilt: number },
) {
  for (const side of [-1, 1]) {
    const x = side * (o.ex ?? 0.115);
    const brow = new THREE.CapsuleGeometry(o.thick, o.len, 3, 6);
    brow.rotateZ(Math.PI / 2 - side * o.tilt);
    rig.add(b.head, at(brow, x, HC + o.y, faceZ(R, x, o.y, 0.0)), color);
  }
}

/** 입: 다문 웃음선 + 벌린 입 (말할 때 바꿔 보인다) */
export function addMouth(rig: RigBuilder, b: NpcBones, R: number, lip: string, y = -0.1) {
  const z = faceZ(R, 0, y, 0.0);
  b.smile.position.set(0, HC + y, z);
  b.open.position.set(0, HC + y - 0.01, z - 0.012);
  const smile = new THREE.TorusGeometry(0.032, 0.01, 4, 8, Math.PI);
  smile.rotateZ(Math.PI);
  rig.addFlat(b.smile, smile, lip);
  const open = sphere(0.042, 10, 6);
  open.scale(1, 0.85, 0.35);
  rig.addFlat(b.open, open, "#6e2a2c");
  const tongue = sphere(0.026, 8, 4);
  tongue.scale(1, 0.6, 0.3);
  rig.addFlat(b.open, at(tongue, 0, -0.018, 0.006), "#e0767a");
}

export function addCheeks(rig: RigBuilder, b: NpcBones, R: number, color: string, size = 1) {
  for (const side of [-1, 1]) {
    const x = side * 0.19;
    const y = -0.075;
    const c = new THREE.CircleGeometry(0.048 * size, 12);
    c.scale(1, 0.75, 1);
    c.rotateY(side * 0.6);
    rig.addFlat(b.head, at(c, x, HC + y, faceZ(R, x, y, 0.004)), color);
  }
}

/** 몸통 (저고리). 위아래 색을 다르게 줄 수 있다 */
export function addTorso(
  rig: RigBuilder,
  b: NpcBones,
  color: string,
  o: { r?: number; len?: number; y?: number; depth?: number } = {},
) {
  const t = new THREE.CapsuleGeometry(o.r ?? 0.19, o.len ?? 0.14, 3, 12);
  t.scale(1, 1, o.depth ?? 0.85);
  rig.add(b.body, at(t, 0, o.y ?? 0.17, 0), color);
}

/** 앉은 아랫도리: 방석 위에 퍼진 치마·도포 자락 */
export function addSeat(
  rig: RigBuilder,
  b: NpcBones,
  color: string,
  o: { w?: number; h?: number; d?: number } = {},
) {
  const s = sphere(1, 14, 8);
  s.scale(o.w ?? 0.42, o.h ?? 0.17, o.d ?? 0.36);
  rig.add(b.root, at(s, 0, 0.1, 0.04), color);
  // 무릎 두 개가 앞으로 살짝 보인다
  for (const side of [-1, 1]) {
    const k = sphere(0.13, 8, 5);
    k.scale(1, 0.65, 1);
    rig.add(b.root, at(k, side * 0.16, 0.12, 0.22), color);
  }
}

/** 소매(손목 쪽이 넓은 한복 소매) + 손. 소매 끝에 끝동 색을 줄 수 있다 */
export function addArm(
  rig: RigBuilder,
  arm: THREE.Group,
  hand: THREE.Group,
  o: { sleeve: string; skin: string; cuff?: string; wide?: number; len?: number },
) {
  const len = o.len ?? 0.27;
  const wide = o.wide ?? 0.1;
  const sl = new THREE.CylinderGeometry(0.065, wide, len, 10, 1);
  rig.add(arm, at(sl, 0, -len / 2, 0), o.sleeve);
  const shoulder = sphere(0.068, 8, 6);
  rig.add(arm, shoulder, o.sleeve);
  if (o.cuff) {
    const c = new THREE.CylinderGeometry(wide + 0.004, wide + 0.006, 0.05, 10, 1, true);
    rig.add(arm, at(c, 0, -len + 0.02, 0), o.cuff);
  }
  hand.position.y = -len - 0.02;
  const h = sphere(0.05, 8, 6);
  h.scale(1, 1.05, 0.85);
  rig.add(hand, h, o.skin);
}

/** 어깨에 두르는 숄·망토 (목에서 아래로 퍼지는 회전체) */
export function shawlGeometry(o: {
  top: number;
  bottom: number;
  y0: number;
  y1: number;
  seg?: number;
}): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // 어깨에서 둥글게 부풀었다가 아래로 떨어진다
    const r = o.top + (o.bottom - o.top) * Math.sin((t * Math.PI) / 2) ** 0.8;
    pts.push(new THREE.Vector2(r, o.y0 + (o.y1 - o.y0) * t));
  }
  // 아래에서 위 순서여야 면이 바깥을 본다
  return new THREE.LatheGeometry(pts.reverse(), o.seg ?? 18);
}

/** 0 → 1 → 0 봉우리: rise초 동안 오르고 end-fall부터 내려온다 */
export function bump(t: number, rise: number, end: number, fall = rise) {
  if (t <= 0 || t >= end) return 0;
  const up = Math.min(1, t / rise);
  const down = Math.min(1, (end - t) / fall);
  const k = Math.min(up, down);
  return k * k * (3 - 2 * k);
}

/** 말할 때 입 벌림: 음절처럼 불규칙하게 */
export function talkMouth(t: number) {
  const v = Math.sin(t * 15) * 0.5 + 0.5;
  const gate = Math.sin(t * 2.3) * Math.sin(t * 3.7 + 1) > -0.35 ? 1 : 0.15;
  return v * gate * 0.85;
}
