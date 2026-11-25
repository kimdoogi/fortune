/**
 * 궁합 둘만의 방 연결 (F16, docs/15 §4). `/ws/pair/<code>`에 토큰을 받아 붙는다.
 * 끊기면 1, 2, 4, 8, 8초 간격으로 최대 5번 다시 붙는다 (F03 재접속 규칙).
 */
import type { ClientMessage, ServerMessage } from "@fortune/shared-types";
import { api } from "../api/client";

export type RoomStatus = "connecting" | "open" | "closed";

export class PairRoom {
  private ws: WebSocket | null = null;
  private tries = 0;
  private closedByMe = false;
  private timer = 0;
  userId = "";

  constructor(
    private readonly code: string,
    private readonly onMessage: (m: ServerMessage) => void,
    private readonly onStatus: (s: RoomStatus) => void,
  ) {
    void this.connect();
  }

  private async connect() {
    if (this.closedByMe) return;
    this.onStatus("connecting");
    let token: string;
    try {
      const t = await api.wsToken(`pair:${this.code}`);
      token = t.token;
      this.userId = t.userId;
    } catch {
      this.retry();
      return;
    }
    if (this.closedByMe) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${proto}://${location.host}/ws/pair/${this.code}?token=${encodeURIComponent(token)}`,
    );
    this.ws = ws;
    ws.onopen = () => {
      this.tries = 0;
      this.onStatus("open");
    };
    ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(String(e.data)) as ServerMessage);
      } catch {
        // 깨진 메시지는 버린다
      }
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.retry();
    };
  }

  private retry() {
    if (this.closedByMe) return;
    if (this.tries >= 5) {
      this.onStatus("closed");
      return;
    }
    const wait = Math.min(8000, 1000 * 2 ** this.tries);
    this.tries += 1;
    this.onStatus("connecting");
    this.timer = window.setTimeout(() => void this.connect(), wait);
  }

  send(m: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  close() {
    this.closedByMe = true;
    clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
  }
}
