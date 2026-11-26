/**
 * 당산나무 (F18, D-099): 마을 어귀의 큰 느티나무, 금줄과 흰 종이, 둥근 돌 단, 옆의 돌탑.
 * 가지마다 사람들이 묶은 오색 천(InstancedMesh 하나)이 바람에 흔들린다. 내 천은 크고 밝게, 이뤄진 소원은 금빛.
 * 돌 올리기를 하면 돌탑 꼭대기에 돌 하나가 떨어져 얹힌다.
 */
import { WISH_COLOR_HEX } from "@fortune/shared-types";
import * as THREE from "three";
import { at, beam, colored, gradient, hash } from "../geo";
import type { GlowSpot } from "../glow";
import type { Kit } from "../street-kit";
import type { Building } from "./types";

/** 나무에 걸 수 있는 천 수 (이보다 많으면 최신 것만) */
export const CLOTH_SLOTS = 180;

export interface WishCloth {
  color: string;
  mine: boolean;
  gold: boolean;
}

/** 거리 장면이 매 프레임 부르는 소원 나무 손잡이 */
export interface WishTree {
  /** 걸 천 목록 (앞쪽이 최신). flashLast면 맨 앞 천이 잠깐 빛난다 */
  setCloths(cloths: WishCloth[], flashFirst?: boolean): void;
  /** 돌탑 꼭대기에 돌 하나 */
  dropStone(): void;
  update(time: number): void;
}

/** 오방색 천 (WishColor 이름 → 색) */
const CLOTH_COLORS: Record<string, string> = WISH_COLOR_HEX;
const GOLD = "#ffd76a";

const BARK = "#4a3526";
const BARK_DARK = "#2c1f17";
const LEAF = ["#2f5a33", "#3b6c3c", "#27492c", "#46783f"];
const STONE = "#8d877c";
const STONE_DARK = "#4f4a43";
const PAPER = "#f4f1ea";
const ROPE = "#c9a86a";

