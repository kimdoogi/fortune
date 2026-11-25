import { ACCESSORIES, type AvatarStyle, HAIRS, OUTFITS, SPECIES } from "@fortune/shared-types";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { defaultStyle, parseAvatar } from "./avatar-parts";
import { type AgeBand, Chibi, type Gender } from "./chibi";
import { countMeshes } from "./rig";

/** 재질 색까지 넣은 모습 지문: 같은 자리·같은 모양·같은 색이면 같다 */
function fingerprint(c: Chibi): string[] {
  const out: string[] = [];
  c.root.updateMatrixWorld(true);
  c.root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.MeshLambertMaterial;
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    out.push(
      `${o.geometry.uuid}|${m.color.getHexString()}|${p
        .toArray()
        .map((v) => v.toFixed(3))
        .join(",")}`,
    );
  });
  return out.sort();
}

const genders: Gender[] = ["female", "male"];
const ages: AgeBand[] = ["10대", "20대", "30대", "40대 이상"];

describe("2등신 캐릭터 (07 §3 한도)", () => {
  for (const gender of genders) {
    for (const ageBand of ages) {
      it(`${gender} ${ageBand}: 3,000 삼각형 이하`, () => {
        expect(new Chibi({ gender, ageBand }).triangles()).toBeLessThanOrEqual(3000);
      });
      it(`${gender} ${ageBand}: 꾸미기 기본 값으로 그려도 예전 모습과 같다 (F17)`, () => {
        const plain = new Chibi({ gender, ageBand });
        const styled = new Chibi({ gender, ageBand, style: defaultStyle(gender, ageBand) });
        expect(fingerprint(styled)).toEqual(fingerprint(plain));
      });
    }
  }
});

describe("캐릭터 꾸미기 (F17, D-098): 모든 종족×머리×옷×장식", () => {
  // 합친 뒤 메시 수(드로우콜)의 기준: 기본 모습
  const base = countMeshes(new Chibi({ gender: "female", ageBand: "20대" }).compact().root);

  it("3,000 삼각형 이하, 합친 메시 수는 기본보다 늘지 않는다", () => {
    let worstTris = 0;
    let worstMeshes = 0;
    for (const species of SPECIES) {
      for (const hair of HAIRS) {
        for (const outfit of OUTFITS) {
          for (const acc of ACCESSORIES) {
            const style: AvatarStyle = {
              species,
              hair,
              outfit,
              acc,
              color: "pink",
              hairColor: "blonde",
              tone: 1,
            };
            const c = new Chibi({ gender: "male", ageBand: "30대", style });
            const tris = c.triangles();
            worstTris = Math.max(worstTris, tris);
            if (tris > 3000) throw new Error(`${JSON.stringify(style)}: ${tris} 삼각형`);
            c.compact();
            const meshes = countMeshes(c.root);
            worstMeshes = Math.max(worstMeshes, meshes);
            if (meshes > base) throw new Error(`${JSON.stringify(style)}: 메시 ${meshes}개`);
            c.dispose();
          }
        }
      }
    }
    expect(worstTris).toBeLessThanOrEqual(3000);
    expect(worstMeshes).toBeLessThanOrEqual(base);
  });

  it("외모 문자열: 예전 값은 꾸미기 없음, 코드가 있으면 그 모습", () => {
    expect(parseAvatar("male:30대")).toEqual({ gender: "male", ageBand: "30대", style: null });
    expect(parseAvatar("female:20대:fox.curly.hoodie.sky.beanie.silver.2").style).toEqual({
      species: "fox",
      hair: "curly",
      outfit: "hoodie",
      color: "sky",
      acc: "beanie",
      hairColor: "silver",
      tone: 2,
    });
    // 모르는 파츠(앞으로 생길 것)는 기본 모습
    expect(parseAvatar("female:20대:dragon.curly.hoodie.sky.beanie.silver.2").style).toBeNull();
    expect(parseAvatar("default")).toEqual({ gender: "female", ageBand: "20대", style: null });
  });
});
