import { describe, expect, it } from "vitest";
import { LIFE_THEMES, pickThemes } from "../src/readings/themes";

describe("생활 주제 (D-096)", () => {
  it("풀에서 서로 다른 두 개를 고른다", () => {
    for (let i = 0; i < 50; i++) {
      const t = pickThemes();
      expect(t).toHaveLength(2);
      expect(new Set(t).size).toBe(2);
      for (const x of t) expect(LIFE_THEMES).toContain(x);
    }
  });

  it("여러 번 고르면 고루 나온다", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) for (const x of pickThemes()) seen.add(x);
    expect(seen.size).toBe(LIFE_THEMES.length);
  });
});
