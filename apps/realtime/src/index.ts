import { DurableObject } from "cloudflare:workers";
/**
 * 점집 거리 채널 (docs/15 §4, F03). M1 뼈대: 접속, snapshot, 이동·이모트 중계, 빈도 제한.
 * 걷는 속도 검사와 신고는 M3에서 채운다.
 */
import type { ClientMessage, PlayerState, ServerMessage } from "@fortune/shared-types";
import { verifyWsToken } from "@fortune/shared-types";

interface Env {
  WS_TOKEN_KEY: string;
}

const MAX_PLAYERS = 30; // D-011
const MAX_MESSAGE_BYTES = 512;
const MIN_INTERVAL_MS: Record<ClientMessage["t"], number> = {
  move: 300,
  emote: 2000,
  chat: 2000,
  enter_shop: 500,
  exit_shop: 500,
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
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS)
      return new Response("full", { status: 409 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const me: Attachment = {
      id: token.u,
      nickname: token.n,
      avatar: "default",
      x: 0,
      z: 0,
      inside: false,
      last: {},
    };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(me);
    const others = this.players()
      .filter((p) => p.id !== me.id)
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
    }
    ws.serializeAttachment(me);
  }

  override async webSocketClose(ws: WebSocket) {
    const me = ws.deserializeAttachment() as Attachment;
    this.broadcast({ t: "left", id: me.id }, me.id);
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response("not found", { status: 404 });
  },
};
