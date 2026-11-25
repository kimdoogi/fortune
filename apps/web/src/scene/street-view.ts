/**
 * 거리 모드: 거리 장면, 카메라, 탭 이동, 문 앞 판정 (F03, 06 §3).
 * 렌더러와 화면 크기·디버그 정보는 Stage(stage.ts)가 가진다. 점집 안에 있는 동안은 멈춰 있다 (F04).
 */
import type { ShopId } from "@fortune/shared-types";
import * as THREE from "three";
import { type AgeBand, Chibi, type Gender } from "./chibi";
import type { Point } from "./nav";
import { type Street, type StreetLighting, buildStreet } from "./street";

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

/** 사주집(D-065) 조명. 거리가 조명을 주지 않을 때 쓴다 */
const DEFAULT_LIGHTING: StreetLighting = {
  sky: "#a3a8e6",
  ground: "#3d2c26",
  hemi: 1.35,
  moon: "#c9d0ff",
  moonI: 0.85,
  warm: "#ffc890",
  warmI: 0.55,
};

export interface StreetEvents {
  onNearDoor(near: boolean): void;
  /** 걷기 시작할 때마다 (Stage가 처음 한 번만 UI에 알린다) */
  onMove(): void;
  /** 발이 땅에 닿을 때마다 (발소리) */
  onStep?(): void;
}

/** 두 각도 사이를 가장 짧은 쪽으로 보간 */
function turnToward(current: number, target: number, k: number) {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return current + d * k;
}

export class StreetView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
  private readonly raycaster = new THREE.Raycaster();
  private readonly street: Street;
  private readonly me: Chibi;
  private path: Point[] = [];
  private goingToDoor = false;
  private nearDoor = false;
  /** 점집에서 막 나와 문 앞에 섰다: 움직이기 전까지 거리 쪽을 본다 */
  private justExited = false;
  private idle = 0;
  private facing = 0;
  private readonly marker: THREE.Mesh;
  private readonly markerMat: THREE.MeshBasicMaterial;
  private markerAge = 0;

  constructor(
    shop: ShopId,
    look: { gender: Gender; ageBand: AgeBand },
    private readonly events: StreetEvents,
  ) {
    this.street = buildStreet(shop);
    this.scene.add(this.street.group);
    this.scene.background = this.street.fogColor;
    const [fogNear, fogFar] = this.street.fogRange ?? [16, 44];
    this.scene.fog = new THREE.Fog(this.street.fogColor, fogNear, fogFar);

    // 달빛(차갑게) + 등불 쪽 채움빛(따뜻하게). 진짜 점광원은 쓰지 않는다 (D-065). 색은 점집마다 (D-075)
    const l = this.street.lighting ?? DEFAULT_LIGHTING;
    this.scene.add(new THREE.HemisphereLight(l.sky, l.ground, l.hemi));
    const moon = new THREE.DirectionalLight(l.moon, l.moonI);
    moon.position.set(-5, 9, 8);
    const warm = new THREE.DirectionalLight(l.warm, l.warmI);
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

    this.snapCamera();
  }

  /** 카메라를 캐릭터 뒤 위쪽에 바로 둔다 (이후 부드럽게 따라감) */
  private snapCamera() {
    const p = { x: this.me.root.position.x, z: this.me.root.position.z };
    this.camera.position.copy(this.cameraPos(p));
    this.camera.lookAt(this.cameraTarget(p));
  }

  /** 점집에서 나오면 문 앞에 서서 거리 쪽을 본다 (06 §4, F04) */
  standAtDoor() {
    const d = this.street.doorFront;
    this.path = [];
    this.goingToDoor = false;
    this.marker.visible = false;
    this.me.root.position.set(d.x, 0, d.z);
    this.facing = 0;
    this.me.root.rotation.y = 0;
    this.justExited = true;
    this.idle = 0;
    this.snapCamera();
  }

  /** 점집에 들어가면 문 앞 상태를 내려 둔다 (나오면 다시 알린다) */
  leaveDoor() {
    if (this.nearDoor) {
      this.nearDoor = false;
      this.events.onNearDoor(false);
    }
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

  /** 화면 탭 (정규화 좌표). 문을 누르면 문 앞까지, 땅을 누르면 그 자리로 */
  tap(ndc: THREE.Vector2) {
    this.raycaster.setFromCamera(ndc, this.camera);
    if (this.raycaster.intersectObjects(this.street.doorTargets, false).length > 0) {
      this.walkTo(this.street.doorFront, true);
      return;
    }
    const hit = this.raycaster.intersectObject(this.street.ground, false)[0];
    if (hit) this.walkTo({ x: hit.point.x, z: hit.point.z }, false);
  }

  walkTo(target: Point, toDoor: boolean) {
    const from = { x: this.me.root.position.x, z: this.me.root.position.z };
    this.path = this.street.nav.findPath(from, target);
    this.goingToDoor = toDoor;
    const last = this.path[this.path.length - 1];
    if (last) {
      this.marker.position.set(last.x, 0.04, last.z);
      this.marker.visible = true;
      this.markerAge = 0;
      this.justExited = false;
      this.events.onMove();
    }
  }

  resize(w: number, h: number, pixelRatio: number) {
    this.camera.aspect = w / h;
    // 세로 화면에서도 거리 폭이 보이게 시야를 넓힌다
    this.camera.fov = w < h ? 55 : 42;
    this.camera.updateProjectionMatrix();
    this.street.setViewportHeight(h * pixelRatio);
  }

  update(dt: number, time: number) {
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
    } else if (this.justExited) {
      // 막 나왔을 때는 거리 쪽을 본다
    } else if (near) {
      this.facing = turnToward(this.facing, Math.PI, 1 - Math.exp(-dt * 6));
    } else if (this.idle > IDLE_TURN_AFTER) {
      const toCam = Math.atan2(this.camera.position.x - pos.x, this.camera.position.z - pos.z);
      this.facing = turnToward(this.facing, toCam, 1 - Math.exp(-dt * 3));
    }
    this.me.root.rotation.y = this.facing;
    this.me.update(dt, moving);
    if (this.me.takeStep()) this.events.onStep?.();

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

  dispose() {
    this.street.dispose();
    this.me.dispose();
    this.marker.geometry.dispose();
    this.markerMat.dispose();
  }
}
