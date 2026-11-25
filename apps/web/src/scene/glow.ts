/**
 * 불빛 번짐. 진짜 광원 대신 가산 혼합 점 하나로 모든 등불의 빛무리를 그린다 (D-065, 드로우콜 1개).
 */
import * as THREE from "three";

export interface GlowSpot {
  x: number;
  y: number;
  z: number;
  /** 대략적인 빛무리 지름 (m) */
  size: number;
  color: THREE.ColorRepresentation;
  /** 0이면 깜빡이지 않는다 */
  flicker?: number;
}

const VERT = /* glsl */ `
  attribute float size;
  attribute float phase;
  attribute float flicker;
  attribute vec3 color;
  uniform float uScale;
  uniform float uTime;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float f = 1.0 + flicker * (0.6 * sin(uTime * 2.7 + phase) + 0.4 * sin(uTime * 7.3 + phase * 1.7));
    gl_PointSize = size * f * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uIntensity;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float halo = pow(max(0.0, 1.0 - d), 1.8);
    float core = smoothstep(0.32, 0.0, d);
    float a = (halo * 0.75 + core * 0.6) * uIntensity;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

export function glowMaterial(intensity = 0.7): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 }, uTime: { value: 0 }, uIntensity: { value: intensity } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function glowPoints(spots: GlowSpot[], material: THREE.ShaderMaterial): THREE.Points {
  const n = spots.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const phase = new Float32Array(n);
  const flicker = new Float32Array(n);
  const c = new THREE.Color();
  spots.forEach((s, i) => {
    pos.set([s.x, s.y, s.z], i * 3);
    c.set(s.color);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = s.size;
    phase[i] = i * 2.399;
    flicker[i] = s.flicker ?? 0.05;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
  geo.setAttribute("flicker", new THREE.BufferAttribute(flicker, 1));
  const pts = new THREE.Points(geo, material);
  pts.frustumCulled = false;
  return pts;
}
