/**
 * 점집별 내부 꾸밈 (08 §1 점집별 내부 컨셉). 외관과 같은 색을 이어 쓴다.
 * 사주집: 선비 사랑방 — 먹 산수 병풍, 책장과 두루마리, 벼루와 붓, 사주판.
 * 타로집: 보라 휘장과 밤하늘 막, 매달린 금별, 촛대, 빛나는 수정구, 카드.
 * 아기도령: 붉은 제단과 일월오봉도, 오방기, 방울 줄, 청사초롱, 색동 방석, 장구·바람개비.
 * 꿈해몽: 장판 방, 보름달이 보이는 둥근 창, 자개장 위 이불 더미, 달항아리, 다기와 김, 구름.
 */
import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  C,
  type Kit,
  books,
  box,
  candle,
  cloud,
  cushion,
  cyl,
  floorLamp,
  hangingLantern,
  jar,
  lowTable,
  remapUv,
  scrollRoll,
  starGeometry,
  tintKeepUv,
} from "./furniture";
import { at, beam, colored, gradient, hash } from "./geo";
import { glowMaterial, glowPoints } from "./glow";
import { SAJU_ATLAS, irworobongTexture, sajuTexture } from "./paintings";

export interface Palette {
  wall: string;
  wallLow: string;
  wood: string;
  woodDark: string;
  floor: string;
  floor2: string;
  floorKind: "plank" | "jangpan";
  ceiling: string;
  /** 굽기: 위·아래에서 오는 은은한 빛 */
  sky: string;
  ground: string;
  bg: string;
  /** 캐릭터용 실시간 빛 */
  hemiSky: string;
  hemiGround: string;
  key: string;
  rim: string;
  /** 옆 창호지 (밖의 달빛) */
  moonPaper: string;
  moonLight: string;
  dust: number;
  dustColor: string;
}

export interface Decor {
  palette: Palette;
  /** 뒷벽에 구멍을 낼 곳 (x, y) */
  backHole?: (x: number, y: number) => boolean;
  build(kit: Kit): void;
}

// 탁자·방석 자리 (interior.ts SEATS와 같다)
const NPC_Z = -0.74;
const TABLE = { x: 0, z: -0.06, w: 1.36, d: 0.78, h: 0.36 };
const PLAYER = { x: -0.42, z: 0.9 };
const BACK = -1.75;

const hasDom = typeof document !== "undefined";

/** 바닥 깔개 (잘게 나눠 빛을 굽는다). 색 함수가 null이면 그 자리는 비운다 (둥근 깔개) */
function rug(
  kit: Kit,
  x: number,
  z: number,
  w: number,
  d: number,
  color: (u: number, v: number) => THREE.Color | null,
  /** face: 면마다 한 색 (줄무늬·테두리가 또렷), vertex: 꼭짓점마다 (무늬가 부드럽게) */
  mode: "face" | "vertex" = "face",
) {
  const g = new THREE.PlaneGeometry(w, d, Math.round(w / 0.08), Math.round(d / 0.08));
  g.rotateX(-Math.PI / 2);
  g.translate(x, 0.006, z);
  const f = g.toNonIndexed();
  g.dispose();
  const pos = f.getAttribute("position");
  const P: number[] = [];
  const N: number[] = [];
  const Cc: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const u = ((pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3 - x) / w + 0.5;
    const v = ((pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3 - z) / d + 0.5;
    const c = color(u, v);
    if (!c) continue;
    for (let j = 0; j < 3; j++) {
      P.push(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j));
      N.push(0, 1, 0);
      const cv =
        mode === "vertex"
          ? (color((pos.getX(i + j) - x) / w + 0.5, (pos.getZ(i + j) - z) / d + 0.5) ?? c)
          : c;
      Cc.push(cv.r, cv.g, cv.b);
    }
  }
  f.dispose();
  const r = new THREE.BufferGeometry();
  r.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  r.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  r.setAttribute("color", new THREE.Float32BufferAttribute(Cc, 3));
  kit.parts.push(r);
}

/** 깔개 테두리 무늬: 가장자리에서 띠 두 줄 */
function borderBands(u: number, v: number, inner: string, band: string, edge: string) {
  const e = Math.min(u, v, 1 - u, 1 - v);
  if (e < 0.035) return new THREE.Color(edge);
  if (e < 0.075) return new THREE.Color(band);
  if (e < 0.09) return new THREE.Color(edge);
  return new THREE.Color(inner);
}

/** 점술가·플레이어 방석과 탁자 */
function seats(
  kit: Kit,
  npcCushion: [string, string],
  playerCushion: [string, string],
  top?: string,
) {
  lowTable(kit, { ...TABLE, top });
  cushion(kit, 0, NPC_Z, 0.78, npcCushion[0], npcCushion[1]);
  cushion(kit, PLAYER.x, PLAYER.z, 0.72, playerCushion[0], playerCushion[1]);
}

