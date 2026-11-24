/**
 * 렌더러, 카메라, 탭 이동, 화면 크기, 디버그 정보 (F03, 07).
 * UI(Preact)와는 이벤트로만 주고받는다 (13 §1).
 */
import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import { type AgeBand, Chibi, type Gender } from "./chibi";
import type { Point } from "./nav";
import { type Street, THEMES, buildStreet } from "./street";

export const WALK_SPEED = 2.0; // m/s (F03)
const DOOR_REACH = 0.6;
/** 캐릭터 기준 카메라 위치와, 화면 가운데에 올 지점(캐릭터 앞쪽) */
const CAM_OFFSET = new THREE.Vector3(0, 5.2, 6.5);
const LOOK_AHEAD = 3;
const CAM_MIN_Z = -3.5;

export interface WorldEvents {
  onNearDoor(near: boolean): void;
  onStats?(s: { fps: number; calls: number; triangles: number }): void;
}

export class World {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly raycaster = new THREE.Raycaster();
  private readonly clock = new THREE.Clock();
  private street: Street;
  private readonly me: Chibi;
  private path: Point[] = [];
  private goingToDoor = false;
  private nearDoor = false;
  private raf = 0;
  private frames = 0;
  private statTime = 0;
  private readonly marker: THREE.Mesh;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    shop: ShopId,
    look: { gender: Gender; ageBand: AgeBand },
    private readonly events: WorldEvents,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 07 §4
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color(THEMES[shop].sky);
    this.scene.fog = new THREE.Fog(THEMES[shop].sky, 18, 36);
    this.scene.add(new THREE.HemisphereLight("#ffe9d0", "#3b3150", 1.6));
    const sun = new THREE.DirectionalLight("#fff1dc", 1.4);
    sun.position.set(4, 10, 6);
    this.scene.add(sun);

    this.street = buildStreet(shop);
    this.scene.add(this.street.group);

    this.me = new Chibi(look);
    this.me.root.position.set(this.street.spawn.x, 0, this.street.spawn.z);
    this.me.root.rotation.y = Math.PI;
    this.scene.add(this.me.root);

    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.26, 20),
      new THREE.MeshBasicMaterial({ color: "#ffe08a", transparent: true, opacity: 0.9 }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);

    // 첫 프레임부터 캐릭터 뒤 위쪽에 둔다 (이후 부드럽게 따라감)
    this.camera.position.set(
      this.street.spawn.x + CAM_OFFSET.x,
      CAM_OFFSET.y,
      this.street.spawn.z + CAM_OFFSET.z,
    );
    this.camera.lookAt(this.street.spawn.x, 0.6, this.street.spawn.z - LOOK_AHEAD);

    this.resize();
    window.addEventListener("resize", this.resize);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    this.loop();
  }

  private down: { x: number; y: number; t: number } | null = null;

  private readonly onPointerDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  /** 짧게 탭했을 때만 이동 (끌기는 무시) */
  private readonly onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 600)
      return;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    if (this.raycaster.intersectObjects(this.street.doorTargets, false).length > 0) {
      this.walkTo(this.street.doorFront, true);
      return;
    }
    const hit = this.raycaster.intersectObject(this.street.ground, false)[0];
    if (hit) this.walkTo({ x: hit.point.x, z: hit.point.z }, false);
  };

  walkTo(target: Point, toDoor: boolean) {
    const from = { x: this.me.root.position.x, z: this.me.root.position.z };
    this.path = this.street.nav.findPath(from, target);
    this.goingToDoor = toDoor;
    const last = this.path[this.path.length - 1];
    if (last) {
      this.marker.position.set(last.x, 0.03, last.z);
      this.marker.visible = true;
    }
  }

  private readonly resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 세로 화면에서도 거리 폭이 보이게 시야를 넓힌다
    this.camera.fov = w < h ? 55 : 42;
    this.camera.updateProjectionMatrix();
  };

  private step(dt: number) {
    const pos = this.me.root.position;
    let moving = false;
    let budget = WALK_SPEED * dt;
    while (budget > 0 && this.path.length > 0) {
      const next = this.path[0] as Point;
      const dx = next.x - pos.x;
      const dz = next.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= budget) {
        pos.x = next.x;
        pos.z = next.z;
        budget -= dist;
        this.path.shift();
      } else {
        pos.x += (dx / dist) * budget;
        pos.z += (dz / dist) * budget;
        budget = 0;
      }
      if (dist > 1e-4) {
        const targetRot = Math.atan2(dx, dz);
        this.me.root.rotation.y = targetRot;
      }
      moving = true;
    }
    if (this.path.length === 0) this.marker.visible = false;
    this.me.update(dt, moving);

    const near =
      Math.hypot(pos.x - this.street.doorFront.x, pos.z - this.street.doorFront.z) < DOOR_REACH &&
      (this.goingToDoor || !moving);
    if (near !== this.nearDoor) {
      this.nearDoor = near;
      this.events.onNearDoor(near);
    }

    // 3인칭 고정 각도로 따라간다 (06 §3)
    // 건물 가까이에서는 더 다가가지 않는다 (지붕이 화면을 가리지 않게)
    const followZ = Math.max(pos.z, CAM_MIN_Z);
    const camTarget = new THREE.Vector3(pos.x, 0.6, followZ - LOOK_AHEAD);
    const desired = new THREE.Vector3(pos.x, 0, followZ).add(CAM_OFFSET);
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
    this.camera.lookAt(camTarget);
  }

  private readonly loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.step(dt);
    this.renderer.render(this.scene, this.camera);
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
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.street.dispose();
    this.renderer.dispose();
  }
}
