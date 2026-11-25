import { describe, expect, it } from "vitest";
import {
  FLAG_COLORS,
  MAJOR_ARCANA,
  drawTarot,
  dreamSeedKey,
  normalizeDream,
  pickFlag,
  rngFor,
  sajuSeedKey,
  sfc32,
  tarotSeedKey,
} from "../src/seed";

describe("PRNG", () => {
  it("같은 seed면 같은 수열", () => {
    const seed = new Uint8Array(32).map((_, i) => i * 7);
    const a = sfc32(seed);
    const b = sfc32(seed);
    const xs = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(xs);
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("사용자나 seed_key가 다르면 다른 수열", async () => {
    const a = (await rngFor("u1", "tarot:2026-11-25:tarot_one:연애"))();
    const b = (await rngFor("u2", "tarot:2026-11-25:tarot_one:연애"))();
    const c = (await rngFor("u1", "tarot:2026-11-25:tarot_one:재물"))();
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe("타로 뽑기", () => {
  it("같은 seed → 같은 카드 (고정값)", async () => {
    const key = tarotSeedKey("2026-11-25", "tarot_three", "연애");
    const first = drawTarot(await rngFor("user-a", key), "three");
    const again = drawTarot(await rngFor("user-a", key), "three");
    expect(again).toEqual(first);
    expect(first.map((c) => c.position)).toEqual(["과거", "현재", "미래"]);
    expect(new Set(first.map((c) => c.id)).size).toBe(3);
    for (const c of first) expect(c.id).toBeGreaterThanOrEqual(0);
    for (const c of first) expect(c.id).toBeLessThan(MAJOR_ARCANA);
  });

  it("한 장은 '오늘' 자리", async () => {
    const one = drawTarot(await rngFor("user-a", "k"), "one");
    expect(one).toHaveLength(1);
    expect(one[0]?.position).toBe("오늘");
  });

  it("역방향 비율이 약 25%, 22장이 고르게 나온다", async () => {
    let reversed = 0;
    let total = 0;
    const seen = new Map<number, number>();
    for (let i = 0; i < 2000; i++) {
      const cards = drawTarot(
        await rngFor(`user-${i}`, "tarot:2026-11-25:tarot_three:오늘"),
        "three",
      );
      for (const c of cards) {
        total++;
        if (c.reversed) reversed++;
        seen.set(c.id, (seen.get(c.id) ?? 0) + 1);
      }
    }
    expect(reversed / total).toBeGreaterThan(0.22);
    expect(reversed / total).toBeLessThan(0.28);
    expect(seen.size).toBe(MAJOR_ARCANA);
    for (const n of seen.values()) expect(n).toBeGreaterThan((total / MAJOR_ARCANA) * 0.7);
  });
});

describe("오방기", () => {
  it("같은 seed → 같은 깃발, 다섯 색이 모두 나온다", async () => {
    const key = "obanggi:2026-11-25:연애";
    expect(pickFlag(await rngFor("u", key))).toBe(pickFlag(await rngFor("u", key)));
    const colors = new Set<string>();
    for (let i = 0; i < 200; i++) colors.add(pickFlag(await rngFor(`u${i}`, key)));
    expect([...colors].sort()).toEqual([...FLAG_COLORS].sort());
  });
});

describe("seed_key", () => {
  it("사주 정밀은 프로필 버전 + 연도", () => {
    expect(sajuSeedKey(3, 2026)).toBe("saju:v3:3:2026");
  });

  it("꿈 정규화: 공백·문장부호를 정리한다", () => {
    expect(normalizeDream("  돼지를   안았어요!!  \n 그리고… 물이 맑았다. ")).toBe(
      "돼지를 안았어요 그리고 물이 맑았다",
    );
  });

  it("공백·문장부호만 다른 꿈은 같은 seed, 날짜가 다르면 다른 seed", async () => {
    const a = await dreamSeedKey("2026-11-25", "돼지를 안았어요.");
    const b = await dreamSeedKey("2026-11-25", "  돼지를  안았어요!!");
    const c = await dreamSeedKey("2026-11-26", "돼지를 안았어요.");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^dream:2026-11-25:[0-9a-f]{64}$/);
  });
});
