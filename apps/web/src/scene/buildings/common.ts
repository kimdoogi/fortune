/**
 * 건물들이 같이 쓰는 작은 소품 (항아리, 늘어진 줄).
 */
import * as THREE from "three";
import { at, beam, colored, gradient } from "../geo";

/** 둥근 항아리 (장독, 달항아리) */
export function jar(h: number, color: string, lid: string | null): THREE.BufferGeometry[] {
  const profile = [
    [0, 0],
    [0.16, 0],
    [0.24, 0.1],
    [0.29, 0.25],
    [0.27, 0.38],
    [0.2, 0.47],
    [0.15, 0.5],
    [0.16, 0.54],
    [0, 0.54],
  ].map(([r, y]) => new THREE.Vector2((r as number) * h, (y as number) * h));
  const body = gradient(
    new THREE.LatheGeometry(profile, 12),
    new THREE.Color(color).multiplyScalar(0.7),
    color,
  );
  if (!lid) return [body];
  const cap = colored(
    at(new THREE.CylinderGeometry(0.12 * h, 0.17 * h, 0.08 * h, 12), 0, 0.57 * h, 0),
    lid,
  );
  return [body, cap];
}

export function place(geos: THREE.BufferGeometry[], x: number, y: number, z: number, ry = 0) {
  return geos.map((g) => at(g, x, y, z, ry));
}

/** 처마 앞을 가로지르는 늘어진 줄 */
export function rope(
  x0: number,
  x1: number,
  y: number,
  z: number,
  sag: number,
  color: string,
  thick = 0.04,
) {
  const out: THREE.BufferGeometry[] = [];
  const pt = (t: number) => new THREE.Vector3(x0 + (x1 - x0) * t, y - sag * 4 * t * (1 - t), z);
  for (let i = 0; i < 12; i++)
    out.push(colored(beam(pt(i / 12), pt((i + 1) / 12), thick, thick), color));
  return { out, at: pt };
}