// ───────────────────────── 사주집 ─────────────────────────
const saju: Decor = {
  palette: {
    wall: "#f3e6c9",
    wallLow: "#d8c49c",
    wood: "#7a4b2c",
    woodDark: "#4a2c1a",
    floor: "#b98650",
    floor2: "#9a673a",
    floorKind: "plank",
    ceiling: "#3a2618",
    sky: "#8f837c",
    ground: "#3b2a22",
    bg: "#1a1210",
    hemiSky: "#ffe3c4",
    hemiGround: "#5a3a2a",
    key: "#ffc890",
    rim: "#9aa6ff",
    moonPaper: "#7a84c4",
    moonLight: "#8f9cff",
    dust: 22,
    dustColor: "#ffd59a",
  },
  build(kit) {
    // 화문석 돗자리
    rug(kit, 0, -0.05, 2.5, 2.4, (u, v) => {
      const c = borderBands(u, v, "#d6bf82", "#8a3b2a", "#5a3a22");
      // 짚 결
      if (c.getHex() === new THREE.Color("#d6bf82").getHex() && Math.floor(v * 60) % 2 === 0)
        c.multiplyScalar(0.93);
      return c;
    });
    seats(kit, ["#3d4a6b", "#2a3350"], ["#7a3a2c", "#55261c"]);

    // 병풍 8폭: 지그재그로 세운다. 그림은 텍스처 한 장 (paintings.ts)
    if (hasDom) kit.paintedMap = sajuTexture();
    const n = 8;
    const pw = 0.3;
    const ph = 1.18;
    const y0 = 0.16;
    const zBack = BACK + 0.3;
    const zig = 0.07;
    let x = (-n * pw * Math.cos(Math.asin(zig / pw))) / 2;
    for (let i = 0; i < n; i++) {
      const za = zBack + (i % 2) * zig;
      const zb = zBack + ((i + 1) % 2) * zig;
      const dx = Math.sqrt(pw * pw - zig * zig);
      const ang = Math.atan2(zb - za, dx);
      const cx = x + dx / 2;
      const cz = (za + zb) / 2;
      const r = SAJU_ATLAS.screen;
      const panel = remapUv(new THREE.PlaneGeometry(pw - 0.028, ph - 0.07, 3, 8), {
        u0: r.u0 + ((r.u1 - r.u0) * i) / n,
        v0: r.v0,
        u1: r.u0 + ((r.u1 - r.u0) * (i + 1)) / n,
        v1: r.v1,
      });
      panel.rotateY(-ang);
      panel.translate(cx, y0 + ph / 2, cz + 0.012);
      kit.painted.push(tintKeepUv(panel, "#ffffff"));
      // 비단 테두리 + 나무 틀
      const frame = new THREE.BoxGeometry(pw, ph, 0.02, 2, 6, 1);
      frame.rotateY(-ang);
      frame.translate(cx, y0 + ph / 2, cz);
      kit.parts.push(colored(frame, "#5b3b29"));
      for (const yy of [y0, y0 + ph]) {
        const rail = new THREE.BoxGeometry(pw + 0.01, 0.03, 0.035);
        rail.rotateY(-ang);
        rail.translate(cx, yy, cz);
        kit.parts.push(colored(rail, C.woodDark));
      }
      x += dx;
    }
    for (const s of [-1, 1])
      kit.parts.push(box(0.05, y0, 0.12, s * 1.1, 0, zBack + 0.03, C.woodDark));
    kit.shadows.push({ x: 0, z: zBack + 0.04, rx: 1.3, rz: 0.18, k: 0.35 });

    // 현판 (뒷벽 위)
    {
      const p = remapUv(new THREE.PlaneGeometry(1.1, 0.28, 4, 2), SAJU_ATLAS.plaque);
      p.translate(0, 1.72, BACK + 0.07);
      kit.painted.push(tintKeepUv(p, "#ffffff"));
      kit.parts.push(box(1.16, 0.34, 0.04, 0, 1.55, BACK + 0.04, C.woodDeep));
    }

    // 왼쪽 책장: 선장본 더미, 두루마리, 백자 병
    const bx = -1.72;
    const bz = BACK + 0.28;
    for (const dx of [-0.32, 0.32])
      for (const dz of [-0.17, 0.17])
        kit.parts.push(box(0.04, 1.62, 0.04, bx + dx, 0, bz + dz, C.woodDark));
    for (const y of [0.04, 0.48, 0.92, 1.36, 1.6])
      kit.parts.push(box(0.7, 0.025, 0.38, bx, y, bz, "#6a3f24"));
    books(kit, bx - 0.15, 0.065, bz, 5, 1);
    books(kit, bx + 0.16, 0.065, bz, 3, 4);
    books(kit, bx - 0.15, 0.505, bz, 3, 2);
    jar(kit, bx + 0.16, 0.505, bz, 0.26, "#eef0ea", "vase");
    for (let i = 0; i < 4; i++)
      scrollRoll(kit, bx, 0.945 + (i % 2) * 0.058, bz - 0.1 + Math.floor(i / 2) * 0.12, 0.5);
    books(kit, bx + 0.12, 1.385, bz, 4, 3);
    jar(kit, bx - 0.17, 1.385, bz, 0.18, "#7fa894", "pot");
    kit.shadows.push({ x: bx, z: bz, rx: 0.4, rz: 0.25, k: 0.4 });

    // 오른쪽 문갑 + 난초 + 족자
    const mx = 1.62;
    const mz = BACK + 0.25;
    kit.parts.push(box(1.0, 0.44, 0.38, mx, 0, mz, "#7a4a2a"));
    kit.parts.push(box(1.03, 0.03, 0.4, mx, 0.44, mz, "#5a3420"));
    for (const dx of [-0.25, 0.25]) {
      kit.parts.push(box(0.44, 0.17, 0.01, mx + dx, 0.22, mz + 0.19, "#8a5632"));
      kit.parts.push(box(0.07, 0.03, 0.02, mx + dx, 0.3, mz + 0.2, C.brass));
    }
    kit.parts.push(box(0.94, 0.012, 0.01, mx, 0.42, mz + 0.192, C.brass));
    jar(kit, mx + 0.25, 0.47, mz, 0.16, "#e8ecef", "pot");
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const tip = new THREE.Vector3(
        mx + 0.25 + Math.cos(a) * 0.2,
        0.63 + hash(i, 4) * 0.08,
        mz + Math.sin(a) * 0.12,
      );
      const mid = new THREE.Vector3(mx + 0.25 + Math.cos(a) * 0.07, 0.74, mz + Math.sin(a) * 0.05);
      kit.parts.push(
        colored(beam(new THREE.Vector3(mx + 0.25, 0.6, mz), mid, 0.018, 0.006), "#3f6b3a"),
      );
      kit.parts.push(colored(beam(mid, tip, 0.016, 0.006), "#4b7c42"));
    }
    kit.parts.push(
      colored(at(new THREE.SphereGeometry(0.025, 6, 4), mx + 0.3, 0.76, mz + 0.03), "#f4efd8"),
    );
    // 향로 + 피어오르는 연기 대신 작은 불씨
    kit.parts.push(cyl(0.06, 0.05, 0.07, mx - 0.25, 0.47, mz, C.brass, 10));
    kit.glows.push({ x: mx - 0.25, y: 0.56, z: mz, size: 0.25, color: "#ff8a4a", flicker: 0.3 });
    {
      const s = remapUv(new THREE.PlaneGeometry(0.34, 0.68, 2, 4), SAJU_ATLAS.scroll);
      s.translate(mx, 1.22, BACK + 0.075);
      kit.painted.push(tintKeepUv(s, "#ffffff"));
      for (const yy of [0.87, 1.57]) {
        const rod = new THREE.CylinderGeometry(0.016, 0.016, 0.42, 6);
        rod.rotateZ(Math.PI / 2);
        kit.parts.push(colored(at(rod, mx, yy, BACK + 0.08), C.woodDark));
      }
    }

    // 좌등 두 개 (점술가 양옆)
    floorLamp(kit, -0.84, -1.08);
    floorLamp(kit, 0.84, -1.08);

    // 탁자 위: 사주판(그림), 벼루, 붓통, 연적
    const ty = TABLE.h;
    {
      const sheet = remapUv(new THREE.PlaneGeometry(0.5, 0.33, 4, 3), SAJU_ATLAS.board);
      sheet.rotateX(-Math.PI / 2);
      sheet.translate(0.02, ty + 0.004, -0.02);
      kit.painted.push(tintKeepUv(sheet, "#ffffff"));
    }
    kit.parts.push(box(0.2, 0.035, 0.13, -0.42, ty, -0.22, "#2d2a2c"));
    kit.parts.push(box(0.14, 0.006, 0.08, -0.42, ty + 0.035, -0.22, "#141214"));
    kit.parts.push(cyl(0.045, 0.045, 0.13, 0.46, ty, -0.24, "#6a4a32", 10));
    for (const [dx, dz, lean] of [
      [-0.015, 0, 0.1],
      [0.02, 0.01, -0.12],
      [0, -0.02, 0.02],
    ] as const) {
      kit.parts.push(
        colored(
          beam(
            new THREE.Vector3(0.46 + dx, ty + 0.1, -0.24 + dz),
            new THREE.Vector3(0.46 + dx + lean * 0.4, ty + 0.27, -0.24 + dz),
            0.012,
            0.012,
          ),
          "#c9a86a",
        ),
      );
    }
    kit.parts.push(
      colored(
        at(new THREE.SphereGeometry(0.04, 10, 8).scale(1, 0.8, 1), 0.36, ty + 0.03, 0.05),
        "#8fc0aa",
      ),
    );
    // 붓 한 자루를 사주판 옆에 눕혀 둔다
    kit.parts.push(
      colored(
        beam(
          new THREE.Vector3(0.3, ty + 0.012, -0.12),
          new THREE.Vector3(0.32, ty + 0.012, 0.12),
          0.014,
          0.014,
        ),
        "#3b2416",
      ),
    );
    kit.parts.push(
      colored(
        beam(
          new THREE.Vector3(0.32, ty + 0.012, 0.12),
          new THREE.Vector3(0.325, ty + 0.012, 0.17),
          0.02,
          0.02,
        ),
        "#2a2020",
      ),
    );
  },
};

