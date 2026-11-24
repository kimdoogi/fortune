import { describe, expect, it } from "vitest";
import { NavGrid } from "./nav";

describe("NavGrid (F03 길찾기)", () => {
  it("막힘이 없으면 바로 목적지로 간다", () => {
    const g = new NavGrid(0, 0, 10, 10);
    const path = g.findPath({ x: 1, z: 1 }, { x: 8, z: 8 });
    expect(path).toHaveLength(1);
    expect(path[0]).toEqual({ x: 8.25, z: 8.25 });
  });

  it("벽을 돌아간다", () => {
    const g = new NavGrid(0, 0, 10, 10);
    g.blockRect(4.5, 0, 5.4, 8); // x=4.5~5.5 벽, 위쪽(z>8)만 열림
    const path = g.findPath({ x: 1, z: 1 }, { x: 9, z: 1 });
    expect(path.length).toBeGreaterThan(1);
    // 모든 꺾는 점이 걸을 수 있는 칸이고, 벽을 넘을 때는 열린 쪽(z>8)을 지난다
    for (const p of path) {
      const [c, r] = g.toCell(p);
      expect(g.walkable(c, r)).toBe(true);
    }
    expect(path.some((p) => p.z > 8)).toBe(true);
    expect(path[path.length - 1]).toEqual({ x: 9.25, z: 1.25 });
  });

  it("막힌 곳을 누르면 가장 가까운 걸을 수 있는 칸으로 간다", () => {
    const g = new NavGrid(0, 0, 10, 10);
    g.blockRect(4, 4, 6, 6);
    const end = g.findPath({ x: 1, z: 5 }, { x: 5, z: 5 }).at(-1);
    expect(end).toBeDefined();
    const [c, r] = g.toCell(end as { x: number; z: number });
    expect(g.walkable(c, r)).toBe(true);
    expect(Math.abs((end?.x ?? 0) - 5)).toBeLessThanOrEqual(1.5);
  });

  it("완전히 막혀 있으면 빈 경로", () => {
    const g = new NavGrid(0, 0, 10, 10);
    g.blockRect(4.5, 0, 5.4, 10);
    expect(g.findPath({ x: 1, z: 1 }, { x: 9, z: 1 })).toEqual([]);
  });
});
