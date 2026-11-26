/**
 * 점술가 네 사람의 생김새와 동작 (04a 캐릭터 표).
 * 청운 선생: 흰 수염·갓·쥘부채의 70대 선비 / 달님 언니: 별무늬 숄의 20대 후반 /
 * 아기도령: 색동저고리·방울·오방기의 일곱 살 / 몽실 할매: 쪽진 머리·털실 숄·찻잔의 80대 /
 * 족집게 도사: 짧은 검은 머리·콧수염·남색 두루마기·큰 황동 돋보기의 40대 (D-100).
 */
import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import { at, beam, colored } from "./geo";
import type { LookBuilder } from "./npc";
import {
  HC,
  type NpcBones,
  addArm,
  addBrows,
  addCheeks,
  addEyes,
  addHead,
  addMouth,
  addSeat,
  addTorso,
  bump,
  faceZ,
  shawlGeometry,
  sphere,
} from "./npc-parts";
import type { RigBuilder } from "./rig";

const OBANG = ["#d9413a", "#f2c230", "#3c6fd6", "#f4f1ea", "#3f9a55"];

/** 세로 줄무늬로 칠한다 (색동 소매, 뜨개 숄). 면 가운데 높이로 띠를 고른다 */
function stripes(geo: THREE.BufferGeometry, colors: string[], y0: number, y1: number) {
  const g = colored(geo, colors[0] as string);
  const pos = g.getAttribute("position");
  const col = g.getAttribute("color");
  const cs = colors.map((c) => new THREE.Color(c));
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const k = Math.floor(((y - y0) / (y1 - y0)) * cs.length);
    const c = cs[Math.max(0, Math.min(cs.length - 1, k))] as THREE.Color;
    for (let j = 0; j < 3; j++) col.setXYZ(i + j, c.r, c.g, c.b);
  }
  return g;
}

/** 머리카락 덮개 (정수리부터 이마까지) */
function hairCap(R: number, tilt = -0.6, cover = 0.6) {
  const g = new THREE.SphereGeometry(R * 1.05, 18, 8, 0, Math.PI * 2, 0, Math.PI * cover);
  g.rotateX(tilt);
  return g;
}

/** 이마를 따라 앞머리 덩어리 */
function bangs(
  rig: RigBuilder,
  b: NpcBones,
  R: number,
  color: string,
  n: number,
  spread: number,
  o: { y?: number; size?: number; skew?: number } = {},
) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5 + (o.skew ?? 0);
    const ang = t * spread;
    const bang = sphere(0.1 * (o.size ?? 1), 8, 6);
    bang.scale(1.1, 0.75, 0.6);
    bang.rotateZ(-t * 0.6);
    bang.rotateY(ang);
    rig.add(
      b.head,
      at(
        bang,
        Math.sin(ang) * R * 0.86,
        HC + (o.y ?? 0.19) - Math.abs(t) * 0.07,
        Math.cos(ang) * R * 0.77,
      ),
      color,
    );
  }
}

/** 소품을 든 손: 팔 각도와 반대로 돌려 소품이 늘 위를 보게 한다 */
function upright(prop: THREE.Object3D, armX: number, handX: number, tilt: number) {
  prop.rotation.x = -(armX + handX) + tilt;
}

