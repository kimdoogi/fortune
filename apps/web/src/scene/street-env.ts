/**
 * 점집별 거리 분위기 설정 (08 §1 점집별 외관, D-075). 건물 모양은 buildings/에 있다.
 * 사주집은 D-065의 밤 한옥 골목 그대로, 나머지 셋은 하늘·안개·불빛·울타리·나무·길이 모두 다르다.
 */
import type { ShopId } from "@fortune/shared-types";
import type { Point } from "./nav";
import type { SkyOptions } from "./sky";
import type { GroundStyle, PathKind } from "./street-ground";
import type { BorderKind, LampKind, NeighborKind, TreeKind, TreeSpot } from "./street-kit";

/** 장면 조명 (진짜 점광원 없이 반구광 + 방향광 둘, D-065) */
export interface StreetLighting {
  sky: string;
  ground: string;
  hemi: number;
  moon: string;
  moonI: number;
  warm: string;
  warmI: number;
}

export interface StreetEnv {
  /** 현판 글씨 */
  name: string;
  sky: SkyOptions;
  /** 달무리 */
  halo: { size: number; color: string };
  fog: { color: string; near: number; far: number };
  light: StreetLighting;
  ground: GroundStyle;
  path: PathKind;
  lamp: LampKind;
  lampSpots: Point[];
  border: BorderKind;
  /** 담장 기와 색 (담장일 때) */
  borderRoof: string;
  trees: TreeKind;
  treeSpots: TreeSpot[];
  neighbors: NeighborKind;
  hills: [string, string];
  /** 먼 산 높이 배율 (기본 1) */
  hillHeight?: number;
  grass: { tuft: string; tufts: number; flowers: string[]; flowerCount: number };
  fireflies: { count: number; colors: string[]; size: number; flicker: number };
  /** 낮게 깔린 안개 */
  mist?: { color: string; opacity: number; heights: number[]; speed?: number; patchy?: boolean };
}

const pairs = (zs: number[], x: number): Point[] =>
  zs.flatMap((z) => [
    { x: -x, z },
    { x, z },
  ]);

const SAJU_TREES: TreeSpot[] = [
  { x: -6.6, z: -6.3, pink: true },
  { x: 6.6, z: -3.8 },
  { x: -6.8, z: 0.2 },
  { x: 6.4, z: 1.6, pink: true },
  { x: -6.2, z: 5.4 },
  { x: 6.8, z: 5.6 },
  { x: -5.6, z: -12.4 },
  { x: 5.8, z: -12.4, pink: true },
];

/** 거리 장면을 만들 수 있는 곳: 점집 넷 + 당산나무 (F18) */
export type PlaceId = ShopId | "tree";

