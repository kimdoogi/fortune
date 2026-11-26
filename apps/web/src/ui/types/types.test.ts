import { describe, expect, it } from "vitest";
import { TYPES_60 } from "./typeData";

describe("60유형 캐릭터 그림 (D-102)", () => {
  it("유형마다 public/types/<id>.webp가 있다", () => {
    const files = Object.keys(import.meta.glob("../../../public/types/*.webp"));
    const have = new Set(files.map((f) => f.split("/").pop()?.replace(".webp", "")));
    expect(TYPES_60.filter((t) => !have.has(t))).toEqual([]);
  });
});
