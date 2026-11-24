/**
 * 걸을 수 있는 격자와 A* 길찾기 (F03: 0.5m 격자). 렌더링과 무관한 순수 코드라 테스트한다.
 * 멀티플레이에서 모든 클라이언트가 같은 격자·같은 알고리즘으로 같은 경로를 재생한다.
 */

export interface Point {
  x: number;
  z: number;
}

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;

  constructor(
    readonly minX: number,
    readonly minZ: number,
    readonly maxX: number,
    readonly maxZ: number,
    readonly cell = 0.5,
  ) {
    this.cols = Math.round((maxX - minX) / cell);
    this.rows = Math.round((maxZ - minZ) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  /** 사각형 영역을 막는다 (건물, 담장) */
  blockRect(x0: number, z0: number, x1: number, z1: number) {
    const [c0, r0] = this.toCell({ x: Math.min(x0, x1), z: Math.min(z0, z1) });
    const [c1, r1] = this.toCell({ x: Math.max(x0, x1), z: Math.max(z0, z1) });
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.setBlocked(c, r);
  }

  /** 원 영역을 막는다 (나무, 등불) */
  blockCircle(cx: number, cz: number, radius: number) {
    this.blockRect(cx - radius, cz - radius, cx + radius, cz + radius);
  }

  private setBlocked(c: number, r: number) {
    if (this.inside(c, r)) this.blocked[r * this.cols + c] = 1;
  }

  inside(c: number, r: number) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  walkable(c: number, r: number) {
    return this.inside(c, r) && this.blocked[r * this.cols + c] === 0;
  }

  toCell(p: Point): [number, number] {
    return [Math.floor((p.x - this.minX) / this.cell), Math.floor((p.z - this.minZ) / this.cell)];
  }

  toWorld(c: number, r: number): Point {
    return { x: this.minX + (c + 0.5) * this.cell, z: this.minZ + (r + 0.5) * this.cell };
  }

  /** 막힌 칸이면 가장 가까운 걸을 수 있는 칸 (F03: 걸을 수 없는 곳을 탭하면 가장 가까운 지점) */
  nearestWalkable(p: Point): [number, number] | null {
    const [c0, r0] = this.toCell(p);
    if (this.walkable(c0, r0)) return [c0, r0];
    for (let d = 1; d < Math.max(this.cols, this.rows); d++) {
      let best: [number, number] | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let r = r0 - d; r <= r0 + d; r++) {
        for (let c = c0 - d; c <= c0 + d; c++) {
          if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== d || !this.walkable(c, r)) continue;
          const dist = (c - c0) ** 2 + (r - r0) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            best = [c, r];
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** 두 칸 사이가 막힘 없이 보이는지 (경로 다듬기용) */
  private lineClear(a: [number, number], b: [number, number]) {
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const c = Math.round(a[0] + (b[0] - a[0]) * t);
      const r = Math.round(a[1] + (b[1] - a[1]) * t);
      if (!this.walkable(c, r)) return false;
    }
    return true;
  }

  /**
   * A* (8방향, 대각선은 양옆이 막히지 않을 때만). 결과는 다듬은 웨이포인트 목록 (출발점 제외, 도착점 포함).
   * 길이 없으면 빈 배열.
   */
  findPath(from: Point, to: Point): Point[] {
    const start = this.nearestWalkable(from);
    const goal = this.nearestWalkable(to);
    if (!start || !goal) return [];
    const idx = (c: number, r: number) => r * this.cols + c;
    const g = new Float32Array(this.cols * this.rows).fill(Number.POSITIVE_INFINITY);
    const came = new Int32Array(this.cols * this.rows).fill(-1);
    const closed = new Uint8Array(this.cols * this.rows);
    const h = (c: number, r: number) => {
      const dx = Math.abs(c - goal[0]);
      const dz = Math.abs(r - goal[1]);
      return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    // 작은 격자라 단순 배열 기반 우선순위 큐로 충분하다
    const open: { i: number; f: number }[] = [];
    const s = idx(start[0], start[1]);
    g[s] = 0;
    open.push({ i: s, f: h(start[0], start[1]) });
    const goalI = idx(goal[0], goal[1]);
    while (open.length > 0) {
      let k = 0;
      for (let j = 1; j < open.length; j++)
        if ((open[j] as { f: number }).f < (open[k] as { f: number }).f) k = j;
      const { i } = open.splice(k, 1)[0] as { i: number };
      if (closed[i]) continue;
      closed[i] = 1;
      if (i === goalI) break;
      const c = i % this.cols;
      const r = (i - c) / this.cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dc === 0 && dr === 0) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (!this.walkable(nc, nr)) continue;
          if (dc !== 0 && dr !== 0 && (!this.walkable(c + dc, r) || !this.walkable(c, r + dr)))
            continue;
          const ni = idx(nc, nr);
          const cost = (g[i] as number) + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
          if (cost < (g[ni] as number)) {
            g[ni] = cost;
            came[ni] = i;
            open.push({ i: ni, f: cost + h(nc, nr) });
          }
        }
      }
    }
    if (came[goalI] === -1 && goalI !== s) return [];
    const cells: [number, number][] = [];
    for (let i = goalI; i !== -1; i = came[i] as number) {
      cells.push([i % this.cols, Math.floor(i / this.cols)]);
      if (i === s) break;
    }
    cells.reverse();
    // 줄 당기기: 보이는 가장 먼 칸으로 바로 간다
    const out: Point[] = [];
    let anchor = cells[0] as [number, number];
    for (let j = 1; j < cells.length; j++) {
      const next = cells[j + 1];
      if (!next || !this.lineClear(anchor, next)) {
        const cur = cells[j] as [number, number];
        out.push(this.toWorld(cur[0], cur[1]));
        anchor = cur;
      }
    }
    if (out.length === 0) out.push(this.toWorld(goal[0], goal[1]));
    return out;
  }
}
