/**
 * 프롬프트 md 파일(docs/04 §11)을 src/generated.ts 하나로 묶는다.
 * Worker(esbuild)와 Vitest가 md를 직접 읽지 않아도 되게 한다. md를 고치면 `pnpm --filter @fortune/prompts build`.
 * test/generated.test.ts가 생성본이 최신인지 확인한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8").trim();

export function render() {
  const dream = JSON.parse(
    readFileSync(join(root, "../fortune-engine/data/meanings/dream.json"), "utf8"),
  );
  const symbolLines = dream
    .map((s) => `${s.id}: ${s.name} (${s.synonyms.filter((w) => w !== s.name).join(", ")})`)
    .join("\n");
  const data = {
    common: { v: 6, text: read("common/v6.md") },
    persona: {
      saju: { v: 1, text: read("saju/persona.v1.md") },
      tarot: { v: 1, text: read("tarot/persona.v1.md") },
      dolyeong: { v: 3, text: read("dolyeong/persona.v3.md") },
      dream: { v: 1, text: read("dream/persona.v1.md") },
    },
    product: {
      daily: { v: 1, text: read("saju/daily.v1.md") },
      saju_full: { v: 1, text: read("saju/saju_full.v1.md") },
      tarot_one: { v: 1, text: read("tarot/tarot_one.v1.md") },
      tarot_three: { v: 2, text: read("tarot/tarot_three.v2.md") },
      obanggi: { v: 1, text: read("dolyeong/obanggi.v1.md") },
      dream: { v: 2, text: read("dream/dream.v2.md") },
      sinjeom: { v: 3, text: read("dolyeong/sinjeom.v3.md") },
    },
    followup: { v: 3, text: read("followup/v3.md") },
    // 아기도령 신점 대화 (F07, D-073)
    talk: { v: 3, text: read("dolyeong/talk.v3.md") },
    classify: {
      v: 2,
      text: `${read("classify/v2.md")}\n\n[상징 목록] ID: 이름 (동의어)\n${symbolLines}`,
    },
    symbolIds: dream.map((s) => s.id),
  };
  return `// 자동 생성 파일. 직접 고치지 말고 md를 고친 뒤 \`pnpm --filter @fortune/prompts build\` (scripts/build.mjs)
export const PROMPTS = ${JSON.stringify(data, null, 2)} as const;
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(root, "src/generated.ts"), render());
  console.log("src/generated.ts 생성");
}
