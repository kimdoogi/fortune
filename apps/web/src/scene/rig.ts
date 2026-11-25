/**
 * 움직이는 캐릭터(점술가, 앉은 내 캐릭터)의 드로우콜을 줄이는 도구 (07 §3 점집 내부 60 이하).
 * 같은 뼈(Group)에 붙은 조각은 버텍스 컬러로 칠해 한 메시로 합친다. 뼈는 그대로 두어 애니메이션은 그대로 된다.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { colored } from "./geo";

/**
 * 버텍스 컬러 램버트. 밤 장면에서도 묻히지 않게 자기 색의 k배를 스스로 낸다
 * (chibi.ts의 emissive = 색 × 0.22를 버텍스 컬러로 옮긴 것).
 */
export function selfLitMaterial(k = 0.22): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({
    vertexColors: true,
    emissive: new THREE.Color(k, k, k),
  });
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      "vec3 totalEmissiveRadiance = emissive;",
      "vec3 totalEmissiveRadiance = emissive * vColor.rgb;",
    );
  };
  m.customProgramCacheKey = () => "selflit";
  return m;
}

/** 빛을 받지 않는 버텍스 컬러 재질 (눈, 입, 빛나는 소품) */
export function flatMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ vertexColors: true });
}

interface Bucket {
  lit: THREE.BufferGeometry[];
  flat: THREE.BufferGeometry[];
}

/** 뼈마다 조각을 모았다가 build()에서 뼈당 최대 2개(빛 받는 것 / 안 받는 것) 메시로 만든다 */
export class RigBuilder {
  private readonly buckets = new Map<THREE.Object3D, Bucket>();

  private bucket(bone: THREE.Object3D): Bucket {
    let b = this.buckets.get(bone);
    if (!b) {
      b = { lit: [], flat: [] };
      this.buckets.set(bone, b);
    }
    return b;
  }

  /** 뼈 기준 좌표로 놓인 지오메트리를 한 색으로 칠해 넣는다 */
  add(bone: THREE.Object3D, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
    this.bucket(bone).lit.push(colored(geo, color));
  }

  /** 빛을 받지 않는 조각 (눈동자, 금박 반짝이, 불빛) */
  addFlat(bone: THREE.Object3D, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
    this.bucket(bone).flat.push(colored(geo, color));
  }

  /** 이미 버텍스 컬러가 있는 지오메트리 (줄무늬 색동 등) */
  addColored(bone: THREE.Object3D, geo: THREE.BufferGeometry, flat = false) {
    const b = this.bucket(bone);
    (flat ? b.flat : b.lit).push(geo);
  }

  /** 메시를 만들어 뼈에 붙이고, 새로 만든 지오메트리를 돌려준다 (dispose용) */
  build(lit: THREE.Material, flat: THREE.Material): THREE.BufferGeometry[] {
    const out: THREE.BufferGeometry[] = [];
    for (const [bone, b] of this.buckets) {
      for (const [geos, m] of [
        [b.lit, lit],
        [b.flat, flat],
      ] as const) {
        if (geos.length === 0) continue;
        const merged = mergeGeometries(geos);
        for (const g of geos) g.dispose();
        if (!merged) throw new Error("rig merge failed");
        out.push(merged);
        bone.add(new THREE.Mesh(merged, m));
      }
    }
    this.buckets.clear();
    return out;
  }
}

/**
 * 이미 만들어진 캐릭터(chibi.ts)의 불투명 메시를 뼈마다 합친다.
 * 투명한 조각(볼터치, 발밑 그림자)은 그대로 둔다. 새로 만든 지오메트리를 돌려준다.
 */
export function mergeRig(
  root: THREE.Object3D,
  lit: THREE.Material,
  flat: THREE.Material,
): THREE.BufferGeometry[] {
  const nodes: THREE.Object3D[] = [];
  root.traverse((o) => {
    nodes.push(o);
  });
  const rig = new RigBuilder();
  for (const node of nodes) {
    for (const child of [...node.children]) {
      if (!(child instanceof THREE.Mesh) || child.children.length > 0) continue;
      const m = child.material as THREE.Material;
      if (m.transparent) continue;
      if (!(m instanceof THREE.MeshLambertMaterial || m instanceof THREE.MeshBasicMaterial))
        continue;
      child.updateMatrix();
      const g = (child.geometry as THREE.BufferGeometry).clone();
      g.applyMatrix4(child.matrix);
      if (m instanceof THREE.MeshBasicMaterial) rig.addFlat(node, g, m.color);
      else rig.add(node, g, m.color);
      node.remove(child);
    }
  }
  return rig.build(lit, flat);
}

/** 그려지는 삼각형 수 (07 §3 한도 확인용) */
export function countTriangles(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const g = o.geometry as THREE.BufferGeometry;
      n += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    }
  });
  return Math.round(n);
}

/** 메시 수 = 대략적인 드로우콜 수 */
export function countMeshes(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Points) n++;
  });
  return n;
}