export function buildTree(kit: Kit): Building & { wishTree: WishTree } {
  const { bz } = kit;
  const parts: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const glows: GlowSpot[] = [];
  const tz = bz + 0.4; // 나무 줄기 자리

  // 둥근 돌 단 (나무를 두른 낮은 단)
  parts.push(
    gradient(at(new THREE.CylinderGeometry(2.3, 2.45, 0.26, 20), 0, 0.13, tz), STONE_DARK, STONE),
  );
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const s = new THREE.IcosahedronGeometry(0.2, 0);
    s.scale(1.3, 0.6, 1);
    parts.push(
      colored(
        at(s, Math.cos(a) * 2.35, 0.26, tz + Math.sin(a) * 2.35, a),
        new THREE.Color(STONE).multiplyScalar(0.75 + hash(i, 3) * 0.4),
      ),
    );
  }

  // 줄기: 굵고 조금 비틀린 원뿔 + 뿌리
  parts.push(
    gradient(at(new THREE.CylinderGeometry(0.42, 0.68, 3.4, 10), 0, 1.9, tz), BARK_DARK, BARK),
  );
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    parts.push(
      colored(
        beam(
          new THREE.Vector3(Math.cos(a) * 0.35, 0.6, tz + Math.sin(a) * 0.35),
          new THREE.Vector3(Math.cos(a) * 1.05, 0.22, tz + Math.sin(a) * 1.05),
          0.22,
          0.18,
        ),
        BARK_DARK,
      ),
    );
  }
  // 큰 가지 넷
  const branchEnds: THREE.Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.8;
    const end = new THREE.Vector3(
      Math.cos(a) * 2.0,
      4.1 + hash(i, 5) * 0.5,
      tz + Math.sin(a) * 1.6,
    );
    branchEnds.push(end);
    parts.push(colored(beam(new THREE.Vector3(0, 3.2, tz), end, 0.26, 0.24), BARK));
  }
  // 아래로 처진 잔가지: 천을 매다는 곳
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    parts.push(
      colored(
        beam(
          new THREE.Vector3(Math.cos(a) * 0.4, 2.9, tz + Math.sin(a) * 0.35),
          new THREE.Vector3(Math.cos(a) * 2.7, 2.75 + hash(i, 7) * 0.4, tz + Math.sin(a) * 2.3),
          0.09,
          0.08,
        ),
        BARK,
      ),
    );
  }
  // 잎 덩이: 크고 둥근 수관
  const clumps: [number, number, number, number][] = [
    [0, 5.2, 0, 2.0],
    [-1.6, 4.7, 0.2, 1.5],
    [1.7, 4.8, -0.1, 1.5],
    [0.3, 4.6, 1.3, 1.4],
    [-0.4, 4.9, -1.2, 1.5],
    [1.0, 5.8, 0.5, 1.2],
    [-1.0, 5.7, -0.3, 1.2],
  ];
  clumps.forEach(([x, y, z, r], i) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1.15, 0.8, 1.05);
    parts.push(
      gradient(
        at(g, x, y, tz + z),
        LEAF[(i + 2) % LEAF.length] as string,
        LEAF[i % LEAF.length] as string,
      ),
    );
  });

  // 금줄: 줄기를 두른 새끼줄 + 흰 종이(시줏돈 대신 한지 조각)
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2;
    const a1 = ((i + 1) / 16) * Math.PI * 2;
    const r = 0.6;
    parts.push(
      colored(
        beam(
          new THREE.Vector3(Math.cos(a0) * r, 1.55, tz + Math.sin(a0) * r),
          new THREE.Vector3(Math.cos(a1) * r, 1.55, tz + Math.sin(a1) * r),
          0.06,
          0.06,
        ),
        ROPE,
      ),
    );
    if (i % 2 === 0) {
      const p = new THREE.PlaneGeometry(0.1, 0.22);
      p.rotateY(-a0 + Math.PI / 2);
      lit.push(
        colored(at(p, Math.cos(a0) * (r + 0.04), 1.4, tz + Math.sin(a0) * (r + 0.04)), PAPER),
      );
    }
  }

  // 돌탑 (나무 오른쪽 앞): 아래가 넓은 돌 무더기
  const sx = 2.9;
  const sz = bz + 2.3;
  let sy = 0;
  for (let layer = 0; layer < 7; layer++) {
    const n = Math.max(1, 6 - layer);
    const rr = 0.55 - layer * 0.07;
    const h = 0.2 - layer * 0.01;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + layer * 0.7;
      const s = new THREE.IcosahedronGeometry(0.18 + hash(layer, k) * 0.05, 0);
      s.scale(1.3, 0.75, 1.1);
      const d = n === 1 ? 0 : rr * 0.6;
      parts.push(
        colored(
          at(s, sx + Math.cos(a) * d, sy + h * 0.5, sz + Math.sin(a) * d, a),
          new THREE.Color(STONE).multiplyScalar(0.7 + hash(k, layer) * 0.45),
        ),
      );
    }
    sy += h;
  }
  const stoneTop = new THREE.Vector3(sx, sy + 0.08, sz);

  // 나무 앞 작은 촛불 하나 (빛)
  lit.push(
    colored(at(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 6), -0.9, 0.34, tz + 1.9), "#fff2d2"),
  );
  glows.push({ x: -0.9, y: 0.5, z: tz + 1.9, size: 1.4, color: "#ffc070", flicker: 0.3 });
  glows.push({ x: 0, y: 2.2, z: tz + 1.0, size: 4.2, color: "#ffd9a0", flicker: 0.05 });

  // ── 오색 천 (움직이는 조각) ──
  const anchors: { p: THREE.Vector3; yaw: number; phase: number }[] = [];
  for (let i = 0; i < CLOTH_SLOTS; i++) {
    const a = i * 2.39996;
    const k = i / CLOTH_SLOTS;
    // 아래 가지에 매단다: 나무 앞에 서도 천이 화면에 보이는 높이
    const r = 0.95 + Math.sqrt(k) * 1.7;
    const y = 2.15 + hash(i, 11) * 0.75 + k * 0.35;
    anchors.push({
      p: new THREE.Vector3(Math.cos(a) * r, y, tz + Math.sin(a) * r * 0.85),
      yaw: -a,
      phase: hash(i, 13) * Math.PI * 2,
    });
  }
  const clothGeo = kit.track(new THREE.PlaneGeometry(0.13, 0.5));
  clothGeo.translate(0, -0.25, 0); // 윗변을 매단 자리로
  const clothMat = kit.track(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const cloths = new THREE.InstancedMesh(clothGeo, clothMat, CLOTH_SLOTS);
  cloths.count = 0;
  cloths.frustumCulled = false;
  const white = new THREE.Color("#ffffff");
  for (let i = 0; i < CLOTH_SLOTS; i++) cloths.setColorAt(i, white);
  kit.group.add(cloths);
  let scales: number[] = [];
  let flashAt = -1;
  let flashStart = 0;
  let lastTime = 0;

  // 돌 올리기: 떨어지는 돌 하나
  const stoneGeo = kit.track(new THREE.IcosahedronGeometry(0.13, 0));
  stoneGeo.scale(1.3, 0.75, 1.1);
  const stone = new THREE.Mesh(
    stoneGeo,
    kit.track(new THREE.MeshLambertMaterial({ color: "#b3ab9c" })),
  );
  stone.visible = false;
  stone.position.copy(stoneTop);
  kit.group.add(stone);
  let stoneStart = -1;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sv = new THREE.Vector3();
  const c = new THREE.Color();

  const wishTree: WishTree = {
    setCloths(list, flashFirst) {
      const n = Math.min(list.length, CLOTH_SLOTS);
      cloths.count = n;
      scales = [];
      for (let i = 0; i < n; i++) {
        const w = list[i] as WishCloth;
        c.set(w.gold ? GOLD : (CLOTH_COLORS[w.color] ?? "#ffffff"));
        if (w.mine && !w.gold) c.lerp(white, 0.15);
        cloths.setColorAt(i, c);
        scales.push(w.gold ? 1.35 : w.mine ? 1.25 : 1);
      }
      if (cloths.instanceColor) cloths.instanceColor.needsUpdate = true;
      flashAt = flashFirst && n > 0 ? 0 : -1;
      flashStart = lastTime;
    },
    dropStone() {
      stone.visible = true;
      stoneStart = lastTime;
    },
    update(time) {
      lastTime = time;
      for (let i = 0; i < cloths.count; i++) {
        const an = anchors[i] as (typeof anchors)[number];
        let s = scales[i] ?? 1;
        if (i === flashAt) {
          const t = time - flashStart;
          if (t > 1.8) flashAt = -1;
          else s *= 1 + Math.sin(Math.min(t, 1.8) * 5) * 0.25 * (1 - t / 1.8);
        }
        e.set(
          Math.sin(time * 1.4 + an.phase) * 0.22,
          an.yaw,
          Math.sin(time * 1.1 + an.phase * 1.7) * 0.14,
        );
        q.setFromEuler(e);
        sv.set(s, s, s);
        m.compose(an.p, q, sv);
        cloths.setMatrixAt(i, m);
      }
      cloths.instanceMatrix.needsUpdate = true;
      if (stoneStart >= 0) {
        const t = Math.min(1, (time - stoneStart) / 0.45);
        // 위에서 떨어져 톡 튀고 멈춘다
        const fall = (1 - t) ** 2 * 0.9;
        const bounce = t > 0.75 ? Math.sin(((t - 0.75) / 0.25) * Math.PI) * 0.05 : 0;
        stone.position.set(stoneTop.x, stoneTop.y + fall + bounce, stoneTop.z);
        stone.rotation.y = t * 2;
        if (t >= 1) stoneStart = -1;
      }
    },
  };
  kit.updaters.push((t) => wishTree.update(t));

  const frontEdge = bz + 3.1;
  return {
    parts,
    lit,
    glows,
    sign: {
      x: -1.9,
      y: 1.15,
      z: bz + 2.75,
      w: 1.0,
      h: 0.34,
      style: { bgTop: "#5a3c26", bgBottom: "#3a2618", border: "#c9a86a", text: "#f6e2b0" },
    },
    // 나무 앞을 누르면 나무 앞까지 걷는다
    door: { x: 0, y: 1.4, z: tz + 1.6 },
    // 문이 없는 장소: 보이지 않는 작은 문 (열 일이 없다)
    doorway: {
      z: bz - 30,
      shape: "rect",
      w: 0.01,
      h: 0.01,
      y0: -5,
      leaves: 1,
      leaf: "#000000",
      frame: "#000000",
      paper: false,
    },
    steps: [],
    frontEdge,
    blockRects: [[-2.5, tz - 2.5, 2.5, frontEdge - 0.4]],
    blockers: [[sx, sz, 0.75]],
    clearRects: [[-3.2, tz - 3.2, 3.6, frontEdge + 0.4]],
    pools: [{ x: 0, z: tz + 2.2, r: 2.6, k: 0.45, color: "#ffd9a0" }],
    wishTree,
  };
}
