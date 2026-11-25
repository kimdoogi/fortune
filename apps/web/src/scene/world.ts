/**
 * 렌더러, 카메라, 탭 이동, 화면 크기, 디버그 정보 (F03, 07).
 * UI(Preact)와는 이벤트로만 주고받는다 (13 §1).
 */
import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import { type AgeBand, Chibi, type Gender } from "./chibi";
import type { Point } from "./nav";
import { type Street, buildStreet } from "./street";

export const WALK_SPEED = 2.0; // m/s (F03)
const DOOR_REACH = 0.6;
/** 캐릭터 기준 카메라 위치와, 화면 가운데에 올 지점(캐릭터 앞쪽) */
const CAM_OFFSET = new THREE.Vector3(0, 3.7, 6.0);
const LOOK_AHEAD = 3.2;
const LOOK_HEIGHT = 1.0;
/** 건물 가까이에서는 더 다가가지 않는다 (지붕이 화면을 가리지 않게) */
const CAM_MIN_Z = -3.6;
/** 가만히 서 있으면 이만큼 뒤에 카메라 쪽으로 돌아본다 (08 §1) */
const IDLE_TURN_AFTER = 1.5;

export interface WorldEvents {
  onNearDoor(near: boolean): void;
  /** 처음 걷기 시작했을 때 한 번 (안내 문구를 숨긴다) */
  onFirstMove?(): void;
  onStats?(s: { fps: number; calls: number; triangles: number }): void;
}

/** 두 각도 사이를 가장 짧은 쪽으로 보간 */
function turnToward(current: number, target: number, k: number) {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return current + d * k;
}

export class World {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
  private readonly raycaster = new THREE.Raycaster();
  private readonly clock = new THREE.Clock();
  private readonly street: Street;
  private readonly me: Chibi;
  private path: Point[] = [];
  private goingToDoor = false;
  private nearDoor = false;
  private moved = false;
  private idle = 0;
  private facing = 0;
  private raf = 0;
  private frames = 0;
  private statTime = 0;
  private readonly marker: THREE.Mesh;
  private readonly markerMat: THREE.MeshBasicMaterial;
  private markerAge = 0;

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

    this.street = buildStreet(shop);
    this.scene.add(this.street.group);
    this.scene.background = this.street.fogColor;
    this.scene.fog = new THREE.Fog(this.street.fogColor, 16, 44);

    // 달빛(차갑게) + 등불 쪽 채움빛(따뜻하게). 진짜 점광원은 쓰지 않는다 (D-065)
    this.scene.add(new THREE.HemisphereLight("#a3a8e6", "#3d2c26", 1.35));
    const moon = new THREE.DirectionalLight("#c9d0ff", 0.85);
    moon.position.set(-5, 9, 8);
    const warm = new THREE.DirectionalLight("#ffc890", 0.55);
    warm.position.set(4, 3, 7);
    this.scene.add(moon, warm);

    this.me = new Chibi(look);
    this.me.root.position.set(this.street.spawn.x, 0, this.street.spawn.z);
    this.me.root.rotation.y = this.facing; // 처음에는 카메라를 본다
    this.scene.add(this.me.root);

    this.markerMat = new THREE.MeshBasicMaterial({
      color: "#ffe08a",
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.27, 28), this.markerMat);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);

    // 첫 프레임부터 캐릭터 뒤 위쪽에 둔다 (이후 부드럽게 따라감)
    this.camera.position.copy(this.cameraPos(this.street.spawn));
    this.camera.lookAt(this.cameraTarget(this.street.spawn));

    this.resize();
    window.addEventListener("resize", this.resize);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    this.loop();
  }

  private followZ(p: Point) {
    return Math.max(p.z, CAM_MIN_Z);
  }

  private cameraPos(p: Point) {
    return new THREE.Vector3(p.x, 0, this.followZ(p)).add(CAM_OFFSET);
  }

  private cameraTarget(p: Point) {
    return new THREE.Vector3(p.x, LOOK_HEIGHT, this.followZ(p) - LOOK_AHEAD);
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
      this.marker.position.set(last.x, 0.04, last.z);
      this.marker.visible = true;
      this.markerAge = 0;
      if (!this.moved) {
        this.moved = true;
        this.events.onFirstMove?.();
      }
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
    this.street.setViewportHeight(h * this.renderer.getPixelRatio());
  };

  private step(dt: number, time: number) {
    const pos = this.me.root.position;
    let moving = false;
    let heading: number | null = null;
    let budget = WALK_SPEED * dt;
    while (budget > 0 && this.path.length > 0) {
      const next = this.path[0] as Point;
      const dx = next.x - pos.x;
      const dz = next.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1e-4) heading = Math.atan2(dx, dz);
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
      moving = true;
    }
    this.idle = moving ? 0 : this.idle + dt;

    const near =
      Math.hypot(pos.x - this.street.doorFront.x, pos.z - this.street.doorFront.z) < DOOR_REACH &&
      (this.goingToDoor || !moving);
    if (near !== this.nearDoor) {
      this.nearDoor = near;
      this.events.onNearDoor(near);
    }

    // 걷는 방향으로 부드럽게 돌고, 오래 서 있으면 카메라 쪽(문 앞이면 문 쪽)을 본다
    if (heading !== null) {
      this.facing = turnToward(this.facing, heading, 1 - Math.exp(-dt * 14));
    } else if (near) {
      this.facing = turnToward(this.facing, Math.PI, 1 - Math.exp(-dt * 6));
    } else if (this.idle > IDLE_TURN_AFTER) {
      const toCam = Math.atan2(this.camera.position.x - pos.x, this.camera.position.z - pos.z);
      this.facing = turnToward(this.facing, toCam, 1 - Math.exp(-dt * 3));
    }
    this.me.root.rotation.y = this.facing;
    this.me.update(dt, moving);

    // 탭 표시: 퍼지며 흐려진다
    if (this.marker.visible) {
      this.markerAge += dt;
      const pulse = (this.markerAge * 1.6) % 1;
      this.marker.scale.setScalar(0.8 + pulse * 0.6);
      this.markerMat.opacity = 0.9 * (1 - pulse * 0.7);
      if (this.path.length === 0) this.marker.visible = false;
    }

    this.street.update(time);

    // 3인칭 고정 각도로 따라간다 (06 §3)
    const p = { x: pos.x, z: pos.z };
    this.camera.position.lerp(this.cameraPos(p), 1 - Math.exp(-dt * 5));
    this.camera.lookAt(this.cameraTarget(p));
  }

  private readonly loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.step(dt, this.clock.elapsedTime);
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
    this.marker.geometry.dispose();
    this.markerMat.dispose();
    this.renderer.dispose();
  }
}