// ───────────────────────── 사주집: 청운 선생 ─────────────────────────
const saju: LookBuilder = (rig, b) => {
  const R = 0.32;
  const skin = "#f3cfb3";
  const robe = "#eef0e6";
  const navy = "#2c3550";
  const hat = "#211f26";
  const white = "#f7f5ef";
  addSeat(rig, b, robe, { w: 0.46, h: 0.18, d: 0.38 });
  addTorso(rig, b, robe, { r: 0.2 });
  // 깃(남색 V) + 동정(흰 띠)
  for (const s of [-1, 1]) {
    rig.add(
      b.body,
      beam(
        new THREE.Vector3(s * 0.11, 0.43, 0.1),
        new THREE.Vector3(-s * 0.03, 0.2, 0.175),
        0.06,
        0.02,
      ),
      navy,
    );
    rig.add(
      b.body,
      beam(
        new THREE.Vector3(s * 0.08, 0.44, 0.12),
        new THREE.Vector3(-s * 0.005, 0.3, 0.182),
        0.025,
        0.02,
      ),
      white,
    );
  }
  // 세조대 (붉은 띠와 늘어진 술)
  const sash = new THREE.TorusGeometry(0.198, 0.016, 5, 20);
  sash.rotateX(Math.PI / 2);
  sash.scale(1, 1, 0.86);
  rig.add(b.body, at(sash, 0, 0.17, 0), "#b8443a");
  for (const s of [0.04, 0.09]) {
    rig.add(
      b.body,
      beam(
        new THREE.Vector3(s, 0.17, 0.175),
        new THREE.Vector3(s + 0.02, -0.02, 0.2),
        0.016,
        0.016,
      ),
      "#b8443a",
    );
    rig.add(b.body, at(sphere(0.022, 6, 4), s + 0.02, -0.03, 0.2), "#e0b04a");
  }
  addArm(rig, b.armL, b.handL, { sleeve: robe, skin, wide: 0.125 });
  addArm(rig, b.armR, b.handR, { sleeve: robe, skin, wide: 0.125 });

  addHead(rig, b, { R, skin });
  addEyes(rig, b, { R, kind: "dot", color: "#2a1d1a", ey: -0.01 });
  addBrows(rig, b, R, white, { y: 0.075, len: 0.08, thick: 0.03, tilt: 0.4 });
  addMouth(rig, b, R, "#9b4a45", -0.125);
  addCheeks(rig, b, R, "#f0a39a", 0.85);
  rig.add(b.head, at(sphere(0.035, 8, 6), 0, HC - 0.06, faceZ(R, 0, -0.06, -0.01)), "#eab899");
  // 흰 옆머리·뒷머리
  const back = sphere(0.3, 12, 8);
  back.scale(1.06, 0.92, 0.95);
  rig.add(b.head, at(back, 0, HC + 0.02, -0.11), "#d7d2ca");
  // 망건
  rig.add(
    b.head,
    at(new THREE.CylinderGeometry(0.322, 0.33, 0.07, 22, 1, true), 0, HC + 0.15, -0.01),
    hat,
  );
  // 갓: 넓은 챙 + 대우 + 띠
  rig.add(
    b.head,
    at(new THREE.CylinderGeometry(0.44, 0.45, 0.012, 32), 0, HC + 0.27, 0),
    "#2e2a34",
  );
  rig.add(b.head, at(new THREE.CylinderGeometry(0.11, 0.135, 0.2, 16), 0, HC + 0.38, 0), hat);
  rig.add(
    b.head,
    at(
      new THREE.SphereGeometry(0.11, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.25, 1),
      0,
      HC + 0.48,
      0,
    ),
    hat,
  );
  rig.add(
    b.head,
    at(new THREE.CylinderGeometry(0.138, 0.138, 0.035, 16), 0, HC + 0.3, 0),
    "#4a4552",
  );
  // 갓끈: 호박 구슬이 양 볼을 따라 가슴까지
  for (const s of [-1, 1]) {
    const p0 = new THREE.Vector3(s * 0.33, HC + 0.26, 0.1);
    const c = new THREE.Vector3(s * 0.38, HC - 0.25, 0.2);
    const p1 = new THREE.Vector3(s * 0.16, HC - 0.52, 0.24);
    const v = new THREE.Vector3();
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      v.set(0, 0, 0)
        .addScaledVector(p0, (1 - t) ** 2)
        .addScaledVector(c, 2 * t * (1 - t))
        .addScaledVector(p1, t * t);
      rig.add(b.head, at(new THREE.IcosahedronGeometry(0.017, 0), v.x, v.y, v.z), "#c9822f");
    }
  }
  // 수염: 턱 덩어리 + 길게 늘어진 고깔 + 콧수염
  const chin = sphere(0.14, 12, 8);
  chin.scale(1.05, 0.8, 0.7);
  rig.add(b.head, at(chin, 0, HC - 0.2, 0.2), white);
  // 수염: 물방울 모양 회전체 (끝이 둥글게 모인다)
  const bp: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    bp.push(
      new THREE.Vector2(Math.sin(t * Math.PI) ** 0.7 * 0.13 * (1 - t * 0.55) + 0.004, -t * 0.42),
    );
  }
  const beard = new THREE.LatheGeometry(bp.reverse(), 12);
  beard.scale(1, 1, 0.75);
  beard.rotateX(-0.3);
  rig.add(b.head, at(beard, 0, HC - 0.17, 0.2), white);
  for (const s of [-1, 1]) {
    const m = new THREE.CapsuleGeometry(0.028, 0.09, 3, 6);
    m.rotateZ(s * 1.05);
    rig.add(b.head, at(m, s * 0.065, HC - 0.1, faceZ(R, 0.06, -0.1, -0.015)), white);
  }

  // 쥘부채 (오른손). 접힌 대 + 펼친 부채, p.prop으로 펼친다
  const fan = new THREE.Group();
  b.handR.add(fan);
  const closed = new THREE.Group();
  const open = new THREE.Group();
  fan.add(closed, open);
  rig.add(closed, at(new THREE.BoxGeometry(0.035, 0.27, 0.02), 0, 0.12, 0.02), "#b98a52");
  rig.add(closed, at(new THREE.BoxGeometry(0.037, 0.04, 0.022), 0, 0.23, 0.02), "#3b2a1e");
  const paper = new THREE.CircleGeometry(0.3, 14, Math.PI / 2 - 1.15, 2.3);
  const paperBack = paper.clone();
  paperBack.rotateY(Math.PI);
  rig.add(open, at(paper, 0, 0, 0.022), "#f2e8cc");
  rig.add(open, at(paperBack, 0, 0, 0.018), "#e8dcbc");
  const band = new THREE.RingGeometry(0.255, 0.3, 14, 1, Math.PI / 2 - 1.15, 2.3);
  rig.add(open, at(band, 0, 0, 0.024), "#6d3b2b");
  // 먹 산수: 작은 산 세 개
  for (const [x, y, s] of [
    [-0.07, 0.17, 0.05],
    [0.03, 0.19, 0.065],
    [0.11, 0.16, 0.04],
  ] as const) {
    const m = new THREE.CircleGeometry(s, 3, Math.PI / 2);
    m.scale(1.4, 1, 1);
    rig.add(open, at(m, x, y, 0.026), "#7d7f86");
  }
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI / 2 - 1.15 + (2.3 * i) / 6;
    rig.add(
      open,
      beam(
        new THREE.Vector3(0, 0, 0.02),
        new THREE.Vector3(Math.cos(a) * 0.29, Math.sin(a) * 0.29, 0.02),
        0.006,
        0.012,
      ),
      "#9a6a3c",
    );
  }
  rig.add(fan, at(sphere(0.02, 6, 4), 0, -0.02, 0.02), "#b8443a");
  rig.add(
    fan,
    beam(new THREE.Vector3(0, -0.02, 0.02), new THREE.Vector3(0.01, -0.13, 0.03), 0.012, 0.012),
    "#b8443a",
  );

  return {
    scale: 1.0,
    hipY: 0.16,
    rest: { armRx: -1.05, armRz: -0.3, handRx: 0 },
    act(a, t, p) {
      if (a === "greet") {
        // 부채를 펴 가슴에 대고 고개 숙여 인사
        const e = bump(t, 0.35, 1.6, 0.45);
        p.prop = bump(t, 0.25, 1.8, 0.3);
        p.armRx += (-1.35 - p.armRx) * e;
        p.armRz += (0.2 - p.armRz) * e;
      } else if (a === "talk") {
        p.prop = 1;
        p.handRz = Math.sin(t * 2.6) * 0.22;
        p.armRz -= 0.1;
      } else if (a === "present") {
        // 왼손을 펴 사주판을 가리키고, 접은 부채로 짚는다
        p.prop = 0;
        p.armLx = -1.38;
        p.armLz = 0.05;
        p.armRx = -1.2;
        p.armRz = -0.15;
      } else if (a === "celebrate") {
        // 껄껄: 어깨가 들썩이고 부채를 부친다, 왼손은 수염을 쓸어내린다
        const e = bump(t, 0.15, 1.7, 0.35);
        p.armLx = -0.95 + (-1.75 + 0.95) * e;
        p.armLz = 0.22 + (-0.55 - 0.22) * e + Math.sin(t * 5) * 0.06 * e;
        p.armRx = -1.05 + (-1.45 + 1.05) * e;
        p.armRz = -0.3 + (-0.6 + 0.3) * e;
        p.handRz = Math.sin(t * 13) * 0.35 * e;
        p.bob = Math.abs(Math.sin(t * 12)) * 0.018 * e;
        p.prop = e;
      }
    },
    apply(p) {
      upright(fan, p.armRx, p.handRx, 0.35);
      const f = Math.max(0, Math.min(1, p.prop));
      open.visible = f > 0.12;
      closed.visible = !open.visible;
      open.scale.set(Math.max(0.05, f), 0.6 + f * 0.4, 1);
    },
  };
};

