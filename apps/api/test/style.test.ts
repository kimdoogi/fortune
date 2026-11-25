import { type AvatarStyle, avatarString, encodeStyle, parseStyle } from "@fortune/shared-types";
import { describe, expect, it } from "vitest";
import { StyleInputSchema, StyleSchema } from "../src/profile";

const CAT: AvatarStyle = {
  species: "cat",
  hair: "bob",
  outfit: "dress",
  color: "pink",
  acc: "ribbon",
  hairColor: "auto",
  tone: 0,
};

describe("캐릭터 꾸미기 (F17, D-098)", () => {
  it("코드 한 줄로 바꾸고 되돌린다", () => {
    expect(encodeStyle(CAT)).toBe("cat.bob.dress.pink.ribbon.auto.0");
    expect(parseStyle(encodeStyle(CAT))).toEqual(CAT);
  });

  it("모르는 값·칸 수가 다르면 기본 모습(null)", () => {
    expect(parseStyle(null)).toBeNull();
    expect(parseStyle("")).toBeNull();
    expect(parseStyle("dragon.bob.dress.pink.ribbon.auto.0")).toBeNull();
    expect(parseStyle("cat.bob.dress.pink.ribbon.auto.4")).toBeNull();
    expect(parseStyle("cat.bob.dress.pink.ribbon.auto")).toBeNull();
    expect(parseStyle("cat.bob.dress.pink.ribbon.auto.0.x")).toBeNull();
    expect(parseStyle("cat.bob.dress.pink.ribbon.auto.-1")).toBeNull();
  });

  it("외모 문자열: 꾸미기가 없으면 예전과 같은 성별:나이대", () => {
    expect(avatarString("female", "20대", null)).toBe("female:20대");
    expect(avatarString("male", "30대", CAT)).toBe("male:30대:cat.bob.dress.pink.ribbon.auto.0");
  });

  it("zod: 목록에 있는 값만 받는다", () => {
    expect(StyleSchema.safeParse(CAT).success).toBe(true);
    expect(StyleInputSchema.safeParse({ style: null }).success).toBe(true);
    expect(StyleSchema.safeParse({ ...CAT, species: "dragon" }).success).toBe(false);
    expect(StyleSchema.safeParse({ ...CAT, tone: 4 }).success).toBe(false);
    expect(StyleSchema.safeParse({ ...CAT, tone: 1.5 }).success).toBe(false);
    expect(StyleSchema.safeParse({ ...CAT, color: "#ff0000" }).success).toBe(false);
    expect(StyleInputSchema.safeParse({}).success).toBe(false);
  });
});