// ───────────────────────── 타로집 ─────────────────────────
const tarot: Decor = {
  palette: {
    wall: "#e6d9ea",
    wallLow: "#c8b5cf",
    wood: "#5a3a2a",
    woodDark: "#3a2218",
    floor: "#8a5a3e",
    floor2: "#6e452f",
    floorKind: "plank",
    ceiling: "#241a2c",
    sky: "#5a4a6e",
    ground: "#2e2236",
    bg: "#140f1e",
    hemiSky: "#f0d8ff",
    hemiGround: "#3a2448",
    key: "#ffc890",
    rim: "#a88cff",
    moonPaper: "#6a6cc0",
    moonLight: "#8a8cff",
    dust: 26,
    dustColor: "#e8d8ff",
  },
  build(kit) {
    // 둥근 보라 깔개: 금 테두리 두 줄 (동심원이라 가장자리가 매끈하다)
    {
      const ring = new THREE.RingGeometry(0, 1.3, 64, 14);
      ring.rotateX(-Math.PI / 2);
      ring.scale(1, 1, 0.92);
      ring.translate(0, 0.006, -0.05);
      const g = colored(ring, "#4b2a78");
      const pos = g.getAttribute("position");
      const col = g.getAttribute("color");
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i += 3) {
        const r =
          Math.hypot(
            (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
            ((pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3 + 0.05) / 0.92,
          ) / 1.3;
        c.set(
          r > 0.93
            ? "#c9a24a"
            : r > 0.86
              ? "#33195a"
              : r > 0.79
                ? "#c9a24a"
                : r < 0.3
                  ? "#5a3590"
                  : "#4b2a78",
        );
        for (let j = 0; j < 3; j++) col.setXYZ(i + j, c.r, c.g, c.b);
      }
      kit.parts.push(g);
    }
    lowTable(kit, { ...TABLE, top: "#3a1f5e" });
    // 식탁보: 상을 덮고 금 술 장식
    kit.parts.push(
      gradient(
        box(TABLE.w + 0.12, 0.3, TABLE.d + 0.12, 0, TABLE.h - 0.29, TABLE.z, "#4a2678"),
        "#2e1650",
        "#5b3191",
      ),
    );
    kit.parts.push(
      box(TABLE.w + 0.13, 0.025, TABLE.d + 0.13, 0, TABLE.h - 0.3, TABLE.z, "#d9b45e"),
    );
    for (let i = 0; i < 18; i++) {
      const xx = -TABLE.w / 2 + (TABLE.w * (i + 0.5)) / 18;
      const t = new THREE.ConeGeometry(0.018, 0.05, 4);
      t.rotateX(Math.PI);
      kit.parts.push(colored(at(t, xx, TABLE.h - 0.33, TABLE.z + TABLE.d / 2 + 0.065), "#d9b45e"));
    }
    cushion(kit, 0, NPC_Z, 0.78, "#6b3fa0", "#3e2266");
    cushion(kit, PLAYER.x, PLAYER.z, 0.72, "#2f3a7a", "#1f2654");

    // 뒷벽: 밤하늘 막 + 양옆 보라 휘장 + 위 주름 장식
    const sky = new THREE.PlaneGeometry(1.5, 1.55, 10, 10);
    sky.translate(0, 0.55 + 0.775, BACK + 0.09);
    kit.lit.push(gradient(sky, "#1a1640", "#2c2468"));
    for (let i = 0; i < 40; i++) {
      const sx = (hash(i, 7) - 0.5) * 1.4;
      const sy = 0.65 + hash(i, 8) * 1.4;
      const g = new THREE.OctahedronGeometry(0.006 + hash(i, 9) * 0.01, 0);
      kit.lit.push(colored(at(g, sx, sy, BACK + 0.1), hash(i, 10) > 0.5 ? "#fff4c8" : "#cfd8ff"));
    }
    const moon = new THREE.TorusGeometry(0.17, 0.06, 8, 24, Math.PI * 1.2);
    moon.rotateZ(-0.9);
    kit.lit.push(colored(at(moon, 0.38, 1.6, BACK + 0.12), "#ffe7a0"));
    kit.glows.push({ x: 0.38, y: 1.62, z: BACK + 0.2, size: 1.2, color: "#ffd98a", flicker: 0.02 });
    for (const s of [-1, 1]) {
      const W = 1.75 - 0.72;
      const drape = new THREE.PlaneGeometry(W, 2.0, 40, 10);
      const p = drape.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const xx = p.getX(i);
        const yy = p.getY(i);
        // 묶은 아래쪽이 안쪽으로 모인다
        const gather = Math.max(0, 1 - (yy + 1.0) / 1.2) * 0.25;
        p.setXYZ(i, xx * (1 - gather), yy, Math.sin(xx * 26) * 0.045 + 0.06);
      }
      drape.computeVertexNormals();
      drape.translate(s * (0.72 + W / 2), 1.0, BACK + 0.12);
      kit.parts.push(gradient(drape, "#2b1452", "#6a3cb0"));
      // 금 끈
      kit.parts.push(
        colored(
          at(new THREE.TorusGeometry(0.06, 0.016, 5, 12), s * (0.72 + W * 0.45), 0.72, BACK + 0.2),
          "#e0b850",
        ),
      );
    }
    {
      const val = new THREE.PlaneGeometry(3.5, 0.3, 60, 3);
      const p = val.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const xx = p.getX(i);
        const yy = p.getY(i);
        const sag = Math.abs(Math.sin(xx * 3.2)) * 0.12;
        p.setXYZ(i, xx, yy - sag * (0.5 - yy / 0.3), Math.sin(xx * 30) * 0.02 + 0.2);
      }
      val.computeVertexNormals();
      val.translate(0, 2.02, BACK);
      kit.parts.push(gradient(val, "#3c1d6a", "#7445bd"));
      for (let i = 0; i < 26; i++) {
        const xx = -1.7 + (3.4 * (i + 0.5)) / 26;
        const t = new THREE.ConeGeometry(0.02, 0.07, 4);
        t.rotateX(Math.PI);
        kit.parts.push(
          colored(at(t, xx, 1.88 - Math.abs(Math.sin(xx * 3.2)) * 0.12, BACK + 0.21), "#e0b850"),
        );
      }
    }

    // 매달린 금별
    const stars: [number, number, number, number][] = [
      [-0.7, 1.95, -1.05, 0.08],
      [-0.42, 1.72, -1.25, 0.06],
      [0.5, 1.85, -1.1, 0.075],
      [0.78, 1.62, -1.3, 0.055],
      [-0.95, 1.55, -0.6, 0.06],
      [1.0, 1.98, -0.55, 0.07],
      [-0.2, 2.15, -0.3, 0.05],
      [0.25, 2.2, -0.5, 0.055],
    ];
    for (const [sx, sy, sz, r] of stars) {
      const g = starGeometry(r, 0.025);
      g.rotateY(hash(sx, sy) - 0.5);
      kit.lit.push(colored(at(g, sx, sy, sz), "#ffd770"));
      kit.parts.push(cyl(0.004, 0.004, 2.55 - sy - r, sx, sy + r, sz, "#2b1b12", 3));
      kit.glows.push({ x: sx, y: sy, z: sz, size: 0.55, color: "#ffd27a", flicker: 0.25 });
    }

    // 촛대 두 개 (점술가 양옆, 초 셋)
    for (const s of [-1, 1]) {
      const x = s * 0.86;
      const z = -1.12;
      kit.parts.push(cyl(0.11, 0.14, 0.04, x, 0, z, C.brass, 12));
      kit.parts.push(cyl(0.018, 0.024, 0.78, x, 0.04, z, C.brass, 8));
      kit.parts.push(
        colored(
          beam(
            new THREE.Vector3(x - 0.16, 0.82, z),
            new THREE.Vector3(x + 0.16, 0.82, z),
            0.02,
            0.02,
          ),
          C.brass,
        ),
      );
      for (const dx of [-0.16, 0, 0.16]) {
        kit.parts.push(cyl(0.035, 0.025, 0.03, x + dx, 0.82, z, C.brass, 8));
        candle(kit, x + dx, 0.85, z, dx === 0 ? 0.16 : 0.11, { light: dx === 0 ? 0.9 : 0 });
      }
      kit.shadows.push({ x, z, rx: 0.2, rz: 0.2, k: 0.3 });
    }
    // 탁자 위 초 둘
    candle(kit, -0.52, TABLE.h, -0.3, 0.09, { holder: false, light: 0.5 });
    candle(kit, 0.54, TABLE.h, -0.32, 0.07, { holder: false, light: 0.3 });
    candle(kit, 0.6, TABLE.h, -0.22, 0.05, { holder: false });

    // 카드: 덱 + 엎어 둔 세 장
    kit.parts.push(box(0.1, 0.035, 0.15, 0.38, TABLE.h, -0.12, "#e0b850", 0.2));
    kit.parts.push(box(0.088, 0.036, 0.138, 0.38, TABLE.h + 0.001, -0.12, "#3a1f6e", 0.2));
    for (const [cx, ry] of [
      [-0.2, 0.12],
      [0, 0],
      [0.2, -0.12],
    ] as const) {
      kit.parts.push(box(0.14, 0.004, 0.21, cx * 1.2, TABLE.h, 0.08, "#f2d38a", ry));
      kit.parts.push(box(0.12, 0.005, 0.19, cx * 1.2, TABLE.h + 0.001, 0.08, "#1d1f4a", ry));
      kit.lit.push(
        colored(
          at(starGeometry(0.03, 0.004).rotateX(-Math.PI / 2), cx * 1.2, TABLE.h + 0.008, 0.08),
          "#f2d38a",
        ),
      );
    }

    // 왼쪽 벽 선반: 색유리 병
    for (const y of [0.95, 1.35])
      kit.parts.push(box(0.8, 0.03, 0.22, -1.65, y, BACK + 0.12, C.woodDark));
    const bottles = ["#7fd0c0", "#c07fe0", "#e0a05a", "#7fa0f0", "#e07f9a"];
    bottles.forEach((c, i) => {
      const bx = -1.95 + i * 0.14;
      const h = 0.14 + hash(i, 2) * 0.08;
      kit.lit.push(
        cyl(0.035, 0.045, h, bx, 0.98, BACK + 0.12, new THREE.Color(c).multiplyScalar(0.55), 8),
      );
      kit.parts.push(cyl(0.012, 0.015, 0.04, bx, 0.98 + h, BACK + 0.12, "#6a4a32", 6));
    });
    books(kit, -1.6, 1.38, BACK + 0.12, 3, 2);
    jar(kit, -1.88, 1.38, BACK + 0.12, 0.16, "#cfd6f0", "vase");
    // 오른쪽: 둥근 보조 탁자 + 해골 대신 모래시계와 책
    kit.parts.push(cyl(0.3, 0.3, 0.03, 1.55, 0.55, -1.2, "#3a2218", 16));
    kit.parts.push(cyl(0.04, 0.08, 0.55, 1.55, 0, -1.2, "#3a2218", 8));
    books(kit, 1.5, 0.58, -1.2, 3, 0);
    kit.parts.push(cyl(0.05, 0.05, 0.015, 1.68, 0.58, -1.12, C.brass, 8));
    kit.parts.push(
      colored(
        at(new THREE.ConeGeometry(0.04, 0.07, 10).rotateX(Math.PI), 1.68, 0.63, -1.12),
        "#f0e6ff",
      ),
    );
    kit.parts.push(
      colored(at(new THREE.ConeGeometry(0.04, 0.07, 10), 1.68, 0.7, -1.12), "#f0e6ff"),
    );
    kit.parts.push(cyl(0.05, 0.05, 0.015, 1.68, 0.735, -1.12, C.brass, 8));
    candle(kit, 1.42, 0.58, -1.28, 0.1, { light: 0.5 });

    // 수정구: 금 받침 + 은은히 숨쉬는 빛. "보여주기" 때 밝아진다
    const bz = -0.2;
    kit.parts.push(cyl(0.09, 0.11, 0.03, 0, TABLE.h, bz, C.brass, 14));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      kit.parts.push(
        colored(
          beam(
            new THREE.Vector3(Math.sin(a) * 0.08, TABLE.h + 0.03, bz + Math.cos(a) * 0.08),
            new THREE.Vector3(Math.sin(a) * 0.1, TABLE.h + 0.1, bz + Math.cos(a) * 0.1),
            0.018,
            0.018,
          ),
          C.brass,
        ),
      );
    }
    const ballGeo = new THREE.SphereGeometry(0.13, 24, 16);
    const ball = gradient(ballGeo, "#6a5ae0", "#e6f0ff");
    const ballMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
    });
    const ballMesh = new THREE.Mesh(ball, ballMat);
    ballMesh.position.set(0, TABLE.h + 0.16, bz);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 8),
      new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    );
    ballMesh.add(core);
    const ballGlowMat = glowMaterial(0.8);
    const ballGlow = glowPoints(
      [
        { x: 0, y: TABLE.h + 0.16, z: bz, size: 1.6, color: "#8fa8ff", flicker: 0.04 },
        { x: 0, y: TABLE.h + 0.16, z: bz, size: 0.5, color: "#ffffff", flicker: 0.1 },
      ],
      ballGlowMat,
    );
    kit.objects.push(ballMesh, ballGlow);
    kit.disposables.push(
      ball,
      ballMat,
      core.geometry,
      core.material as THREE.Material,
      ballGlowMat,
      ballGlow.geometry,
    );
    kit.lights.push({
      x: 0,
      y: TABLE.h + 0.18,
      z: bz,
      color: "#8a7cff",
      intensity: 0.55,
      range: 0.6,
    });
    let boost = 0;
    let boostTarget = 0;
    kit.onAction.push((a) => {
      boostTarget = a === "present" ? 1 : a === "celebrate" ? 0.6 : 0;
    });
    kit.updaters.push((dt, time) => {
      boost += (boostTarget - boost) * (1 - Math.exp(-dt * 3));
      const pulse = 0.5 + 0.5 * Math.sin(time * 1.7);
      const u = ballGlowMat.uniforms;
      if (u.uIntensity) u.uIntensity.value = 0.55 + pulse * 0.2 + boost * 0.8;
      if (u.uTime) u.uTime.value = time;
      const k = 0.85 + pulse * 0.1 + boost * 0.15;
      core.scale.setScalar(0.8 + pulse * 0.25 + boost * 0.4);
      ballMat.color.setScalar(k);
      ballMesh.rotation.y = time * 0.4;
    });
    // 수정구 빛무리 크기는 화면에 맞춘다 (interior가 uScale을 넣어 준다)
    kit.glowMaterials.push(ballGlowMat);
  },
};