// ───────────────────────── 타로집: 달님 언니 ─────────────────────────
const tarot: LookBuilder = (rig, b) => {
  const R = 0.32;
  const skin = "#ffe1cf";
  const hair = "#33224c";
  const dress = "#5b3591";
  const shawl = "#28316e";
  const gold = "#f2d38a";
  addSeat(rig, b, dress, { w: 0.44, h: 0.17, d: 0.37 });
  addTorso(rig, b, dress, { r: 0.17 });
  // 별무늬 숄 + 금 테두리 + 별
  rig.add(b.body, shawlGeometry({ top: 0.14, bottom: 0.29, y0: 0.45, y1: 0.12, seg: 22 }), shawl);
  const hem = new THREE.TorusGeometry(0.29, 0.012, 4, 28);
  hem.rotateX(Math.PI / 2);
  rig.addFlat(b.body, at(hem, 0, 0.12, 0), "#d9b45e");
  const star = new THREE.Vector3();
  for (let i = 0; i < 26; i++) {
    const phi = -1.5 + ((i * 0.618) % 1) * 3.0;
    const v = ((i * 0.377) % 1) * 0.9 + 0.05;
    const y = 0.45 - v * 0.33;
    const r = 0.14 + (0.29 - 0.14) * Math.sin((v * Math.PI) / 2) ** 0.8 + 0.006;
    star.set(Math.sin(phi) * r, y, Math.cos(phi) * r);
    const g = new THREE.OctahedronGeometry(i % 4 === 0 ? 0.024 : 0.015, 0);
    g.scale(1, 1, 0.4);
    g.rotateY(phi);
    rig.addFlat(b.body, at(g, star.x, star.y, star.z), i % 5 === 0 ? "#fff3c4" : gold);
  }
  // 초승달 브로치
  const brooch = new THREE.TorusGeometry(0.035, 0.011, 4, 10, Math.PI * 1.3);
  brooch.rotateZ(-0.6);
  rig.addFlat(b.body, at(brooch, 0, 0.4, 0.165), gold);
  addArm(rig, b.armL, b.handL, { sleeve: dress, skin, wide: 0.09, cuff: gold });
  addArm(rig, b.armR, b.handR, { sleeve: dress, skin, wide: 0.09, cuff: gold });

  addHead(rig, b, { R, skin });
  addEyes(rig, b, { R, kind: "round", color: "#3a2252", lash: "#1e1228", size: 1.05 });
  addBrows(rig, b, R, hair, { y: 0.1, len: 0.06, thick: 0.011, tilt: -0.12 });
  addMouth(rig, b, R, "#c8506a", -0.11);
  addCheeks(rig, b, R, "#f7a2ae", 0.95);
  // 머리카락: 덮개 + 뒷머리 + 등까지 내려오는 긴 머리 + 얼굴 옆 긴 가닥
  rig.add(b.head, at(hairCap(R, -0.58), 0, HC + 0.02, -0.03), hair);
  const back = sphere(0.31, 12, 8);
  back.scale(1.08, 1.04, 0.95);
  rig.add(b.head, at(back, 0, HC - 0.03, -0.11), hair);
  const long = new THREE.CapsuleGeometry(0.25, 0.34, 4, 12);
  long.scale(1.15, 1, 0.5);
  rig.add(b.head, at(long, 0, HC - 0.38, -0.16), hair);
  for (const s of [-1, 1]) {
    const lock = new THREE.CapsuleGeometry(0.068, 0.36, 3, 8);
    lock.rotateZ(s * 0.06);
    lock.scale(1, 1, 0.8);
    rig.add(b.head, at(lock, s * 0.275, HC - 0.24, 0.05), hair);
    const curl = sphere(0.075, 8, 6);
    rig.add(b.head, at(curl, s * 0.29, HC - 0.48, 0.08), hair);
    // 별 귀걸이
    rig.addFlat(
      b.head,
      at(new THREE.OctahedronGeometry(0.026, 0), s * 0.315, HC - 0.13, 0.02),
      gold,
    );
  }
  bangs(rig, b, R, hair, 5, 1.8, { skew: 0.08 });
  // 초승달 머리 장식
  const moon = new THREE.TorusGeometry(0.06, 0.018, 5, 12, Math.PI * 1.25);
  moon.rotateZ(0.9);
  moon.rotateY(-0.5);
  rig.addFlat(b.head, at(moon, 0.21, HC + 0.24, 0.17), "#ffe7a0");
  rig.addFlat(b.head, at(new THREE.OctahedronGeometry(0.022, 0), 0.27, HC + 0.17, 0.19), "#fff3c4");

  return {
    scale: 1.0,
    hipY: 0.16,
    act(a, t, p, time) {
      if (a === "greet") {
        // 오른손을 들어 살랑살랑 손 흔들기, 고개 갸웃
        const e = bump(t, 0.3, 1.75, 0.35);
        p.lean = 0.05 * e;
        p.headX = -0.08;
        p.headZ += 0.16 * e;
        p.armRx += (-1.15 - p.armRx) * e;
        p.armRz += (-1.85 - p.armRz) * e + Math.sin(t * 9) * 0.25 * e;
        p.handRz = Math.sin(t * 9 + 0.8) * 0.3 * e;
      } else if (a === "present") {
        // 두 손을 수정구 양옆에 펼친다
        p.armLx = -1.22 + Math.sin(time * 2.4) * 0.04;
        p.armRx = -1.22 + Math.sin(time * 2.4 + 1) * 0.04;
        p.armLz = 0.42;
        p.armRz = -0.42;
        p.handLz = -0.35;
        p.handRz = 0.35;
      } else if (a === "celebrate") {
        // 짝짝 손뼉
        const e = bump(t, 0.15, 1.7, 0.35);
        const clap = Math.abs(Math.sin(t * 9));
        p.armLx = -0.95 + (-1.3 + 0.95) * e;
        p.armRx = -0.95 + (-1.3 + 0.95) * e;
        p.armLz = 0.22 + (-0.3 + clap * 0.4 - 0.22) * e;
        p.armRz = -0.22 + (0.3 - clap * 0.4 + 0.22) * e;
        p.headZ += 0.1 * e;
      }
    },
  };
};

