/**
 * 거리의 움직이는 분위기 효과 (D-075): 낮게 깔린 안개, 물, 떠다니는 구름, 굴뚝 연기, 나는 까마귀.
 * 효과마다 드로우콜 1개. 매 프레임 갱신은 Kit.updaters에 넣는다.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { hash } from "./geo";
import type { Kit } from "./street-kit";

const NOISE_GLSL = /* glsl */ `
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;

const WORLD_VERT = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

function setTime(mat: THREE.ShaderMaterial, time: number) {
  const u = mat.uniforms.uTime;
  if (u) u.value = time;
}

/** 낮게 깔린 안개: 높이가 다른 판 몇 장에 흐르는 노이즈를 그린다 */
export function addMist(
  kit: Kit,
  opts: { color: string; opacity: number; heights: number[]; speed?: number; patchy?: boolean },
) {
  const planes = opts.heights.map((y) => {
    const g = new THREE.PlaneGeometry(44, 44, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, -3);
    return g;
  });
  const geo = kit.track(mergeGeometries(planes) as THREE.BufferGeometry);
  for (const p of planes) p.dispose();
  const mat = kit.track(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(opts.color) },
        uOpacity: { value: opts.opacity },
        uSpeed: { value: opts.speed ?? 0.12 },
        uLow: { value: opts.patchy ? 0.5 : 0.3 },
      },
      vertexShader: WORLD_VERT,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uSpeed;
        uniform float uLow;
        varying vec3 vW;
        ${NOISE_GLSL}
        void main() {
          vec2 p = vW.xz * 0.22 + vec2(uTime * uSpeed, uTime * uSpeed * 0.4) + vW.y * 7.0;
          float f = vnoise(p) * 0.6 + vnoise(p * 2.3 + 5.0) * 0.4;
          float a = smoothstep(uLow, uLow + 0.45, f);
          // 가장자리는 옅게 (멀리·담장 밖에서 판 끝이 보이지 않게)
          float edge = 1.0 - smoothstep(8.0, 20.0, length(vW.xz - vec2(0.0, -3.0)));
          gl_FragColor = vec4(uColor, a * edge * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  kit.group.add(mesh);
  kit.updaters.push((t) => setTime(mat, t));
}

/** 물: 일렁이는 물결 무늬 + 반짝임 + 달빛 기둥. 물 아래 바닥은 ground가 낮춰 둔다 */
export function addWater(
  kit: Kit,
  opts: { deep: string; light: string; glint: string; moonX: number; y: number },
) {
  const geo = kit.track(new THREE.PlaneGeometry(18, 10, 1, 1));
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, opts.y, -0.7);
  const mat = kit.track(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(opts.deep) },
        uLight: { value: new THREE.Color(opts.light) },
        uGlint: { value: new THREE.Color(opts.glint) },
        uMoonX: { value: opts.moonX },
      },
      vertexShader: WORLD_VERT,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uDeep;
        uniform vec3 uLight;
        uniform vec3 uGlint;
        uniform float uMoonX;
        varying vec3 vW;
        ${NOISE_GLSL}
        void main() {
          vec2 p = vW.xz;
          float r = vnoise(p * vec2(0.9, 2.2) + vec2(uTime * 0.12, uTime * 0.05)) * 0.55
                  + vnoise(p * vec2(1.7, 3.4) - vec2(uTime * 0.09, -uTime * 0.07)) * 0.45;
          vec3 c = mix(uDeep, uLight, smoothstep(0.3, 0.9, r) * 0.35 + 0.2);
          // 먼 쪽(-z)일수록 하늘이 비쳐 밝다
          c = mix(c, uLight, smoothstep(2.0, -4.5, p.y) * 0.35);
          // 달빛 기둥 (달 쪽 x에 밝은 띠가 흔들린다)
          float col = exp(-pow((p.x - uMoonX + sin(p.y * 3.0 + uTime) * 0.15) * 0.9, 2.0));
          float streak = col * smoothstep(0.4, 0.75, r) * 0.6;
          // 잔 반짝임 (드물게)
          float sp = pow(vnoise(p * 4.0 + vec2(uTime * 0.5, uTime * 0.3)), 24.0) * 0.9;
          c += uGlint * (streak + sp);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  kit.group.add(mesh);
  kit.updaters.push((t) => setTime(mat, t));
}

/** 공중에 떠서 천천히 오르내리는 구름 덩어리 (InstancedMesh 하나) */
export function addClouds(
  kit: Kit,
  clouds: { x: number; y: number; z: number; s: number }[],
  colors: string[],
) {
  const puffs: { cloud: number; dx: number; dy: number; dz: number; r: number }[] = [];
  clouds.forEach((c, i) => {
    const n = 4 + Math.floor(hash(i, 3.3) * 3);
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1) - 0.5;
      const mid = 1 - Math.abs(t) * 1.2;
      puffs.push({
        cloud: i,
        dx: t * 2.2 * c.s,
        dy: (hash(i, k) - 0.3) * 0.25 * c.s,
        dz: (hash(k, i) - 0.5) * 0.5 * c.s,
        r: (0.45 + mid * 0.4 + hash(k, k + i) * 0.12) * c.s,
      });
    }
  });
  const mesh = new THREE.InstancedMesh(
    kit.track(new THREE.IcosahedronGeometry(1, 2)),
    kit.track(new THREE.MeshLambertMaterial({ emissive: "#5d5a8c" })),
    puffs.length,
  );
  const cs = colors.map((c) => new THREE.Color(c));
  puffs.forEach((p, i) => mesh.setColorAt(i, cs[p.cloud % cs.length] as THREE.Color));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const place = (time: number) => {
    puffs.forEach((p, i) => {
      const c = clouds[p.cloud] as { x: number; y: number; z: number; s: number };
      const ph = p.cloud * 1.9;
      const bob = Math.sin(time * 0.6 + ph) * 0.18 + Math.sin(time * 1.3 + ph + i) * 0.03;
      const drift = Math.sin(time * 0.15 + ph) * 0.35;
      v.set(c.x + p.dx + drift, c.y + p.dy + bob, c.z + p.dz);
      s.set(p.r, p.r * 0.78, p.r);
      mesh.setMatrixAt(i, m.compose(v, q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0);
  mesh.frustumCulled = false;
  kit.group.add(mesh);
  kit.updaters.push(place);
}

/** 굴뚝 연기: 퍼프가 올라가며 커지고 사라진다 */
export function addSmoke(kit: Kit, x: number, y: number, z: number) {
  const n = 7;
  const mesh = new THREE.InstancedMesh(
    kit.track(new THREE.IcosahedronGeometry(1, 1)),
    kit.track(
      new THREE.MeshLambertMaterial({
        color: "#c9bedb",
        emissive: "#3a3350",
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    ),
    n,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const place = (time: number) => {
    for (let i = 0; i < n; i++) {
      const p = (time * 0.16 + i / n) % 1;
      const fade = 1 - Math.max(0, (p - 0.7) / 0.3);
      v.set(x + p * 0.9 + Math.sin(p * 7 + i) * 0.12, y + p * 2.0, z - p * 0.3);
      s.setScalar((0.14 + p * 0.38) * fade);
      mesh.setMatrixAt(i, m.compose(v, q, s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  kit.group.add(mesh);
  kit.updaters.push(place);
}

/** 하늘을 맴도는 까마귀 실루엣 (날갯짓은 폭을 줄였다 폈다) */
export function addCrows(kit: Kit, cx: number, cy: number, cz: number, n: number) {
  const shape = new THREE.Shape();
  // 펼친 날개 (M자), 꼬리는 아래
  shape.moveTo(0, 0.12);
  shape.quadraticCurveTo(0.25, 0.22, 0.62, 0.05);
  shape.quadraticCurveTo(0.3, 0.06, 0.08, -0.05);
  shape.lineTo(0.1, -0.28);
  shape.lineTo(0, -0.22);
  shape.lineTo(-0.1, -0.28);
  shape.lineTo(-0.08, -0.05);
  shape.quadraticCurveTo(-0.3, 0.06, -0.62, 0.05);
  shape.quadraticCurveTo(-0.25, 0.22, 0, 0.12);
  const geo = kit.track(new THREE.ShapeGeometry(shape, 4));
  geo.rotateX(-Math.PI / 2 + 0.5);
  const mesh = new THREE.InstancedMesh(
    geo,
    kit.track(new THREE.MeshBasicMaterial({ color: "#0d0a12", side: THREE.DoubleSide })),
    n,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const place = (time: number) => {
    for (let i = 0; i < n; i++) {
      const ph = i * 2.1;
      const r = 3.2 + i * 0.9;
      const a = time * (0.32 - i * 0.04) + ph;
      v.set(
        cx + Math.cos(a) * r,
        cy + i * 0.6 + Math.sin(time * 0.7 + ph) * 0.3,
        cz + Math.sin(a) * r * 0.5,
      );
      // 날아가는 방향을 본다
      q.setFromEuler(e.set(0, Math.PI - a, 0.3));
      const flap = 0.55 + 0.45 * Math.abs(Math.sin(time * 5 + ph));
      s.set(flap, 1, 1).multiplyScalar(0.9 + i * 0.1);
      mesh.setMatrixAt(i, m.compose(v, q, s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0);
  mesh.frustumCulled = false;
  kit.group.add(mesh);
  kit.updaters.push(place);
}