export const STREET_ENVS: Record<PlaceId, StreetEnv> = {
  // 사주집: 밤의 한옥 골목 (D-065, 바꾸지 않는다)
  saju: {
    name: "사주집",
    sky: { horizon: "#3b2d5c" },
    halo: { size: 16, color: "#cfc8ff" },
    fog: { color: "#3b2d5c", near: 16, far: 44 },
    light: {
      sky: "#a3a8e6",
      ground: "#3d2c26",
      hemi: 1.35,
      moon: "#c9d0ff",
      moonI: 0.85,
      warm: "#ffc890",
      warmI: 0.55,
    },
    ground: {
      grass: ["#2f4a2c", "#58793f"],
      path: "#8c7457",
      pathHalf: 1.75,
      yard: "#9d8667",
      yardHalf: 4.8,
    },
    path: "steps",
    lamp: "stone",
    lampSpots: pairs([5.2, 1.6, -2.0, -5.4], 2.35),
    border: "wall",
    borderRoof: "#3c4250",
    trees: "round",
    treeSpots: SAJU_TREES,
    neighbors: "hanok",
    hills: ["#2b2547", "#221d3a"],
    grass: {
      tuft: "#4f7a3c",
      tufts: 780,
      flowers: ["#f4f1ea", "#ffd66b", "#f3a3c0", "#c9b6ff"],
      flowerCount: 70,
    },
    fireflies: { count: 24, colors: ["#e6ff9a"], size: 0.32, flicker: 0.45 },
  },

  // 아기도령: 으스스한 신당 초가집. 어두운 하늘, 붉은 횃불, 낮게 깔린 붉은 보라 안개
  dolyeong: {
    name: "아기도령",
    sky: {
      top: "#07060f",
      horizon: "#2e1528",
      band: "#7a2335",
      bandStrength: 0.5,
      stars: 120,
      starBrightness: 0.7,
      moon: { x: 12.5, y: 11, z: -62, radius: 2.3, color: "#ffd9bd" },
    },
    halo: { size: 18, color: "#ff8a7a" },
    fog: { color: "#21142a", near: 14, far: 38 },
    light: {
      sky: "#76659e",
      ground: "#2a1616",
      hemi: 1.05,
      moon: "#b9b0e6",
      moonI: 0.55,
      warm: "#ff7a50",
      warmI: 0.45,
    },
    ground: {
      grass: ["#272423", "#48413a"],
      path: "#5e4a3a",
      pathHalf: 1.6,
      yard: "#6b5644",
      yardHalf: 5.6,
    },
    path: "dirt",
    lamp: "torch",
    lampSpots: [
      { x: -2.3, z: 4.6 },
      { x: 2.3, z: 2.6 },
      { x: -2.3, z: 0.2 },
      { x: 2.3, z: -1.9 },
    ],
    border: "brushwood",
    borderRoof: "#3c4250",
    trees: "dead",
    treeSpots: [
      { x: 6.4, z: -3.6 },
      { x: -6.8, z: 0.4 },
      { x: 6.6, z: 2.2 },
      { x: -6.2, z: 5.6 },
      { x: 6.9, z: 6.2 },
      { x: -5.8, z: -12.2 },
      { x: 5.6, z: -12.6 },
    ],
    neighbors: "huts",
    hills: ["#1c1420", "#150f19"],
    grass: { tuft: "#6b5a3a", tufts: 520, flowers: ["#77706a", "#5c5650"], flowerCount: 60 },
    // 도깨비불: 파르스름한 불빛이 천천히 떠다닌다
    fireflies: { count: 12, colors: ["#8fe6ff", "#b6a6ff"], size: 0.55, flicker: 0.6 },
    mist: { color: "#a05ab0", opacity: 0.38, heights: [0.15, 0.45], speed: 0.1, patchy: true },
  },

  // 타로집: 서양식 타로 오두막. 자갈 돌길, 쇠 가로등, 산울타리, 보랏빛 밤하늘과 안개
  tarot: {
    name: "타로집",
    sky: {
      top: "#170f33",
      horizon: "#4a2a72",
      band: "#a3508f",
      bandStrength: 0.4,
      stars: 320,
      moon: { x: 11, y: 12, z: -62, radius: 2.6, color: "#fff1c9", crescent: 0.55 },
    },
    halo: { size: 11, color: "#8a6ac0" },
    fog: { color: "#3e2566", near: 14, far: 40 },
    light: {
      sky: "#a89ae6",
      ground: "#2e2438",
      hemi: 1.3,
      moon: "#c8c0ff",
      moonI: 0.8,
      warm: "#ffd07a",
      warmI: 0.6,
    },
    ground: {
      grass: ["#23382f", "#3f5e45"],
      path: "#4a4552",
      pathHalf: 1.6,
      yard: "#4f4858",
      yardHalf: 2.2,
    },
    path: "cobble",
    lamp: "iron",
    lampSpots: pairs([4.8, 0.4], 2.3),
    border: "hedge",
    borderRoof: "#3c4250",
    trees: "cypress",
    treeSpots: [
      { x: -7.2, z: -3.2 },
      { x: 7.2, z: -2.6 },
      { x: -7.0, z: 1.4 },
      { x: 7.0, z: 2.6 },
      { x: -6.7, z: 5.8 },
      { x: 6.8, z: 5.2 },
      { x: -5.6, z: -12.4 },
      { x: 5.8, z: -12.4 },
    ],
    neighbors: "gables",
    hills: ["#26193f", "#1c1333"],
    grass: {
      tuft: "#3f6a4c",
      tufts: 620,
      flowers: ["#a77be0", "#c9a2ff", "#f4f1ea", "#7f5ad0"],
      flowerCount: 140,
    },
    fireflies: { count: 22, colors: ["#ffe08a", "#d8b8ff"], size: 0.3, flicker: 0.5 },
    mist: { color: "#9b7fd6", opacity: 0.26, heights: [0.2, 0.6], speed: 0.08 },
  },

  // 꿈해몽: 꿈속 찻집. 파스텔 하늘, 크고 낮은 보름달, 물 위 디딤돌, 떠 있는 구름, 반딧불이 가득
  dream: {
    name: "꿈해몽",
    sky: {
      top: "#5b67b8",
      horizon: "#d8c3ec",
      band: "#ffd3e6",
      bandStrength: 0.45,
      stars: 200,
      moon: { x: 7.5, y: 10.5, z: -60, radius: 7.5, color: "#fffbea" },
    },
    halo: { size: 46, color: "#fff0d0" },
    fog: { color: "#c7b3e6", near: 15, far: 46 },
    light: {
      sky: "#e4dcff",
      ground: "#6a5a7a",
      hemi: 1.6,
      moon: "#fff3e6",
      moonI: 0.85,
      warm: "#ffd8c0",
      warmI: 0.35,
    },
    ground: {
      grass: ["#5a9686", "#90c6a8"],
      path: "#c9c2d8",
      pathHalf: 1.2,
      yard: "#d6cbd8",
      yardHalf: 5.4,
      pond: { cx: 0, cz: -0.6, rx: 5.8, rz: 3.7 },
    },
    path: "pond",
    lamp: "moon",
    lampSpots: [...pairs([5.6], 1.9), ...pairs([-5.0], 2.4)],
    border: "bushes",
    borderRoof: "#3c4250",
    trees: "pastel",
    treeSpots: [
      { x: -6.6, z: -6.6, pink: true },
      { x: 6.8, z: -5.8 },
      { x: -6.4, z: 4.6 },
      { x: 6.4, z: 5.2, pink: true },
      { x: -5.6, z: -12.4 },
      { x: 5.8, z: -12.4, pink: true },
    ],
    neighbors: "none",
    hills: ["#a99ad6", "#b9aade"],
    hillHeight: 0.55,
    grass: {
      tuft: "#6aa08a",
      tufts: 560,
      flowers: ["#ffffff", "#f8c6dc", "#c9b6ff", "#bfe4ff", "#fff0a8"],
      flowerCount: 160,
    },
    fireflies: { count: 90, colors: ["#fff3a8", "#b8f0ff", "#ffd0ec"], size: 0.3, flicker: 0.55 },
    mist: { color: "#f6eeff", opacity: 0.14, heights: [0.3], speed: 0.05, patchy: true },
  },

  // 당산나무 (F18, D-099): 마을 어귀. 흙길, 돌 등롱, 덤불, 둥근 나무, 이웃 없음. 따뜻한 달빛
  tree: {
    name: "당산나무",
    sky: { horizon: "#33284f" },
    halo: { size: 17, color: "#ffe2b0" },
    fog: { color: "#2c2446", near: 15, far: 42 },
    light: {
      sky: "#a8a4dc",
      ground: "#3a2c22",
      hemi: 1.3,
      moon: "#ffe6c4",
      moonI: 0.8,
      warm: "#ffc890",
      warmI: 0.6,
    },
    ground: {
      grass: ["#2c4529", "#55753d"],
      path: "#8a7255",
      pathHalf: 1.5,
      yard: "#8f7a5e",
      yardHalf: 4.6,
    },
    path: "dirt",
    lamp: "stone",
    lampSpots: pairs([5.0, 1.2, -2.6], 2.2),
    border: "bushes",
    borderRoof: "#3c4250",
    trees: "round",
    treeSpots: [
      { x: -6.4, z: -4.2 },
      { x: 6.6, z: -2.8 },
      { x: -6.8, z: 1.4 },
      { x: 6.4, z: 3.2, pink: true },
      { x: -6.0, z: 5.8 },
      { x: 6.8, z: 6.4 },
    ],
    neighbors: "none",
    hills: ["#28224a", "#1f1a3a"],
    grass: {
      tuft: "#4c763a",
      tufts: 760,
      flowers: ["#f4f1ea", "#ffd66b", "#f3a3c0"],
      flowerCount: 80,
    },
    fireflies: { count: 30, colors: ["#fff3b0", "#e6ff9a"], size: 0.34, flicker: 0.5 },
  },
};