// ───────────────────────── 아기도령 ─────────────────────────
const dolyeong: LookBuilder = (rig, b) => {
  const R = 0.35;
  const skin = "#ffe4cf";
  const hair = "#1f1612";
  const jacket = "#fbe7a1";
  // 붉은 쾌자 무복 (D-086, 예전엔 파란 전복)
  const vest = "#b8282a";
  const gold = "#f2c230";
  const red = "#d9413a";
  const SAEKDONG = ["#e0453a", "#f6c84a", "#3f9a55", "#3c6fd6", "#f28fb0", "#f7f1e3"];
  b.head.position.y = 0.36;
  b.armL.position.set(0.17, 0.29, 0);
  b.armR.position.set(-0.17, 0.29, 0);
  addSeat(rig, b, "#2f58bd", { w: 0.36, h: 0.15, d: 0.31 });
  addTorso(rig, b, jacket, { r: 0.165, len: 0.1, y: 0.16 });
  // 전복(앞이 트인 쾌자): 앞쪽을 비운 회전체 + 금색 선
  const vestPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    vestPts.push(new THREE.Vector2(0.15 + 0.07 * t ** 1.4, 0.41 - t * 0.4));
  }
  const vestGeo = new THREE.LatheGeometry(vestPts.reverse(), 20, 0.42, Math.PI * 2 - 0.84);
  rig.add(b.body, vestGeo, vest);
  for (const s of [-1, 1]) {
    const phi = s > 0 ? 0.42 : -0.42;
    rig.add(
      b.body,
      beam(
        new THREE.Vector3(Math.sin(phi) * 0.155, 0.41, Math.cos(phi) * 0.155),
        new THREE.Vector3(Math.sin(phi) * 0.225, 0.01, Math.cos(phi) * 0.225),
        0.03,
        0.02,
      ),
      gold,
    );
  }
  // 고름 + 동정
  rig.add(b.body, at(new THREE.BoxGeometry(0.045, 0.16, 0.015), 0.02, 0.24, 0.165), red);
  rig.add(b.body, at(new THREE.BoxGeometry(0.04, 0.12, 0.015), 0.05, 0.25, 0.163), red);
  const collar = new THREE.TorusGeometry(0.11, 0.022, 5, 14);
  collar.rotateX(Math.PI / 2 - 0.2);
  rig.add(b.body, at(collar, 0, 0.4, 0.01), "#fbf7ee");
  // 색동 소매
  for (const [arm, hand] of [
    [b.armL, b.handL],
    [b.armR, b.handR],
  ] as const) {
    addArm(rig, arm, hand, { sleeve: jacket, skin, wide: 0.08, len: 0.24 });
    const sl = new THREE.CylinderGeometry(0.062, 0.082, 0.2, 10, 6);
    sl.translate(0, -0.14, 0);
    rig.addColored(arm, stripes(sl, SAEKDONG, -0.24, -0.04));
  }

  addHead(rig, b, { R, skin });
  addEyes(rig, b, { R, kind: "round", color: "#24160f", size: 1.22, ex: 0.12, ey: -0.03 });
  addBrows(rig, b, R, hair, { y: 0.075, ex: 0.12, len: 0.04, thick: 0.017, tilt: -0.1 });
  addMouth(rig, b, R, "#c0505a", -0.13);
  addCheeks(rig, b, R, "#ff94a4", 1.3);
  // 머리: 단발 덮개 + 일자 앞머리 + 상투 + 빨간 댕기
  rig.add(b.head, at(hairCap(R, -0.5, 0.62), 0, HC + 0.01, -0.03), hair);
  const back = sphere(R * 0.95, 12, 8);
  back.scale(1.06, 1, 0.95);
  rig.add(b.head, at(back, 0, HC - 0.02, -0.1), hair);
  bangs(rig, b, R, hair, 6, 1.9, { y: 0.17, size: 1.0 });
  rig.add(b.head, at(sphere(0.11, 10, 8), 0, HC + R + 0.04, -0.05), hair);
  for (const s of [-1, 1]) {
    const bow = new THREE.ConeGeometry(0.05, 0.1, 4);
    bow.rotateZ(s * (Math.PI / 2));
    rig.add(b.head, at(bow, s * 0.06, HC + R - 0.02, 0.02), red);
    const tail = new THREE.BoxGeometry(0.035, 0.14, 0.01);
    tail.rotateZ(s * 0.3);
    rig.add(b.head, at(tail, s * 0.05, HC + R - 0.1, -0.12), red);
  }
  rig.add(b.head, at(sphere(0.028, 6, 4), 0, HC + R - 0.02, 0.04), gold);

  // 방울 (오른손): 자루 + 세 층 방울 + 오방색 끈
  const bell = new THREE.Group();
  b.handR.add(bell);
  rig.add(bell, at(new THREE.CylinderGeometry(0.016, 0.018, 0.18, 6), 0, 0.06, 0), "#8a5a32");
  const tiers: [number, number, number][] = [
    [0, 0.25, 1],
    [0.045, 0.205, 3],
    [0.075, 0.16, 5],
  ];
  for (const [r, y, n] of tiers) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + y * 10;
      rig.add(bell, at(sphere(0.028, 6, 4), Math.sin(a) * r, y, Math.cos(a) * r), gold);
    }
  }
  OBANG.forEach((c, i) => {
    const rib = new THREE.BoxGeometry(0.014, 0.17, 0.004);
    rib.rotateZ((i - 2) * 0.12);
    rig.add(bell, at(rib, (i - 2) * 0.012, -0.1, 0.01), c);
  });
  // 무당 부채 (왼손, D-086): 펼친 반원에 빨강·노랑·파랑 칸 + 금 테두리 + 대나무 살
  const fan = new THREE.Group();
  b.handL.add(fan);
  rig.add(fan, at(new THREE.CylinderGeometry(0.012, 0.014, 0.12, 6), 0, 0.04, 0), "#8a5a32");
  const FAN = ["#d9413a", "#f2c230", "#3c6fd6"];
  FAN.forEach((c, i) => {
    const sector = new THREE.CylinderGeometry(
      0.19,
      0.19,
      0.008,
      6,
      1,
      false,
      -Math.PI / 2 + (i * Math.PI) / 3,
      Math.PI / 3,
    );
    sector.rotateX(Math.PI / 2);
    rig.add(fan, at(sector, 0, 0.1, 0), c);
  });
  const rim = new THREE.TorusGeometry(0.19, 0.008, 3, 14, Math.PI);
  rig.add(fan, at(rim, 0, 0.1, 0), gold);
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    rig.add(
      fan,
      beam(
        new THREE.Vector3(0, 0.1, 0.006),
        new THREE.Vector3(Math.cos(a) * 0.18, 0.1 + Math.sin(a) * 0.18, 0.006),
        0.004,
        0.004,
      ),
      "#7a4a2a",
    );
  }

  return {
    scale: 0.92,
    hipY: 0.14,
    rest: { armRx: -1.15, armRz: -0.25, armLx: -1.0, armLz: 0.28, headX: -0.16 },
    act(a, t, p, time) {
      // 가만히 있어도 가끔 방울을 짤랑
      const jingle = time % 4.3 < 0.45 ? Math.sin(time * 26) * 0.18 : 0;
      p.handRz += jingle;
      if (a === "greet") {
        // 방울을 높이 들고 딸랑딸랑
        const e = bump(t, 0.25, 1.75, 0.35);
        p.lean = 0.04 * e;
        p.headX = -0.14;
        p.armRx += (-1.85 - p.armRx) * e;
        p.armRz += (-0.6 - p.armRz) * e;
        p.handRz = Math.sin(t * 24) * 0.55 * e;
        p.bob += Math.abs(Math.sin(t * 8)) * 0.04 * e;
        p.headZ += Math.sin(t * 8) * 0.08 * e;
        p.mouth = 0.6 * e;
      } else if (a === "talk") {
        p.headZ += Math.sin(t * 3.4) * 0.07;
        p.sway = Math.sin(t * 1.9) * 0.05;
        p.handRz += Math.sin(t * 20) * 0.08;
      } else if (a === "present") {
        // 부채를 펼쳐 내민다
        p.armLx = -1.55;
        p.armLz = 0.02;
        p.armRx = -1.25;
        p.armRz = -0.2;
        p.lean = 0.08;
      } else if (a === "celebrate") {
        const e = bump(t, 0.15, 1.7, 0.35);
        p.bob += Math.abs(Math.sin(t * 10)) * 0.04 * e;
        p.handRz = Math.sin(t * 24) * 0.6 * e;
      }
    },
    apply(p) {
      upright(bell, p.armRx, p.handRx, 0.2);
      upright(fan, p.armLx, p.handLx, 0.15);
    },
  };
};

