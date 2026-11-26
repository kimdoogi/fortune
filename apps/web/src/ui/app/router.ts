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
  /** 캐릭터 꾸미기 (F17) */
  | { name: "style" }
  | { name: "street"; shop: ShopId }
  | { name: "inside"; shop: ShopId }
  | { name: "history"; id?: string }
  | { name: "daily" }
  /** 당산나무 (F18) */
  | { name: "tree" }
  /** 같이 보기 초대 받기 (F16): 링크 ?g=<code>로 들어오면 여기로 */
  | { name: "join"; code: string }
  /** 같이 보기 (F16, D-090): shop이 없으면 같이 보는 지도, 있으면 그 점집 골목 */
  | { name: "pair"; code: string; shop?: ShopId | "tree" }
  /** 같이 보기: 점집 안 */
  | { name: "pair-in"; code: string; shop: ShopId };

export const SHOP_IDS: ShopId[] = ["saju", "tarot", "dolyeong", "dream", "jokjipge"];
const isShop = (s: string | undefined): s is ShopId => SHOP_IDS.includes(s as ShopId);

export function parse(hash: string): Route {
  const [name, arg, arg2] = hash.replace(/^#\/?/, "").split("/");
  switch (name) {
    case "profile":
      return { name: "profile" };
    case "me":
      return { name: "me" };
    case "style":
      return { name: "style" };
    case "daily":
      return { name: "daily" };
    case "tree":
      return { name: "tree" };
    case "history":
      return arg ? { name: "history", id: decodeURIComponent(arg) } : { name: "history" };
    case "join":
    case "pair":
    case "pair-in": {
      if (!arg || !/^[a-z0-9]{10}$/.test(arg)) return { name: "map" };
      if (name === "join") return { name, code: arg };
      // 예전 주소 #/pair-in/<code> (D-089)는 사주집 안
      if (name === "pair-in") return { name, code: arg, shop: isShop(arg2) ? arg2 : "saju" };
      if (arg2 === "tree") return { name, code: arg, shop: "tree" };
      return isShop(arg2) ? { name, code: arg, shop: arg2 } : { name, code: arg };
    }
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
    case "join":
      return `#/${r.name}/${r.code}`;
    case "pair":
    case "pair-in":
      return r.shop ? `#/${r.name}/${r.code}/${r.shop}` : `#/${r.name}/${r.code}`;
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

/** 지도로 바로 (점집 안 "나가기"). 쌓인 기록(거리·점집 안)을 한 번에 되돌린다 */
export function goToMap() {
  const d = depth();
  if (d > 0) history.go(-d);
  else navigate({ name: "map" }, { replace: true });
}

/**
 * 처음 켤 때 지도를 맨 아래에 깐다. 거리·기록 주소로 바로 들어와도 뒤로 가면 지도가 나온다.
 * 점집 안은 새로 고침하면 거리부터 다시 시작한다 (내부는 거리 장면 위에서만 만든다).
 */
export function initHistory() {
  let r = parse(location.hash);
  if (r.name === "inside") r = { name: "street", shop: r.shop };
  if (r.name === "pair-in") r = { name: "pair", code: r.code, shop: r.shop };
  // 같이 보기 초대 링크 (?g=<code>, F16): 주소에서 지우고 초대 화면으로
  const params = new URLSearchParams(location.search);
  const g = params.get("g");
  if (g && /^[a-z0-9]{10}$/.test(g)) {
    r = { name: "join", code: g };
    params.delete("g");
    const q = params.toString();
    history.replaceState(
      history.state,
      "",
      `${location.pathname}${q ? `?${q}` : ""}${location.hash}`,
    );
  }
  const base = `${location.pathname}${location.search}`;
  history.replaceState({ depth: 0 }, "", `${base}#/map`);
  if (r.name !== "map") history.pushState({ depth: 1 }, "", `${base}${toHash(r)}`);
  route.value = r;
}