// ───────────────────────── 아기도령 ─────────────────────────
const OBANG = ["#d9413a", "#f2c230", "#3c6fd6", "#f4f1ea", "#3f9a55"];
const SAEKDONG = ["#e0453a", "#f6c84a", "#3f9a55", "#3c6fd6", "#f28fb0", "#f7f1e3"];

const dolyeong: Decor = {
  palette: {
    wall: "#f3e7cf",
    wallLow: "#dcc59e",
    wood: "#7a4b2c",
    woodDark: "#4a2c1a",
    floor: "#b98650",
    floor2: "#9a673a",
    floorKind: "plank",
    ceiling: "#3a2018",
    sky: "#8f837c",
    ground: "#3b2a22",
    bg: "#1c1012",
    hemiSky: "#ffe2c8",
    hemiGround: "#5a3428",
    key: "#ffc488",
    rim: "#9aa6ff",
    moonPaper: "#7a84c4",
    moonLight: "#8f9cff",
    dust: 22,
    dustColor: "#ffe0a0",
  },
  build(kit) {
    // 색동 줄무늬 돗자리
    rug(kit, 0, -0.05, 2.4, 2.3, (u, v) => {
      const e = Math.min(u, v, 1 - u, 1 - v);
      if (e < 0.03) return new THREE.Color("#7a2f25");
      if (e < 0.1) return new THREE.Color(SAEKDONG[Math.floor(u * 30) % SAEKDONG.length] as string);
      return new THREE.Color(Math.floor(v * 14) % 2 ? "#e9d3a0" : "#e2c98f");
    });
    lowTable(kit, { ...TABLE, top: "#8f2a22" });
    // 색동 방석 (테두리 줄무늬는 방석 위 얇은 띠로)
    cushion(kit, 0, NPC_Z, 0.72, "#f2c230", "#d9413a");
    cushion(kit, PLAYER.x, PLAYER.z, 0.72, "#3c6fd6", "#2a4fa8");
    for (const [cx, cz, s] of [
      [0, NPC_Z, 0.72],
      [PLAYER.x, PLAYER.z, 0.72],
    ] as const) {
      SAEKDONG.forEach((c, i) => {
        const r = s * 0.5 - 0.03 - i * 0.025;
        kit.parts.push(box(r * 2, 0.006, 0.02, cx, 0.098, cz + r, c));
        kit.parts.push(box(r * 2, 0.006, 0.02, cx, 0.098, cz - r, c));
      });
    }

    // 제단: 붉은 칠 + 금선, 위에 촛대·과일·정화수
    const az = BACK + 0.3;
    kit.parts.push(gradient(box(2.1, 0.62, 0.42, 0, 0, az, "#a8342a"), "#6a1e18", "#b8443a"));
    kit.parts.push(box(2.16, 0.04, 0.46, 0, 0.62, az, "#5a1a14"));
    kit.parts.push(box(2.0, 0.02, 0.01, 0, 0.5, az + 0.211, "#f2c230"));
    kit.parts.push(box(2.0, 0.02, 0.01, 0, 0.1, az + 0.211, "#f2c230"));
    for (const s of [-1, 1]) {
      candle(kit, s * 0.82, 0.66, az, 0.16, { holder: true, wax: "#e0503f", light: 0.8 });
      // 고배 접시 위 사과 탑
      kit.parts.push(cyl(0.12, 0.05, 0.03, s * 0.45, 0.78, az, C.brass, 12));
      kit.parts.push(cyl(0.03, 0.05, 0.12, s * 0.45, 0.66, az, C.brass, 8));
      const fruit = s < 0 ? "#d9413a" : "#f0a030";
      for (const [dx, dz, dy] of [
        [-0.05, -0.04, 0],
        [0.05, -0.04, 0],
        [0, 0.05, 0],
        [0, 0, 0.08],
      ] as const)
        kit.parts.push(
          colored(
            at(new THREE.SphereGeometry(0.05, 10, 8), s * 0.45 + dx, 0.85 + dy, az + dz),
            fruit,
          ),
        );
    }
    kit.parts.push(cyl(0.07, 0.05, 0.06, 0, 0.66, az, "#f4f1ea", 12));
    kit.parts.push(
      colored(
        at(new THREE.CircleGeometry(0.065, 12).rotateX(-Math.PI / 2), 0, 0.722, az),
        "#9cc4e0",
      ),
    );
    kit.shadows.push({ x: 0, z: az, rx: 1.15, rz: 0.3, k: 0.45 });

    // 일월오봉도 (뒷벽 위)
    if (hasDom) kit.paintedMap = irworobongTexture();
    {
      const p = new THREE.PlaneGeometry(1.7, 0.85, 8, 4);
      p.translate(0, 0.95 + 0.425, BACK + 0.08);
      kit.painted.push(tintKeepUv(p, "#ffffff"));
      kit.parts.push(box(1.8, 0.95, 0.04, 0, 0.9, BACK + 0.05, "#5a1a14"));
    }

    // 방울 줄 (인방을 따라)
    for (let i = 0; i < 15; i++) {
      const t = i / 14;
      const x = -1.5 + t * 3.0;
      const y = 2.03 - Math.sin(t * Math.PI) * 0.08;
      kit.parts.push(
        colored(at(new THREE.SphereGeometry(0.03, 8, 6), x, y - 0.05, BACK + 0.16), "#f2c230"),
      );
      if (i < 14)
        kit.parts.push(
          colored(
            beam(
              new THREE.Vector3(x, y, BACK + 0.16),
              new THREE.Vector3(
                -1.5 + ((i + 1) / 14) * 3.0,
                2.03 - Math.sin(((i + 1) / 14) * Math.PI) * 0.08,
                BACK + 0.16,
              ),
              0.012,
              0.012,
            ),
            "#d9413a",
          ),
        );
    }

    // 오방기: 제단 양옆에 펼친 깃발
    for (const s of [-1, 1]) {
      const fx = s * 1.25;
      const fz = BACK + 0.38;
      jar(kit, fx, 0, fz, 0.36, "#8a4a2a", "pot");
      OBANG.forEach((c, i) => {
        const tilt = (i - 2) * 0.09 * s;
        const h = 1.45 + (2 - Math.abs(i - 2)) * 0.07;
        const top = new THREE.Vector3(fx + Math.sin(tilt) * h * 0.55, h, fz + (i - 2) * 0.03);
        kit.parts.push(colored(beam(new THREE.Vector3(fx, 0.3, fz), top, 0.02, 0.02), C.wood));
        const flag = new THREE.BoxGeometry(0.34, 0.26, 0.012, 6, 1, 1);
        const p = flag.getAttribute("position");
        for (let k = 0; k < p.count; k++)
          p.setZ(k, p.getZ(k) + Math.sin((p.getX(k) + 0.17) * 9) * 0.03);
        flag.computeVertexNormals();
        kit.parts.push(colored(at(flag, top.x - s * 0.18, top.y - 0.16, top.z), c));
        kit.parts.push(
          colored(at(new THREE.SphereGeometry(0.02, 6, 4), top.x, top.y + 0.02, top.z), "#f2c230"),
        );
      });
    }

    // 청사초롱
    hangingLantern(kit, -1.05, 1.95, -1.3, 2.55, "cheongsa");
    hangingLantern(kit, 1.05, 1.95, -1.3, 2.55, "cheongsa");
    floorLamp(kit, -1.65, -0.55);
    floorLamp(kit, 1.65, -0.55);

    // 장구 (오른쪽 바닥)
    {
      const jx = 1.3;
      const jz = -0.75;
      const half = (c: string, s: number) => {
        const g = new THREE.CylinderGeometry(0.16, 0.05, 0.22, 14);
        g.rotateZ((s * Math.PI) / 2);
        kit.parts.push(colored(at(g, jx + s * 0.11, 0.17, jz), c));
        const head = new THREE.CylinderGeometry(0.19, 0.19, 0.02, 16);
        head.rotateZ(Math.PI / 2);
        kit.parts.push(colored(at(head, jx + s * 0.23, 0.17, jz), "#f2e6cc"));
      };
      half("#c0392b", -1);
      half("#2f58bd", 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        kit.parts.push(
          colored(
            beam(
              new THREE.Vector3(jx - 0.23, 0.17 + Math.sin(a) * 0.17, jz + Math.cos(a) * 0.17),
              new THREE.Vector3(
                jx + 0.23,
                0.17 + Math.sin(a + 0.4) * 0.17,
                jz + Math.cos(a + 0.4) * 0.17,
              ),
              0.008,
              0.008,
            ),
            "#e0b850",
          ),
        );
      }
      kit.shadows.push({ x: jx, z: jz, rx: 0.3, rz: 0.2, k: 0.4 });
    }

    // 탁자 위: 엽전 몇 닢과 방울 하나
    for (let i = 0; i < 4; i++) {
      const c = new THREE.CylinderGeometry(0.03, 0.03, 0.006, 12);
      kit.parts.push(
        colored(
          at(c, -0.4 + i * 0.06, TABLE.h + 0.003 + (i % 2) * 0.006, -0.18 + (i % 2) * 0.03),
          "#c9a24a",
        ),
      );
    }
    kit.parts.push(
      colored(at(new THREE.SphereGeometry(0.045, 10, 8), 0.42, TABLE.h + 0.045, -0.15), "#f2c230"),
    );

    // 바람개비 (돌아간다)
    const pin = new THREE.Group();
    const blades: THREE.BufferGeometry[] = [];
    OBANG.slice(0, 4).forEach((c, i) => {
      const tri = new THREE.BufferGeometry();
      tri.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [0, 0, 0, 0.13, 0.02, 0, 0.02, 0.13, 0, 0, 0, 0, 0.02, 0.13, 0, 0.13, 0.02, 0],
          3,
        ),
      );
      tri.computeVertexNormals();
      tri.rotateZ((i * Math.PI) / 2);
      blades.push(colored(tri, c));
    });
    const bladeGeo = mergeAll(blades);
    const pinMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const wheel = new THREE.Mesh(bladeGeo, pinMat);
    pin.add(wheel);
    pin.position.set(-0.62, 0.66 + 0.32, BACK + 0.34);
    kit.parts.push(cyl(0.008, 0.008, 0.32, -0.62, 0.66, BACK + 0.34, C.wood, 4));
    kit.objects.push(pin);
    kit.disposables.push(bladeGeo, pinMat);
    kit.updaters.push((_dt, time) => {
      wheel.rotation.z = -time * 2.2;
    });
  },
};

