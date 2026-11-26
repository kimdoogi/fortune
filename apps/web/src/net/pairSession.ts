/**
 * 같이 보기 세션 (F16, D-090). 같이 보는 동안(지도·골목·점집 안) 둘만의 방 연결 하나를 유지한다.
 * - 방장이 `travel`로 고른 곳(점집 또는 지도)으로 둘 다 이동한다. 방은 마지막 곳을 기억한다 (snapshot.place)
 * - 누가 "같이 들어가기"를 눌러도(went_inside) 둘 다 점집 안으로
 * - 골목 화면(Stage)은 subscribePair로 상대 위치를 받는다
 * 화면 이동은 replace로 한다: 같이 보는 동안 뒤로 가기 기록이 쌓이지 않고, 뒤로 가면 평소 지도로 나간다.
 */
import type { ClientMessage, PairPlace, ServerMessage } from "@fortune/shared-types";
import { signal } from "@preact/signals";
import { api } from "../api/client";
import { navigate, route } from "../ui/app/router";
import { type Partner, parseLook } from "../ui/screens/street/look";
import { PairRoom, type RoomStatus } from "./pairRoom";

export type Place = PairPlace;

export interface PairState {
  code: string;
  /** 내 역할. 초대 정보를 받기 전에는 null */
  role: "host" | "guest" | null;
  status: RoomStatus;
  myId: string;
  partner: Partner | null;
  /** 상대가 나갔으면 그 닉네임 */
  partnerLeft: string | null;
  /** 방이 기억하는 지금 갈 곳 */
  place: Place | null;
  /** 점집 안 풀이 소식 (picked·submitted·result_ready·result_failed·asking·asked). seq로 새 소식을 가린다 */
  event: { seq: number; msg: ServerMessage } | null;
}

export const pairState = signal<PairState | null>(null);

let room: PairRoom | null = null;
let seq = 0;
/** 상대의 마지막 목적지 (이번 골목에서). 골목을 옮기면 지운다 */
let partnerAt: { x: number; z: number } | null = null;
/** 골목 화면이 붙어 있으면 내 위치를 알려 준다 */
let myPosition: (() => { x: number; z: number } | null) | null = null;
const subs = new Set<(m: ServerMessage) => void>();

const patch = (p: Partial<PairState>) => {
  const s = pairState.value;
  if (s) pairState.value = { ...s, ...p };
};

export const partnerPosition = () => partnerAt;

export function setMyPosition(fn: typeof myPosition) {
  myPosition = fn;
}

export function subscribePair(fn: (m: ServerMessage) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function sendPair(m: ClientMessage) {
  room?.send(m);
}

function sendMine() {
  const me = myPosition?.();
  if (me) room?.send({ t: "move", x: me.x, z: me.z });
}

/** 방이 정한 곳으로 화면을 맞춘다 */
function follow(place: Place) {
  const s = pairState.value;
  const r = route.value;
  if (!s || (r.name !== "pair" && r.name !== "pair-in") || r.code !== s.code) return;
  if (place === "map") {
    if (r.name !== "pair" || r.shop) navigate({ name: "pair", code: s.code }, { replace: true });
    return;
  }
  if (r.shop === place) return; // 이미 그 골목이나 그 점집 안
  navigate({ name: "pair", code: s.code, shop: place }, { replace: true });
}

function onMessage(m: ServerMessage) {
  switch (m.t) {
    case "snapshot": {
      const other = m.players.find((p) => p.id !== m.you);
      partnerAt = other && (other.x || other.z) ? { x: other.x, z: other.z } : null;
      patch({
        myId: m.you,
        ...(other
          ? {
              partner: { id: other.id, nickname: other.nickname, look: parseLook(other.avatar) },
              partnerLeft: null,
            }
          : {}),
        place: m.place ?? pairState.value?.place ?? null,
      });
      if (m.place) follow(m.place);
      break;
    }
    case "joined":
      partnerAt = null;
      patch({
        partner: {
          id: m.player.id,
          nickname: m.player.nickname,
          look: parseLook(m.player.avatar),
        },
        partnerLeft: null,
      });
      // 새로 온 사람에게 내 자리를 알린다
      sendMine();
      break;
    case "left": {
      const p = pairState.value?.partner;
      if (p?.id === m.id) patch({ partner: null, partnerLeft: p.nickname });
      partnerAt = null;
      break;
    }
    case "moved":
      partnerAt = { x: m.x, z: m.z };
      break;
    case "traveled":
      partnerAt = null;
      patch({ place: m.place });
      follow(m.place);
      break;
    case "went_inside": {
      const s = pairState.value;
      const r = route.value;
      // 당산나무에는 들어갈 곳이 없다
      if (s && r.name === "pair" && r.code === s.code && r.shop && r.shop !== "tree")
        navigate({ name: "pair-in", code: s.code, shop: r.shop }, { replace: true });
      break;
    }
    case "picked":
    case "submitted":
    case "result_ready":
    case "result_failed":
    case "asking":
    case "asked":
    case "wished":
      seq += 1;
      patch({ event: { seq, msg: m } });
      break;
  }
  for (const f of subs) f(m);
}

/** 같이 보기 시작 (이미 같은 방이면 그대로) */
export function startPair(code: string) {
  if (pairState.value?.code === code && room) return;
  stopPair();
  pairState.value = {
    code,
    role: null,
    status: "connecting",
    myId: "",
    partner: null,
    partnerLeft: null,
    place: null,
    event: null,
  };
  api.invite(code).then(
    (v) => {
      if (pairState.value?.code === code) patch({ role: v.role === "none" ? null : v.role });
    },
    () => undefined,
  );
  room = new PairRoom(code, onMessage, (st) => {
    patch({ status: st });
    if (st === "open") sendMine();
  });
}

/** 같이 보기 끝: 연결을 닫는다 (상대에게는 "나갔어요") */
export function stopPair() {
  room?.close();
  room = null;
  partnerAt = null;
  pairState.value = null;
}

/** 방장: 둘이 같이 갈 곳을 정한다 */
export function travel(place: Place) {
  room?.send({ t: "travel", place });
}

/** 같이 보기를 끝내고 평소 지도로 */
export function leavePair() {
  stopPair();
  navigate({ name: "map" }, { replace: true });
}
