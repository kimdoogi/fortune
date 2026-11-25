import { DurableObject } from "cloudflare:workers";
/**
 * 점집 거리 채널 (docs/15 §4, F03). M1 뼈대: 접속, snapshot, 이동·이모트 중계, 빈도 제한.
 * 궁합 둘만의 방 (F16, D-089): 채널이 `pair:<code>`면 정원 2, 같이 들어가기·관계 고르기를 중계하고,
 * app Worker가 RPC `notify()`로 결과 알림을 보낸다. 걷는 속도 검사와 신고는 M3에서 채운다.
 */
import type { ClientMessage, PlayerState, ServerMessage } from "@fortune/shared-types";
import { verifyWsToken } from "@fortune/shared-types";

interface Env {
  WS_TOKEN_KEY: string;
}

const MAX_PLAYERS = 30; // D-011
const MAX_PAIR = 2; // F16
const MAX_MESSAGE_BYTES = 512;
const MIN_INTERVAL_MS: Record<ClientMessage["t"], number> = {
  move: 300,
  emote: 2000,
  chat: 2000,
  enter_shop: 500,
  exit_shop: 500,
  go_inside: 1000,
  pick: 1000,
};

interface Attachment extends PlayerState {
  last: Partial<Record<ClientMessage["t"], number>>;
}

export class VillageChannel extends DurableObject<Env> {
  private players(): Attachment[] {
    return this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment() as Attachment);
  }

  private broadcast(msg: ServerMessage, exceptId?: string) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment;
      if (a.id !== exceptId) ws.send(data);
    }
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket")
      return new Response("expected websocket", { status: 426 });
    const url = new URL(request.url);
    const token = await verifyWsToken(url.searchParams.get("token") ?? "", this.env.WS_TOKEN_KEY);
    if (!token) return new Response("unauthorized", { status: 401 });
    // 둘만의 방은 그 방 토큰으로만 (다른 방 토큰으로 남의 궁합 방에 들어오지 못하게)
    const room = /^\/ws\/pair\/([a-z0-9]{10})$/.exec(url.pathname);
    if (room ? token.c !== `pair:${room[1]}` : token.c.startsWith("pair:"))
      return new Response("wrong room", { status: 403 });
    // 같은 사람이 다시 연결하면 예전 연결을 닫는다 (궁합 방 재접속)
    for (const old of this.ctx.getWebSockets()) {
      const a = old.deserializeAttachment() as Attachment;
      if (a.id === token.u) old.close(4000, "replaced");
    }
    const cap = token.c.startsWith("pair:") ? MAX_PAIR : MAX_PLAYERS;
    const live = this.ctx
      .getWebSockets()
      .filter((ws) => (ws.deserializeAttachment() as Attachment).id !== token.u);
    if (live.length >= cap) return new Response("full", { status: 409 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const me: Attachment = {
      id: token.u,
      nickname: token.n,
      avatar: token.a ?? "default",
      x: 0,
      z: 0,
      inside: false,
      last: {},
    };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(me);
    const others = this.players()
      .filter((p) => p.id !== me.id && p.id)
      .map(({ last: _l, ...p }) => p);
    server.send(
      JSON.stringify({ t: "snapshot", you: me.id, players: others } satisfies ServerMessage),
    );
    const { last: _l, ...publicMe } = me;
    this.broadcast({ t: "joined", player: publicMe }, me.id);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    const me = ws.deserializeAttachment() as Attachment;
    const now = Date.now();
    const minGap = MIN_INTERVAL_MS[msg.t];
    if (minGap === undefined || now - (me.last[msg.t] ?? 0) < minGap) return;
    me.last[msg.t] = now;
    switch (msg.t) {
      case "move":
        if (!Number.isFinite(msg.x) || !Number.isFinite(msg.z)) return;
        me.x = msg.x;
        me.z = msg.z;
        this.broadcast({ t: "moved", id: me.id, x: me.x, z: me.z }, me.id);
        break;
      case "emote":
        this.broadcast({ t: "emoted", id: me.id, emote: msg.id }, me.id);
        break;
      case "chat":
        this.broadcast({ t: "chatted", id: me.id, line: msg.id }, me.id);
        break;
      case "enter_shop":
        me.inside = true;
        this.broadcast({ t: "hidden", id: me.id }, me.id);
        break;
      case "exit_shop":
        me.inside = false;
        this.broadcast({ t: "shown", id: me.id }, me.id);
        break;
      // 궁합 둘만의 방 (F16): 같이 들어가기는 보낸 사람에게도 돌려준다 (둘이 함께 전환)
      case "go_inside":
        this.broadcast({ t: "went_inside", id: me.id });
        break;
      case "pick":
        if (typeof msg.relation !== "string" || msg.relation.length > 8) return;
        this.broadcast({ t: "picked", id: me.id, relation: msg.relation });
        break;
    }
    ws.serializeAttachment(me);
  }

  override async webSocketClose(ws: WebSocket, code: number) {
    const me = ws.deserializeAttachment() as Attachment;
    // 같은 사람이 새로 연결해 닫힌 경우는 나갔다고 알리지 않는다
    if (code === 4000) return;
    this.broadcast({ t: "left", id: me.id }, me.id);
  }

  /** app Worker가 부른다 (궁합 결과 알림 등, F16) */
  async notify(msg: ServerMessage): Promise<void> {
    this.broadcast(msg);
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("not found", { status: 404 });
  },
};