// ───────────────────────── 꿈해몽: 몽실 할매 ─────────────────────────
const dream: LookBuilder = (rig, b) => {
  const R = 0.32;
  const skin = "#f3d0b5";
  const hair = "#cdc8c2";
  const jeogori = "#f1dbe4";
  const skirt = "#4b3a6e";
  const knit = ["#d9923e", "#c27a30"];
  const cream = "#f6e7c4";
  const gold = "#d9b36a";
  addSeat(rig, b, skirt, { w: 0.47, h: 0.18, d: 0.38 });
  addTorso(rig, b, jeogori, { r: 0.2 });
  // 털실 숄: 줄무늬 뜨개 + 아랫단 방울 + 앞 매듭
  const sh = shawlGeometry({ top: 0.16, bottom: 0.315, y0: 0.45, y1: 0.13, seg: 22 });
  const bands = [];
  // 회전체 띠 수(7)와 맞춰야 줄무늬가 톱니처럼 깨지지 않는다
  for (let i = 0; i < 7; i++) bands.push(knit[i % 2] as string);
  rig.addColored(b.body, stripes(sh, bands, 0.13, 0.45));
  for (let i = 0; i < 13; i++) {
    const phi = -1.45 + (i / 12) * 2.9;
    rig.add(
      b.body,
      at(sphere(0.026, 6, 4), Math.sin(phi) * 0.32, 0.12, Math.cos(phi) * 0.32),
      "#b3692a",
    );
  }
  for (const s of [-1, 1]) rig.add(b.body, at(sphere(0.036, 8, 6), s * 0.035, 0.36, 0.2), cream);
  addArm(rig, b.armL, b.handL, { sleeve: jeogori, skin, wide: 0.095, cuff: "#a83a4a" });
  addArm(rig, b.armR, b.handR, { sleeve: jeogori, skin, wide: 0.095, cuff: "#a83a4a" });

  addHead(rig, b, { R, skin });
  addEyes(rig, b, { R, kind: "arc", color: "#3a2a24", ey: -0.015 });
  addBrows(rig, b, R, "#bcb6ae", { y: 0.075, len: 0.06, thick: 0.014, tilt: 0.3 });
  addMouth(rig, b, R, "#b0585a", -0.115);
  addCheeks(rig, b, R, "#f3a0a0", 1.15);
  // 쪽진 머리: 가르마 덮개 + 귀를 덮는 옆머리 + 쪽 + 비녀
  rig.add(b.head, at(hairCap(R, -0.7, 0.5), 0, HC + 0.015, -0.03), hair);
  const back = sphere(0.31, 12, 8);
  back.scale(1.05, 0.98, 0.95);
  rig.add(b.head, at(back, 0, HC - 0.01, -0.1), hair);
  const part = new THREE.TorusGeometry(R * 1.055, 0.008, 3, 10, 0.95);
  part.rotateZ(Math.PI / 2);
  part.rotateY(Math.PI / 2);
  part.rotateX(-0.75);
  rig.add(b.head, at(part, 0, HC + 0.015, -0.03), "#b3aca4");
  for (const s of [-1, 1]) {
    const puff = sphere(0.15, 10, 8);
    puff.scale(0.8, 1.0, 1.1);
    rig.add(b.head, at(puff, s * 0.265, HC + 0.03, -0.04), hair);
  }
  rig.add(b.head, at(sphere(0.14, 10, 8), 0, HC - 0.06, -0.32), hair);
  const pin = new THREE.CylinderGeometry(0.014, 0.014, 0.62, 6);
  pin.rotateZ(Math.PI / 2);
  rig.add(b.head, at(pin, 0, HC - 0.05, -0.34), "#5fae8f");
  for (const s of [-1, 1])
    rig.add(b.head, at(sphere(0.026, 6, 4), s * 0.31, HC - 0.05, -0.34), gold);
  // 동그란 금테 안경
  for (const s of [-1, 1]) {
    const x = s * 0.11;
    const ring = new THREE.TorusGeometry(0.07, 0.009, 4, 18);
    rig.addFlat(b.head, at(ring, x, HC - 0.02, faceZ(R, x, -0.02) + 0.035), gold);
    rig.addFlat(
      b.head,
      beam(
        new THREE.Vector3(s * 0.18, HC - 0.01, faceZ(R, 0.18, -0.01) + 0.02),
        new THREE.Vector3(s * 0.3, HC + 0.0, -0.02),
        0.01,
        0.01,
      ),
      gold,
    );
  }
  const bridge = new THREE.TorusGeometry(0.026, 0.008, 3, 6, Math.PI);
  rig.addFlat(b.head, at(bridge, 0, HC - 0.01, faceZ(R, 0, -0.01) + 0.03), gold);

  // 찻잔 (오른손): 청자 잔 + 찻물
  const cup = new THREE.Group();
  b.handR.add(cup);
  rig.add(cup, at(new THREE.CylinderGeometry(0.062, 0.042, 0.07, 14), 0, 0.06, 0.03), "#9fcab6");
  rig.add(cup, at(new THREE.CylinderGeometry(0.032, 0.034, 0.015, 10), 0, 0.018, 0.03), "#86b5a0");
  const tea = new THREE.CircleGeometry(0.055, 14);
  tea.rotateX(-Math.PI / 2);
  rig.add(cup, at(tea, 0, 0.09, 0.03), "#b8792f");

  return {
    scale: 1.0,
    hipY: 0.16,
    rest: { armRx: -1.2, armRz: -0.32, handRx: 0 },
    act(a, t, p) {
      if (a === "greet") {
        // 왼손을 천천히 흔들며 고개를 끄덕
        const e = bump(t, 0.35, 1.75, 0.4);
        p.lean = 0.1 * e;
        p.headX = -0.08 + Math.sin(t * 5) * 0.08 * e;
        p.armLx += (-0.55 - p.armLx) * e;
        p.armLz += (2.15 - p.armLz) * e + Math.sin(t * 6) * 0.22 * e;
        p.handLz = Math.sin(t * 6 + 0.7) * 0.25 * e;
      } else if (a === "talk") {
        // 찻잔은 그대로, 왼손으로 손짓
        p.armRx = -1.2;
        p.armRz = -0.32;
        p.handRz = 0;
        p.armLx = -1.1 - 0.15 * Math.sin(t * 1.8);
        p.armLz = 0.3 + 0.1 * Math.sin(t * 1.2);
        p.headX = -0.08 + Math.sin(t * 2.2) * 0.07;
      } else if (a === "present") {
        // 찻잔을 두 손으로 내민다
        p.armRx = -1.48;
        p.armRz = -0.02;
        p.armLx = -1.3;
        p.armLz = -0.06;
        p.lean = 0.12;
        p.squint = 0.4;
      } else if (a === "celebrate") {
        // 아이고 껄껄: 어깨를 들썩이며 웃는다
        const e = bump(t, 0.15, 1.7, 0.35);
        p.armLx = -0.95 + (-1.25 + 0.95) * e;
        p.armLz = 0.22 + (-0.2 + Math.abs(Math.sin(t * 8)) * 0.3 - 0.22) * e;
        p.armRx = -1.2;
        p.armRz = -0.32;
        p.bob = Math.abs(Math.sin(t * 14)) * 0.016 * e;
        p.headX = -0.08 - 0.1 * e;
      }
    },
    apply(p) {
      upright(cup, p.armRx, p.handRx, 0);
    },
  };
};

