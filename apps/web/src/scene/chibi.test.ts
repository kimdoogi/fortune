import { describe, expect, it } from "vitest";
import { type AgeBand, Chibi, type Gender } from "./chibi";

describe("2등신 캐릭터 (07 §3 한도)", () => {
  const genders: Gender[] = ["female", "male"];
  const ages: AgeBand[] = ["10대", "20대", "30대", "40대 이상"];
  for (const gender of genders) {
    for (const ageBand of ages) {
      it(`${gender} ${ageBand}: 3,000 삼각형 이하`, () => {
        expect(new Chibi({ gender, ageBand }).triangles()).toBeLessThanOrEqual(3000);
      });
    }
  }
});
