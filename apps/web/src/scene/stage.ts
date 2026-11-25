/**
 * 3D 무대: 렌더러 하나로 거리와 점집 내부를 번갈아 그린다 (F03, F04, 07).
 * UI(Preact)와는 이 클래스의 메서드와 이벤트로만 주고받는다 (13 §1). 페이드는 UI가 CSS로 한다.
 * 점집 안에 있는 동안 거리는 멈춰 두고, 5분이 넘으면 해제했다가 나올 때 다시 만든다 (07 §5, F04).
 */
import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import type { AgeBand, Gender } from "./chibi";
import { type Interior, buildInterior } from "./interior";
import type { NpcAction } from "./npc";
import { StreetView } from "./street-view";

export type { NpcAction } from "./npc";

export interface StageEvents {
  onNearDoor(near: boolean): void;
  /** 처음 걷기 시작했을 때 한 번 (안내 문구를 숨긴다) */
  onFirstMove?(): void;
  onStats?(s: { fps: number; calls: number; triangles: number }): void;
}

export interface StageOptions {
  shop: ShopId;
  look: { gender: Gender; ageBand: AgeBand };
}

/** 점집 안에 이보다 오래 있으면 거리 장면을 해제한다 (07 §5) */
export const STREET_KEEP_MS = 5 * 60 * 1000;

/** 다음 화면 갱신까지 기다린다. 탭이 숨겨져 rAF가 멈춰도 끝나게 시간 제한을 둔다 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 300);
  });
}

export class Stage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clock = new THREE.Clock();
  private street: StreetView | null = null;
  private interior: Interior | null = null;
  /** 문 앞에 서 있는 동안 미리 만들어 둔 내부 (들어가기를 누르면 바로 쓴다) */
  private prebuilt: Interior | null = null;
  private prebuildJob = 0;
  private _inside = false;
  private insideSince = 0;
  /** enterShop/exitShop이 겹치면 늦게 온 쪽만 유효하다 */
  private token = 0;
  private moved = false;
  private disposed = false;
  private raf = 0;
  private frames = 0;
  private statTime = 0;
  private width = 1;
  private height = 1;
  /** 마지막 내부 생성 시간(ms, 07 §4 한도 300ms)과 셰이더 준비 시간 (디버그용) */
  lastBuildMs = 0;
  lastCompileMs = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly opts: StageOptions,
    private readonly events: StageEvents,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 07 §4
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.street = this.makeStreet();
    this.resize();
    window.addEventListener("resize", this.resize);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    this.loop();
  }

  get inside(): boolean {
    return this._inside;
  }

  private makeStreet() {
    return new StreetView(this.opts.shop, this.opts.look, {
      onNearDoor: (near) => {
        if (near) this.schedulePrebuild();
        else if (!this._inside) this.dropPrebuilt();
        this.events.onNearDoor(near);
      },
      onMove: () => {
        if (this.moved) return;
        this.moved = true;
        this.events.onFirstMove?.();
      },
    });
  }

  /** 문 앞에서 쉬는 틈에 내부를 미리 만든다 (F04 2초 이내 목표) */
  private schedulePrebuild() {
    if (this.prebuilt || this.prebuildJob || this._inside) return;
    const run = () => {
      this.prebuildJob = 0;
      if (this.disposed || this._inside || this.prebuilt) return;
      try {
        const t0 = performance.now();
        this.prebuilt = buildInterior(this.opts.shop, this.opts.look);
        this.lastBuildMs = performance.now() - t0;
      } catch {
        this.prebuilt = null; // 들어갈 때 다시 시도한다
      }
    };
    // Safari에는 requestIdleCallback이 없다
    this.prebuildJob =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(run, { timeout: 800 })
        : (setTimeout(run, 200) as unknown as number);
  }

  private dropPrebuilt() {
    if (this.prebuildJob) {
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(this.prebuildJob);
      else clearTimeout(this.prebuildJob);
      this.prebuildJob = 0;
    }
    this.prebuilt?.dispose();
    this.prebuilt = null;
  }

  /** 점집 안으로: 내부 장면을 (처음 한 번) 만들고 점술가 앞 시점으로 바꾼다. 실패하면 reject */
  async enterShop(): Promise<void> {
    if (this.disposed) throw new Error("stage disposed");
    if (this._inside) return;
    const token = ++this.token;
    // UI 페이드가 먼저 화면에 그려지게 한 프레임 쉰다
    await nextFrame();
    if (token !== this.token || this.disposed) throw new Error("enter cancelled");
    let room: Interior | null = this.prebuilt;
    this.prebuilt = null;
    try {
      const t0 = performance.now();
      if (!room) {
        room = buildInterior(this.opts.shop, this.opts.look);
        this.lastBuildMs = performance.now() - t0;
      }
      room.resize(this.width, this.height, this.renderer.getPixelRatio());
      const t1 = performance.now();
      // 셰이더를 미리 컴파일해 첫 프레임이 끊기지 않게 한다
      this.renderer.compile(room.scene, room.camera);
      this.lastCompileMs = performance.now() - t1;
    } catch (e) {
      room?.dispose();
      throw e;
    }
    this.interior = room;
    this._inside = true;
    this.insideSince = performance.now();
    this.street?.leaveDoor();
    room.update(0, 0);
    this.renderer.render(room.scene, room.camera);
    await nextFrame();
    if (token !== this.token || this.disposed) throw new Error("enter cancelled");
  }

  /** 거리로: 캐릭터가 문 앞에 서서 거리 쪽을 본다 */
  exitShop() {
    this.token++;
    if (!this._inside) return;
    this.interior?.dispose();
    this.interior = null;
    this._inside = false;
    if (!this.street) this.street = this.makeStreet();
    this.street.resize(this.width, this.height, this.renderer.getPixelRatio());
    this.street.standAtDoor();
  }

  /** 점술가 동작 (UI가 대사·연출에 맞춰 부른다) */
  npc(action: NpcAction) {
    this.interior?.act(action);
  }

  private readonly resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    const pr = this.renderer.getPixelRatio();
    this.street?.resize(w, h, pr);
    this.interior?.resize(w, h, pr);
  };

  private down: { x: number; y: number; t: number } | null = null;

  private readonly onPointerDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  /** 짧게 탭했을 때만 이동 (끌기는 무시). 탭 이동은 거리에서만 */
  private readonly onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (this._inside || !this.street) return;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 600)
      return;
    const rect = this.canvas.getBoundingClientRect();
    this.street.tap(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
    );
  };

  private readonly loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.elapsedTime;
    if (this._inside && this.interior) {
      // 07 §5: 오래 머물면 거리를 해제한다 (나올 때 다시 만든다)
      if (this.street && performance.now() - this.insideSince > STREET_KEEP_MS) {
        this.street.dispose();
        this.street = null;
      }
      this.interior.update(dt, time);
      this.renderer.render(this.interior.scene, this.interior.camera);
    } else if (this.street) {
      this.street.update(dt, time);
      this.renderer.render(this.street.scene, this.street.camera);
    }
    this.frames++;
    this.statTime += dt;
    if (this.statTime >= 0.5 && this.events.onStats) {
      const info = this.renderer.info.render;
      this.events.onStats({
        fps: Math.round(this.frames / this.statTime),
        calls: info.calls,
        triangles: info.triangles,
      });
      this.frames = 0;
      this.statTime = 0;
    }
  };

  dispose() {
    this.disposed = true;
    this.token++;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.dropPrebuilt();
    this.street?.dispose();
    this.street = null;
    this.interior?.dispose();
    this.interior = null;
    this.renderer.dispose();
  }
}
