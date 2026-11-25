/**
 * 화면 경로 (docs/06 §1). 주소의 #해시로 들고 다녀서 안드로이드 뒤로 가기가 자연스럽게 동작한다.
 * 거리 → 뒤로 = 지도, 점집 안 → 뒤로 = 거리 (F03, F04).
 */
import type { ShopId } from "@fortune/shared-types";
import { signal } from "@preact/signals";

export type Route =
  | { name: "map" }
  | { name: "profile" }
  | { name: "me" }
  | { name: "street"; shop: ShopId }
  | { name: "inside"; shop: ShopId }
  | { name: "history"; id?: string }
  | { name: "daily" };

export const SHOP_IDS: ShopId[] = ["saju", "tarot", "dolyeong", "dream"];
const isShop = (s: string | undefined): s is ShopId => SHOP_IDS.includes(s as ShopId);

export function parse(hash: string): Route {
  const [name, arg] = hash.replace(/^#\/?/, "").split("/");
  switch (name) {
    case "profile":
      return { name: "profile" };
    case "me":
      return { name: "me" };
    case "daily":
      return { name: "daily" };
    case "history":
      return arg ? { name: "history", id: decodeURIComponent(arg) } : { name: "history" };
    case "street":
    case "inside":
      return isShop(arg) ? { name, shop: arg } : { name: "map" };
    default:
      return { name: "map" };
  }
}

export function toHash(r: Route): string {
  switch (r.name) {
    case "street":
    case "inside":
      return `#/${r.name}/${r.shop}`;
    case "history":
      return r.id ? `#/history/${encodeURIComponent(r.id)}` : "#/history";
    default:
      return `#/${r.name}`;
  }
}

/** history.state에 쌓인 깊이. 0이면 더 돌아갈 곳이 없다 */
const depth = () => (history.state as { depth?: number } | null)?.depth ?? 0;

export const route = signal<Route>(parse(location.hash));

window.addEventListener("popstate", () => {
  route.value = parse(location.hash);
});

export function navigate(r: Route, opts: { replace?: boolean } = {}) {
  const url = `${location.pathname}${location.search}${toHash(r)}`;
  if (opts.replace) history.replaceState({ depth: depth() }, "", url);
  else history.pushState({ depth: depth() + 1 }, "", url);
  route.value = r;
}

/** 앱 안에서 쌓은 기록이 있으면 뒤로, 없으면 fallback으로 바꾼다 (새로 고침·바로 들어온 경우) */
export function goBack(fallback: Route) {
  if (depth() > 0) history.back();
  else navigate(fallback, { replace: true });
}

/**
 * 처음 켤 때 지도를 맨 아래에 깐다. 거리·기록 주소로 바로 들어와도 뒤로 가면 지도가 나온다.
 * 점집 안은 새로 고침하면 거리부터 다시 시작한다 (내부는 거리 장면 위에서만 만든다).
 */
export function initHistory() {
  let r = parse(location.hash);
  if (r.name === "inside") r = { name: "street", shop: r.shop };
  const base = `${location.pathname}${location.search}`;
  history.replaceState({ depth: 0 }, "", `${base}#/map`);
  if (r.name !== "map") history.pushState({ depth: 1 }, "", `${base}${toHash(r)}`);
  route.value = r;
}
