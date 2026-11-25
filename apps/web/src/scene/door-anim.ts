/**
 * 점집 문 열기 연출 (D-094). 거리 배경에 구워 둔 문 위에 움직이는 문짝을 겹쳐 둔다.
 * 평소에는 숨겨 두고, 들어갈 때만 어두운 안쪽 + 문짝을 보이고 문짝을 바깥(거리 쪽)으로 연다.
 * 나올 때는 열린 채로 시작해 닫는다. 드로우콜은 문 열려 있는 동안만 2~3개 늘어난다 (07).
 */
import * as THREE from "three";

/** 건물이 넘기는 문 모양 (buildings/*.ts) */
export interface Doorway {
  /** 문 앞면 z (구운 문살·테두리보다 조금 앞에 문짝을 둔다) */
  z: number;
  shape: "rect" | "arch" | "circle";
  /** rect: 너비·높이 / arch: 너비, h는 곧은 부분 높이 / circle: 지름 */
  w: number;
  h: number;
  /** 문 아래 y (circle은 원의 아래 끝) */
  y0: number;
  /** 문짝 수: 한 짝(왼쪽 경첩) 또는 두 짝(양쪽 경첩) */
  leaves: 1 | 2;
  /** 문짝 바탕(창호지·널판)과 테두리 색 */
  leaf: string;
  frame: string;
  /** 창호지 문이면 스스로 빛나 보이게 (밤에 안쪽 불빛) */
  paper: boolean;
}

/** 문이 다 열리는 각도 */
const OPEN_ANGLE = THREE.MathUtils.degToRad(105);
/** 구운 문보다 앞으로 띄우는 거리 */
const LIFT = 0.1;

/** 문 전체 윤곽 (가운데 x = 0, 아래 y = 0) */
function outline(d: Doorway): THREE.Shape {
  const s = new THREE.Shape();
  const hw = d.w / 2;
  if (d.shape === "circle") {
    s.absarc(0, hw, hw, 0, Math.PI * 2, false);
    return s;
  }
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  if (d.shape === "arch") {
    s.lineTo(hw, d.h);
    s.absarc(0, d.h, hw, 0, Math.PI, false);
  } else {
    s.lineTo(hw, d.h);
    s.lineTo(-hw, d.h);
  }
  s.lineTo(-hw, 0);
  return s;
}

/** 문짝 하나 윤곽: side -1이면 왼쪽 반, 1이면 오른쪽 반, 0이면 전체. 경첩 쪽이 x = 0이 되게 옮긴다 */
function leafShape(d: Doorway, side: -1 | 0 | 1): THREE.Shape {
  const full = outline(d).getPoints(32);
  const hw = d.w / 2;
  const pts = full
    .map((p) =>
      side === -1
        ? new THREE.Vector2(Math.min(p.x, 0), p.y)
        : side === 1
          ? new THREE.Vector2(Math.max(p.x, 0), p.y)
          : p.clone(),
    )
    // 경첩(바깥 모서리)을 원점으로: 왼쪽 문짝은 +x로, 오른쪽 문짝은 -x로 뻗는다
    .map((p) => new THREE.Vector2(side === 1 ? p.x - hw : p.x + hw, p.y));
  return new THREE.Shape(pts);
}

export interface DoorAnim {
  group: THREE.Group;
  /** 0 = 닫힘(숨김), 1 = 다 열림 */
  set(open: number): void;
  dispose(): void;
}

export function buildDoorAnim(d: Doorway): DoorAnim {
  const group = new THREE.Group();
  group.position.set(0, d.y0, d.z + LIFT);
  group.visible = false;
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T) => {
    owned.push(x);
    return x;
  };

  // 안쪽: 어둑하고 따뜻한 방 (문짝이 열리면 보인다)
  const inner = new THREE.Mesh(
    own(new THREE.ShapeGeometry(outline(d), 24)),
    own(new THREE.MeshBasicMaterial({ color: "#3a2214", fog: false })),
  );
  inner.position.z = -0.005;
  group.add(inner);

  const frameMat = own(new THREE.MeshLambertMaterial({ color: d.frame }));
  const faceMat = own(
    d.paper
      ? new THREE.MeshBasicMaterial({ color: d.leaf, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ color: d.leaf, side: THREE.DoubleSide }),
  );
  const sides: (-1 | 0 | 1)[] = d.leaves === 2 ? [-1, 1] : [0];
  const hinges: { pivot: THREE.Group; dir: number }[] = [];
  for (const side of sides) {
    const pivot = new THREE.Group();
    // 경첩: 왼쪽 문짝(또는 한 짝)은 왼쪽 모서리, 오른쪽 문짝은 오른쪽 모서리
    pivot.position.x = side === 1 ? d.w / 2 : -d.w / 2;
    const shape = leafShape(d, side);
    // 테두리: 문짝 전체를 테두리 색으로 깔고, 안쪽을 조금 줄여 바탕색을 얹는다
    const frame = new THREE.Mesh(
      own(
        new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false, curveSegments: 12 }),
      ),
      frameMat,
    );
    const faceGeo = own(new THREE.ShapeGeometry(shape, 12));
    faceGeo.computeBoundingBox();
    const bb = faceGeo.boundingBox as THREE.Box3;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const inset = 0.86;
    faceGeo
      .translate(-cx, -cy, 0)
      .scale(inset, inset + (1 - inset) / 2, 1)
      .translate(cx, cy, 0);
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.z = 0.045;
    // 창호지 문은 가운데 문살 하나 (구운 문과 비슷하게)
    if (d.paper) {
      const bar = new THREE.Mesh(
        own(new THREE.BoxGeometry(bb.max.x - bb.min.x, 0.05, 0.02)),
        frameMat,
      );
      bar.position.set(cx, cy, 0.06);
      pivot.add(bar);
    }
    pivot.add(frame, face);
    group.add(pivot);
    // 바깥(거리 쪽, +z)으로 열린다: 왼쪽 경첩은 -각도, 오른쪽 경첩은 +각도
    hinges.push({ pivot, dir: side === 1 ? 1 : -1 });
  }

  return {
    group,
    set(open) {
      const t = THREE.MathUtils.clamp(open, 0, 1);
      group.visible = t > 0.001;
      // 처음엔 무겁게, 끝에선 부드럽게
      const e = 1 - (1 - t) ** 3;
      for (const h of hinges) h.pivot.rotation.y = h.dir * e * OPEN_ANGLE;
    },
    dispose() {
      for (const x of owned) x.dispose();
      owned.length = 0;
    },
  };
}
