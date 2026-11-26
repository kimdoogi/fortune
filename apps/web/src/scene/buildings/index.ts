/**
 * 점집별 건물 고르기 (D-075): 사주집 기와 한옥, 아기도령 신당 초가집, 타로집 서양 오두막, 꿈해몽 꿈속 찻집,
 * 족집게집 장터 골목 점방 (D-100).
 */
import type { PlaceId } from "../street-env";
import type { Kit } from "../street-kit";
import { buildDolyeong } from "./dolyeong";
import { buildDream } from "./dream";
import { buildJokjipge } from "./jokjipge";
import { buildSaju } from "./saju";
import { buildTarot } from "./tarot";
import { buildTree } from "./tree";
import type { Building } from "./types";

const BUILDERS: Record<PlaceId, (kit: Kit) => Building> = {
  saju: (kit) => buildSaju(kit.bz),
  dolyeong: buildDolyeong,
  tarot: buildTarot,
  dream: buildDream,
  jokjipge: buildJokjipge,
  tree: buildTree,
};

export function buildBuilding(shop: PlaceId, kit: Kit): Building {
  return BUILDERS[shop](kit);
}
