/** GET /api/menu?shop= (F04). 오늘(KST) 이미 본 점은 "다시 보기"로 연다 */
import {
  type MenuResponse,
  PRODUCT_NAMES,
  type ProductId,
  SHOP_PRODUCTS,
  type ShopId,
} from "@fortune/shared-types";
import type { Env } from "./env";
import { HttpError, json } from "./http";
import type { User } from "./session";
import { kstDayStartIso, todayKst } from "./time";

export const SHOPS = Object.keys(SHOP_PRODUCTS) as ShopId[];

export function parseShop(value: string | null): ShopId {
  if (!value || !(SHOPS as string[]).includes(value)) {
    throw new HttpError("INVALID_INPUT", "점집을 다시 골라 주세요");
  }
  return value as ShopId;
}

export async function getMenu(url: URL, env: Env, user: User): Promise<Response> {
  const shop = parseShop(url.searchParams.get("shop"));
  const { results } = await env.DB.prepare(
    `SELECT product, id FROM readings WHERE user_id = ? AND shop = ? AND created_at >= ?
     ORDER BY created_at DESC`,
  )
    .bind(user.id, shop, kstDayStartIso(todayKst()))
    .all<{ product: ProductId; id: string }>();
  const latest = new Map<ProductId, string>();
  for (const r of results) if (!latest.has(r.product)) latest.set(r.product, r.id);
  const out: MenuResponse = {
    shop,
    // daily는 readings에 저장하지 않아 항상 null (F13)
    items: SHOP_PRODUCTS[shop].map((product) => ({
      product,
      name: PRODUCT_NAMES[product],
      todayReadingId: latest.get(product) ?? null,
    })),
  };
  return json(out);
}
