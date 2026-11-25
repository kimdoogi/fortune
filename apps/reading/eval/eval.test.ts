/**
 * LLM 기준 샘플 평가 (docs/04 §12). 실제 Haiku를 부르므로 돈이 든다 (30건 약 $0.1 미만).
 * 입력은 app Worker의 실제 입력 생성 코드(planReading, dailyInput)로 만들고,
 * 호출·재시도·검사는 reading Worker의 core를 그대로 쓴다. 게이트웨이 없이 Anthropic API로 직접 부른다.
 *
 *   ANTHROPIC_API_KEY=... EVAL_EFFORT=low pnpm --filter @fortune/reading eval
 *
 * 결과: apps/reading/eval/reports/<시각>-<effort>.md (자동 검사 + 사람이 읽을 풀이 원문)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { ClassifyResult, InterpretInput, InterpretResult } from "@fortune/shared-types";
import { describe, expect, it } from "vitest";
import { SECTION_TARGETS } from "../../../packages/prompts/src/llm";
import { dailyInput } from "../../api/src/daily";
import { planReading } from "../../api/src/readings/build";
import { classifyWith, interpretWith } from "../src/core";
import { CLASSIFY_SAMPLES, DREAM_SAMPLES, PROFILES, TODAY, interpretSamples } from "./samples";

const key = process.env.ANTHROPIC_API_KEY;
const effort = (process.env.EVAL_EFFORT ?? "low") as "low" | "medium" | "high";

interface Row {
  id: string;
  input: InterpretInput;
  result: InterpretResult;
  ms: number;
  tokens: { in: number; out: number; cacheRead: number };
  warnings: string[];
}

describe.skipIf(!key)(`LLM 평가 (effort ${effort})`, () => {
  const client = new Anthropic({ apiKey: key, maxRetries: 0 });
  const rows: Row[] = [];
  const classRows: { name: string; expect: string; got: ClassifyResult; pass: boolean }[] = [];

  it("해석 샘플 28건", { timeout: 600_000 }, async () => {
    const inputs = await interpretSamples(planReading, dailyInput);
    for (const { id, input } of inputs) {
      const t0 = Date.now();
      const tokens = { in: 0, out: 0, cacheRead: 0 };
      const warnings: string[] = [];
      const result = await interpretWith(client, input, {
        effort,
        log: (f) => {
          tokens.in += Number(f.in ?? 0);
          tokens.out += Number(f.out ?? 0);
          tokens.cacheRead += Number(f.cacheRead ?? 0);
          if (Array.isArray(f.detail)) warnings.push(...(f.detail as string[]));
        },
      });
      rows.push({ id, input, result, ms: Date.now() - t0, tokens, warnings });
    }
    expect(rows.length).toBe(28);
  });

  it("분류 샘플", { timeout: 120_000 }, async () => {
    for (const s of CLASSIFY_SAMPLES) {
      const got = await classifyWith(
        client,
        { kind: s.kind, text: s.text },
        { effort, log: () => {} },
      );
      const pass =
        got.ok && got.risk === s.risk && (s.symbol ? got.symbols.includes(s.symbol) : true);
      classRows.push({
        name: s.name,
        expect: `${s.risk}${s.symbol ? ` / ${s.symbol}` : ""}`,
        got,
        pass,
      });
    }
  });

  it("보고서 작성 + 통과 기준", () => {
    const ok = rows.filter((r) => r.result.ok).length;
    const totalTok = rows.reduce((a, r) => a + r.tokens.in + r.tokens.out, 0);
    // Haiku 5.5: 입력 $0.10 / 출력 $0.50 (100만 토큰당, 04 §1). 캐시 읽기는 입력의 0.1배
    const cost = rows.reduce(
      (a, r) =>
        a +
        ((r.tokens.in - r.tokens.cacheRead) * 0.1 +
          r.tokens.cacheRead * 0.01 +
          r.tokens.out * 0.5) /
          1e6,
      0,
    );
    const lines: string[] = [
      `# LLM 평가 — effort ${effort}, ${new Date().toISOString()}`,
      "",
      `- 해석: ${ok}/${rows.length} 성공 (스키마·금지 표현 통과)`,
      `- 분류: ${classRows.filter((c) => c.pass).length}/${classRows.length} 기대값 일치`,
      `- 길이 경고(목표의 50~160% 밖): ${rows.reduce((a, r) => a + r.warnings.length, 0)}건`,
      `- 평균 지연: ${Math.round(rows.reduce((a, r) => a + r.ms, 0) / Math.max(1, rows.length))}ms, 토큰 합계 ${totalTok}, 추정 비용 $${cost.toFixed(4)}`,
      "",
      "사람이 볼 것 (04 §12): 말투가 캐릭터와 맞는가, facts에 없는 뜻을 지어냈는가, 안전 규칙.",
      "",
      "## 분류",
      "| 샘플 | 기대 | 결과 | 통과 |",
      "|---|---|---|---|",
      ...classRows.map(
        (c) =>
          `| ${c.name} | ${c.expect} | ${c.got.ok ? `${c.got.risk} / ${c.got.category} / ${c.got.symbols.join(",")}` : c.got.reason} | ${c.pass ? "✅" : "❌"} |`,
      ),
      "",
      "## 해석",
    ];
    for (const r of rows) {
      lines.push(
        `### ${r.id} (${r.ms}ms, in ${r.tokens.in} / out ${r.tokens.out} / cache ${r.tokens.cacheRead})`,
      );
      lines.push("", `facts: ${r.input.facts.join(" / ")}`, "");
      if (!r.result.ok) {
        lines.push(`**실패: ${r.result.reason}** → ${r.result.fallback}`, "");
        continue;
      }
      const o = r.result.output;
      lines.push(`> ${o.greeting}`, "", `**${o.summary}**`, "");
      for (const k of Object.keys(SECTION_TARGETS[r.input.product])) {
        lines.push(
          `- **${k}** (${[...(o.sections[k] ?? "")].length}/${SECTION_TARGETS[r.input.product][k]}자): ${o.sections[k]}`,
        );
      }
      lines.push("", `조언: ${o.advice}${o.luckyColor ? ` · 행운의 색 ${o.luckyColor}` : ""}`);
      if (r.warnings.length) lines.push("", `길이 경고: ${r.warnings.join(", ")}`);
      lines.push("");
    }
    const dir = join(__dirname, "reports");
    mkdirSync(dir, { recursive: true });
    const file = join(
      dir,
      `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}-${effort}.md`,
    );
    writeFileSync(file, `${lines.join("\n")}\n`);
    console.log(`보고서: ${file}`);

    // 통과 기준: 해석 성공률 90% 이상, 위험 글 분류(self_harm·investment)는 모두 맞아야 한다
    expect(ok / rows.length).toBeGreaterThanOrEqual(0.9);
    for (const c of classRows.filter((c) => !c.expect.startsWith("none")))
      expect(c.pass, c.name).toBe(true);
  });
});

// 키 없이도 샘플이 만들어지는지는 항상 확인한다 (입력 생성 코드가 바뀌어도 평가가 깨지지 않게)
describe("평가 샘플 구성", () => {
  it("해석 28건 + 분류 5건, 상품이 고르게 섞여 있다", async () => {
    const inputs = await interpretSamples(planReading, dailyInput);
    expect(inputs).toHaveLength(28);
    const by = (p: string) => inputs.filter((s) => s.input.product === p).length;
    expect(by("saju_full") + by("daily")).toBe(10);
    expect(by("tarot_one") + by("tarot_three")).toBe(6);
    expect(by("obanggi")).toBe(6);
    expect(by("dream")).toBe(DREAM_SAMPLES.length);
    expect(CLASSIFY_SAMPLES.length).toBe(5);
    expect(PROFILES.length).toBe(8);
    expect(TODAY).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 건강 카테고리는 caution 플래그가 들어간다 (F07)
    expect(inputs.some((s) => s.input.caution === true)).toBe(true);
    for (const s of inputs) expect(s.input.facts.length, s.id).toBeGreaterThan(0);
  });
});