// ───────────────────────── 족집게집: 족집게 도사 ─────────────────────────
const jokjipge: LookBuilder = (rig, b) => {
  const R = 0.32;
  const skin = "#efc6a4";
  const hair = "#1c181a";
  const robe = "#26305a";
  const collar = "#1a2244";
  const white = "#f7f5ef";
  const silver = "#d8dde4";
  const brass = "#e0b45e";
  addSeat(rig, b, robe, { w: 0.46, h: 0.18, d: 0.38 });
  addTorso(rig, b, robe, { r: 0.205 });
  // 깃(짙은 남색 V) + 흰 동정
  for (const s of [-1, 1]) {
    rig.add(
      b.body,
      beam(
        new THREE.Vector3(s * 0.11, 0.43, 0.1),
        new THREE.Vector3(-s * 0.03, 0.2, 0.18),
        0.065,
        0.02,
      ),
      collar,
    );
    rig.add(
      b.body,
      beam(
        new THREE.Vector3(s * 0.085, 0.445, 0.12),
        new THREE.Vector3(-s * 0.005, 0.3, 0.188),
        0.03,
        0.022,
      ),
      white,
    );
  }
  // 허리띠 + 매단 은 족집게
  const belt = new THREE.TorusGeometry(0.203, 0.02, 5, 20);
  belt.rotateX(Math.PI / 2);
  belt.scale(1, 1, 0.86);
  rig.add(b.body, at(belt, 0, 0.15, 0), "#3a2a20");
  rig.add(b.body, at(new THREE.TorusGeometry(0.016, 0.005, 4, 8), 0.1, 0.13, 0.18), silver);
  for (const s of [-1, 1])
    rig.add(
      b.body,
      beam(
        new THREE.Vector3(0.1, 0.115, 0.185),
        new THREE.Vector3(0.1 + s * 0.012, -0.01, 0.2),
        0.012,
        0.006,
      ),
      silver,
    );
  addArm(rig, b.armL, b.handL, { sleeve: robe, skin, wide: 0.12, len: 0.31 });
  addArm(rig, b.armR, b.handR, { sleeve: robe, skin, wide: 0.12, len: 0.31 });

  addHead(rig, b, { R, skin });
  addEyes(rig, b, { R, kind: "dot", color: "#1e1612", ey: -0.01 });
  // 짙은 눈썹 (바깥이 살짝 올라간다)
  addBrows(rig, b, R, hair, { y: 0.075, len: 0.085, thick: 0.022, tilt: -0.18 });
  addMouth(rig, b, R, "#9a4a40", -0.125);
  // 코
  rig.add(b.head, at(sphere(0.036, 8, 6), 0, HC - 0.05, faceZ(R, 0, -0.05, -0.012)), "#e2b08c");
  // 짧은 콧수염
  for (const s of [-1, 1]) {
    const m = new THREE.CapsuleGeometry(0.019, 0.05, 3, 6);
    m.rotateZ(s * 1.3);
    rig.add(b.head, at(m, s * 0.04, HC - 0.088, faceZ(R, 0.04, -0.088, -0.012)), hair);
  }
  // 짧은 검은 머리: 덮개 + 뒷머리 + 짧은 옆머리
  const cap = hairCap(R, -0.5, 0.5);
  cap.scale(1, 0.9, 1);
  rig.add(b.head, at(cap, 0, HC + 0.04, -0.02), hair);
  const back = sphere(0.3, 12, 8);
  back.scale(1.06, 0.88, 0.92);
  rig.add(b.head, at(back, 0, HC + 0.04, -0.1), hair);
  for (const s of [-1, 1]) {
    const side = new THREE.BoxGeometry(0.04, 0.12, 0.12);
    side.rotateY(s * 0.3);
    rig.add(b.head, at(side, s * 0.3, HC + 0.03, 0.02), hair);
  }
  bangs(rig, b, R, hair, 4, 1.2, { y: 0.22, size: 0.75 });

  // 큰 황동 돋보기 (오른손): 나무 손잡이 → 렌즈 받침(lens)을 손잡이 끝에서 돌려 카메라 쪽을 보게 한다
  const mag = new THREE.Group();
  b.handR.add(mag);
  rig.add(mag, at(new THREE.CylinderGeometry(0.02, 0.024, 0.14, 8), 0, 0.06, 0.02), "#5a3420");
  rig.add(mag, at(new THREE.CylinderGeometry(0.026, 0.022, 0.03, 8), 0, 0.14, 0.02), brass);
  const lens = new THREE.Group();
  lens.position.set(0, 0.15, 0.02);
  mag.add(lens);
  const LR = 0.115;
  rig.add(lens, at(new THREE.TorusGeometry(LR, 0.016, 6, 24), 0, LR + 0.01, 0), brass);
  rig.addFlat(lens, at(new THREE.CircleGeometry(LR * 0.95, 20), 0, LR + 0.01, 0.002), "#e4eef0");
  const glassBack = new THREE.CircleGeometry(LR * 0.95, 20);
  glassBack.rotateY(Math.PI);
  rig.addFlat(lens, at(glassBack, 0, LR + 0.01, -0.002), "#c8d6da");
  rig.addFlat(lens, at(new THREE.CircleGeometry(0.022, 8), -0.05, LR + 0.06, 0.004), "#ffffff");
  // 렌즈 너머로 크게 보이는 눈 (인사·들여다볼 때만)
  const bigEye = new THREE.Group();
  bigEye.position.set(0, LR + 0.01, 0.005);
  lens.add(bigEye);
  const almond = (w: number, h: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0);
    sh.quadraticCurveTo(0, h, w / 2, 0);
    sh.quadraticCurveTo(0, -h, -w / 2, 0);
    return new THREE.ShapeGeometry(sh, 8);
  };
  rig.addFlat(bigEye, almond(0.19, 0.13), "#2a1a12");
  rig.addFlat(bigEye, at(almond(0.165, 0.1), 0, 0, 0.001), "#fffdf6");
  rig.addFlat(bigEye, at(new THREE.CircleGeometry(0.038, 14), 0, 0, 0.002), "#5a3820");
  rig.addFlat(bigEye, at(new THREE.CircleGeometry(0.02, 10), 0, 0, 0.003), "#120a06");
  rig.addFlat(bigEye, at(new THREE.CircleGeometry(0.009, 6), 0.012, 0.012, 0.004), "#ffffff");

  return {
    scale: 1.0,
    hipY: 0.16,
    rest: { armRx: -1.0, armRz: -0.28, handRx: 0 },
    act(a, t, p, time) {
      if (a === "greet") {
        // 돋보기를 들어 오른눈에 대고 씩 웃는다 (고개는 숙이지 않는다)
        const e = bump(t, 0.4, 1.9, 0.4);
        p.lean = 0.04 * e;
        p.headX = -0.1 + 0.02 * e;
        p.headZ += -0.08 * e;
        p.armRx += (-2.03 - p.armRx) * e;
        p.armRz += (0.22 - p.armRz) * e;
        p.prop = e;
        p.squint = 0.6 * e;
        p.mouth = 0.18 * bump(t, 0.6, 1.6, 0.3);
      } else if (a === "talk") {
        // 돋보기를 쥔 채 까딱이고, 왼손으로 손짓
        p.armRx = -1.1 + Math.sin(t * 1.6) * 0.06;
        p.armRz = -0.3;
        p.handRz = Math.sin(t * 2.4) * 0.22;
        p.armLx = -1.1 - 0.18 * Math.sin(t * 2.0);
        p.armLz = 0.3 + 0.12 * Math.sin(t * 1.3);
        p.handLz = -0.2 * Math.sin(t * 2.0 + 0.5);
      } else if (a === "present") {
        // 몸을 숙여 돋보기를 앞으로 내밀고 렌즈 너머로 들여다본다
        const e = Math.min(1, t / 0.6);
        p.lean = 0.16 * e;
        p.headX = -0.1 + 0.12 * e + Math.sin(time * 1.3) * 0.02;
        p.headY = 0.06 * Math.sin(time * 0.8);
        p.armRx = -1.0 + (-1.78 + 1.0) * e;
        p.armRz = -0.28 + (0.36 + 0.28) * e;
        p.armLx = -1.25;
        p.armLz = 0.12;
        p.prop = 0.8 * e;
        p.squint = 0.35 * e;
      } else if (a === "celebrate") {
        // 허허: 돋보기를 치켜들고 흔든다
        const e = bump(t, 0.15, 1.7, 0.35);
        p.armRx = -1.0 + (-2.5 + 1.0) * e;
        p.armRz = -0.28 + (-0.25 + 0.28) * e + Math.sin(t * 11) * 0.12 * e;
        p.armLx = -0.95 + (-1.2 + 0.95) * e;
        p.bob = Math.abs(Math.sin(t * 12)) * 0.018 * e;
        p.squint = e;
        p.mouth = 0.5 * e;
        p.headX = -0.1 - 0.12 * e;
      }
    },
    apply(p) {
      const f = Math.max(0, Math.min(1, p.prop));
      // 손잡이는 늘 서 있고, 들어 올리면 앞으로 기운다. 렌즈는 반대로 돌려 카메라를 본다
      const tilt = 0.12 + 0.34 * f;
      upright(mag, p.armRx, p.handRx, tilt);
      lens.rotation.x = -tilt * 1.4;
      bigEye.visible = f > 0.55;
    },
  };
};

export const LOOKS: Record<ShopId, LookBuilder> = { saju, tarot, dolyeong, dream, jokjipge };

/** 테스트·실험실용 이름 */
export const NPC_NAMES: Record<ShopId, string> = {
  saju: "청운 선생",
  tarot: "달님 언니",
  dolyeong: "아기도령",
  dream: "몽실 할매",
  jokjipge: "족집게 도사",
};