// ───────────────────────── 꿈해몽 ─────────────────────────
const MOON_WIN = { x: 0, y: 1.42, r: 0.6 };

const dream: Decor = {
  palette: {
    wall: "#efe6d2",
    wallLow: "#d4c4a2",
    wood: "#7a4b2c",
    woodDark: "#4a2c1a",
    floor: "#d9a24e",
    floor2: "#c58a3a",
    floorKind: "jangpan",
    ceiling: "#33241c",
    sky: "#5a5a72",
    ground: "#3a2a24",
    bg: "#121426",
    hemiSky: "#ffe8d0",
    hemiGround: "#4a3a3a",
    key: "#ffcf98",
    rim: "#9fb4ff",
    moonPaper: "#7a8ad0",
    moonLight: "#9fb0ff",
    dust: 30,
    dustColor: "#c8e6ff",
  },
  backHole: (x, y) => Math.hypot(x - MOON_WIN.x, y - MOON_WIN.y) < MOON_WIN.r,
  build(kit) {
    // 구름 무늬 둥근 깔개
    rug(
      kit,
      0,
      -0.05,
      2.4,
      2.3,
      (u, v) => {
        const e = Math.min(u, v, 1 - u, 1 - v);
        if (e < 0.03) return new THREE.Color("#3a4a7a");
        if (e < 0.06) return new THREE.Color("#e8dcc0");
        const k = Math.max(0, Math.sin(u * 16 + Math.sin(v * 9) * 1.5) * Math.sin(v * 12));
        return new THREE.Color("#6f84c0").lerp(new THREE.Color("#a8b8e8"), k * k);
      },
      "vertex",
    );
    // 둥근 소반
    {
      const t = TABLE;
      kit.parts.push(cyl(0.6, 0.6, 0.05, t.x, t.h - 0.05, t.z, "#7a4a2a", 32));
      kit.parts.push(cyl(0.62, 0.62, 0.018, t.x, t.h - 0.062, t.z, "#5a3420", 32));
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const lx = t.x + Math.cos(a) * 0.42;
        const lz = t.z + Math.sin(a) * 0.36;
        kit.parts.push(
          colored(
            beam(
              new THREE.Vector3(lx, t.h - 0.05, lz),
              new THREE.Vector3(lx + Math.cos(a) * 0.08, 0, lz + Math.sin(a) * 0.06),
              0.05,
              0.05,
            ),
            "#4a2c1a",
          ),
        );
      }
      kit.shadows.push({ x: t.x, z: t.z, rx: 0.65, rz: 0.55, k: 0.45 });
    }
    cushion(kit, 0, NPC_Z, 0.78, "#d98aa8", "#a85a7a");
    cushion(kit, PLAYER.x, PLAYER.z, 0.72, "#8fb8e0", "#5a80b0");
    // 할매 옆에 개어 둔 담요
    kit.parts.push(
      gradient(box(0.5, 0.12, 0.36, -0.68, 0, -0.85, "#a8d8c8"), "#7ab0a0", "#bfe6d8"),
    );
    kit.parts.push(box(0.5, 0.012, 0.37, -0.68, 0.06, -0.85, "#f4f0e0"));

    // 둥근 창 밖: 밤하늘, 보름달, 구름
    const out = BACK - 0.25;
    kit.lit.push(
      gradient(
        new THREE.RingGeometry(0, 0.9, 32, 6).translate(MOON_WIN.x, MOON_WIN.y, out),
        "#3a3f7a",
        "#141a44",
      ),
    );
    kit.lit.push(colored(at(new THREE.CircleGeometry(0.2, 28), 0.17, 1.58, out + 0.02), "#fff3d2"));
    kit.glows.push({ x: 0.17, y: 1.58, z: out + 0.05, size: 1.6, color: "#fff0c0", flicker: 0 });
    cloud(kit, -0.18, 1.3, out + 0.06, 1.3, "#6a6fa8", "lit");
    cloud(kit, 0.32, 1.12, out + 0.05, 1.0, "#5a5f98", "lit");
    for (let i = 0; i < 18; i++) {
      const a = hash(i, 1) * Math.PI * 2;
      const r = Math.sqrt(hash(i, 2)) * 0.58;
      kit.lit.push(
        colored(
          at(
            new THREE.OctahedronGeometry(0.008, 0),
            Math.cos(a) * r,
            MOON_WIN.y + Math.sin(a) * r,
            out + 0.03,
          ),
          "#e8eeff",
        ),
      );
    }
    // 창틀 + 창턱
    kit.parts.push(
      colored(
        at(
          new THREE.TorusGeometry(MOON_WIN.r + 0.02, 0.055, 8, 48),
          MOON_WIN.x,
          MOON_WIN.y,
          BACK + 0.04,
        ),
        C.woodDark,
      ),
    );
    kit.parts.push(
      colored(
        at(
          new THREE.TorusGeometry(MOON_WIN.r + 0.1, 0.02, 6, 48),
          MOON_WIN.x,
          MOON_WIN.y,
          BACK + 0.02,
        ),
        "#8a5a32",
      ),
    );
    {
      const t = new THREE.CylinderGeometry(MOON_WIN.r + 0.02, MOON_WIN.r + 0.02, 0.25, 40, 1, true);
      t.rotateX(Math.PI / 2);
      t.scale(-1, 1, 1);
      kit.parts.push(colored(at(t, MOON_WIN.x, MOON_WIN.y, BACK - 0.11), "#5a3a26"));
    }
    kit.lights.push({
      x: 0.1,
      y: 1.5,
      z: BACK + 0.6,
      color: "#9fb0ff",
      intensity: 0.8,
      range: 1.3,
    });

    // 왼쪽: 자개장 위 이불 더미와 베개
    const cx = -1.55;
    const cz = BACK + 0.3;
    kit.parts.push(box(0.95, 0.72, 0.45, cx, 0, cz, "#231c22"));
    kit.parts.push(box(0.97, 0.03, 0.47, cx, 0.72, cz, "#3a2a2e"));
    for (const dx of [-0.235, 0.235])
      kit.parts.push(box(0.44, 0.62, 0.01, cx + dx, 0.05, cz + 0.226, "#2c2329"));
    for (let i = 0; i < 26; i++) {
      // 자개: 무지갯빛 작은 조각 (매화 가지 모양으로 흩뿌림)
      const px = cx - 0.4 + hash(i, 5) * 0.8;
      const py = 0.12 + hash(i, 6) * 0.5;
      const c = new THREE.Color().setHSL(0.5 + hash(i, 7) * 0.35, 0.5, 0.78);
      kit.lit.push(
        colored(
          at(new THREE.CircleGeometry(0.012 + hash(i, 8) * 0.014, 6), px, py, cz + 0.233),
          c.multiplyScalar(0.8),
        ),
      );
    }
    kit.parts.push(box(0.05, 0.06, 0.02, cx - 0.03, 0.4, cz + 0.235, C.brass));
    kit.parts.push(box(0.05, 0.06, 0.02, cx + 0.03, 0.4, cz + 0.235, C.brass));
    const quilts = ["#f2b8c6", "#a8dcc8", "#f6dc8c", "#a9c8f0", "#cdb5e8", "#f4c8a8"];
    let qy = 0.75;
    quilts.forEach((c, i) => {
      const h = 0.085;
      const g = new THREE.CapsuleGeometry(h / 2, 0.8, 3, 8);
      g.rotateZ(Math.PI / 2);
      g.scale(1, 1, 4.2);
      kit.parts.push(colored(at(g, cx + (hash(i, 3) - 0.5) * 0.06, qy + h / 2, cz + 0.02), c));
      qy += h * 0.92;
    });
    for (const [px, c] of [
      [-0.2, "#e0503f"],
      [0.2, "#3c6fd6"],
    ] as const) {
      const p = new THREE.CylinderGeometry(0.075, 0.075, 0.34, 12);
      p.rotateZ(Math.PI / 2);
      kit.parts.push(colored(at(p, cx + px, qy + 0.07, cz + 0.04), "#f4eee0"));
      for (const s of [-1, 1]) {
        const e = new THREE.CylinderGeometry(0.077, 0.077, 0.02, 12);
        e.rotateZ(Math.PI / 2);
        kit.parts.push(colored(at(e, cx + px + s * 0.17, qy + 0.07, cz + 0.04), c));
      }
    }
    kit.shadows.push({ x: cx, z: cz, rx: 0.55, rz: 0.3, k: 0.45 });

    // 오른쪽: 받침 위 달항아리 + 좌등
    const jx = 1.5;
    const jz = BACK + 0.38;
    kit.parts.push(box(0.55, 0.22, 0.42, jx, 0, jz, "#6a3f24"));
    jar(kit, jx, 0.22, jz, 0.5, "#f2ede0", "moon");
    floorLamp(kit, 0.9, -1.12, "#ffe0b0");
    hangingLantern(kit, -0.55, 2.02, -0.55, 2.55, "round", "#fff0c8");
    // 떠 있는 구름 모빌
    cloud(kit, -1.0, 1.9, -1.45, 1.0, "#e8ecff", "lit");
    cloud(kit, 1.0, 2.0, -1.4, 0.8, "#dfe6ff", "lit");
    for (const [x, y, z] of [
      [-1.0, 1.9, -1.45],
      [1.0, 2.0, -1.4],
    ] as const) {
      kit.parts.push(cyl(0.004, 0.004, 2.55 - y - 0.1, x, y + 0.1, z, "#2b1b12", 3));
      kit.glows.push({ x, y, z, size: 0.9, color: "#c8d8ff", flicker: 0.03 });
    }

    // 탁자 위 다기: 찻주전자(김) + 잔 둘 + 약과 접시
    const ty = TABLE.h;
    const tx = 0.28;
    const tz = -0.2;
    {
      const pts = [
        [0, 0],
        [0.07, 0],
        [0.1, 0.04],
        [0.105, 0.08],
        [0.085, 0.12],
        [0.045, 0.135],
        [0, 0.135],
      ].map(([r, y]) => new THREE.Vector2(r as number, y as number));
      kit.parts.push(
        gradient(at(new THREE.LatheGeometry(pts, 16), tx, ty, tz), "#7fae98", "#b5dcc8"),
      );
      kit.parts.push(cyl(0.012, 0.025, 0.03, tx, ty + 0.13, tz, "#8fbfa8", 8));
      kit.parts.push(
        colored(at(new THREE.SphereGeometry(0.016, 6, 4), tx, ty + 0.165, tz), "#6a9a84"),
      );
      const spout = new THREE.CylinderGeometry(0.01, 0.018, 0.1, 6);
      spout.rotateZ(0.9);
      kit.parts.push(colored(at(spout, tx - 0.12, ty + 0.08, tz), "#8fbfa8"));
      const handle = new THREE.TorusGeometry(0.045, 0.01, 4, 10, Math.PI);
      handle.rotateZ(-Math.PI / 2);
      kit.parts.push(colored(at(handle, tx + 0.1, ty + 0.07, tz), "#6a4a32"));
    }
    for (const [cx2, cz2] of [
      [-0.05, 0.12],
      [-0.12, -0.22],
    ] as const) {
      kit.parts.push(cyl(0.045, 0.032, 0.05, cx2, ty, cz2, "#9fcab6", 12));
      kit.parts.push(
        colored(
          at(new THREE.CircleGeometry(0.04, 12).rotateX(-Math.PI / 2), cx2, ty + 0.045, cz2),
          "#b8792f",
        ),
      );
    }
    kit.parts.push(cyl(0.12, 0.1, 0.02, -0.38, ty, 0.0, "#f2ede0", 16));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      kit.parts.push(
        cyl(
          0.03,
          0.03,
          0.022,
          -0.38 + Math.cos(a) * 0.055,
          ty + 0.02,
          Math.sin(a) * 0.055,
          "#a8602a",
          8,
        ),
      );
    }
    kit.parts.push(
      colored(
        at(new THREE.SphereGeometry(0.03, 8, 6).scale(1, 0.6, 1), -0.38, ty + 0.05, 0),
        "#f2b8c6",
      ),
    );

    // 찻주전자 김: 피어올라 흩어지는 흰 점
    const steamMat = glowMaterial(0.5);
    const N = 9;
    const steam = glowPoints(
      Array.from({ length: N }, () => ({
        x: tx - 0.17,
        y: ty + 0.15,
        z: tz,
        size: 0.16,
        color: "#ffffff",
        flicker: 0.1,
      })),
      steamMat,
    );
    const sp = steam.geometry.getAttribute("position") as THREE.BufferAttribute;
    const ss = steam.geometry.getAttribute("size") as THREE.BufferAttribute;
    kit.objects.push(steam);
    kit.disposables.push(steamMat, steam.geometry);
    kit.glowMaterials.push(steamMat);
    kit.updaters.push((_dt, time) => {
      const u = steamMat.uniforms.uTime;
      if (u) u.value = time;
      for (let i = 0; i < N; i++) {
        const k = (time * 0.35 + i / N) % 1;
        sp.setXYZ(
          i,
          tx - 0.17 + Math.sin(k * 6 + i) * 0.03 * k - k * 0.04,
          ty + 0.15 + k * 0.4,
          tz + Math.cos(k * 5 + i * 2) * 0.02 * k,
        );
        ss.setX(i, 0.08 + k * 0.22 * (1 - k) * 2.5);
      }
      sp.needsUpdate = true;
      ss.needsUpdate = true;
    });
  },
};

/** 합치고 원본은 버린다 */
function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  if (!m) throw new Error("merge failed");
  return m;
}

export const DECOR: Record<ShopId, Decor> = { saju, tarot, dolyeong, dream };
