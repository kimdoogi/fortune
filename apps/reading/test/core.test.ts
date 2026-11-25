import Anthropic from "@anthropic-ai/sdk";
import type { InterpretInput } from "@fortune/shared-types";
import { describe, expect, it } from "vitest";
import { classifyWith, followupWith, interpretWith } from "../src/core";

/** messages.create만 흉내 낸 가짜 클라이언트. 응답(또는 던질 오류)을 차례로 돌려준다 */
function fakeClient(steps: (unknown | Error)[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    messages: {
      create: async (body: Record<string, unknown>) => {
        calls.push(body);
        const step = steps.shift();
        if (step instanceof Error) throw step;
        return step;
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

const usage = {
  input_tokens: 10,
  output_tokens: 20,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
};
const msg = (text: string, stop = "end_turn") => ({
  stop_reason: stop,
  stop_details: null,
  content: [
    { type: "thinking", thinking: "" },
    { type: "text", text },
  ],
  usage,
});

const goodOutput = JSON.stringify({
  greeting: "어서 와요, 별빛 님.",
  summary: "작은 용기가 길을 여는 날이에요",
  sections: { card: "가".repeat(200), message: "나".repeat(130) },
  advice: "오늘은 스스로를 칭찬해 줘요.",
});

const input: InterpretInput = {
  shop: "tarot",
  product: "tarot_one",
  today: "2026-11-25",
  user: { nickname: "별빛", gender: "female", ageBand: "20대" },
  facts: ["별: 희망"],
  question: null,
};

const quiet = { log: () => {}, sleep: async () => {} };
const rateLimit = () => new Anthropic.RateLimitError(429, undefined, "rate limited", new Headers());

describe("해석 실패 처리 (docs/04 §9)", () => {
  it("정상 응답은 thinking 블록을 건너뛰고 text를 읽는다", async () => {
    const { client, calls } = fakeClient([msg(goodOutput)]);
    const r = await interpretWith(client, input, quiet);
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1);
    // temperature·prefill 없이, 캐시되는 시스템 프롬프트 + 구조화 출력
    expect(calls[0]).not.toHaveProperty("temperature");
    expect(calls[0]?.system).toMatchObject([{ cache_control: { type: "ephemeral" } }]);
    expect(calls[0]?.output_config).toMatchObject({
      effort: "low",
      format: { type: "json_schema" },
    });
  });

  it("JSON이 깨지면 1회 다시 부른다", async () => {
    const { client, calls } = fakeClient([msg("{not json"), msg(goodOutput)]);
    expect((await interpretWith(client, input, quiet)).ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("429는 1회 재시도, 또 실패하면 점집 말투 대체 문장", async () => {
    const ok = fakeClient([rateLimit(), msg(goodOutput)]);
    expect((await interpretWith(ok.client, input, quiet)).ok).toBe(true);
    const bad = fakeClient([rateLimit(), rateLimit()]);
    const r = await interpretWith(bad.client, input, quiet);
    expect(r).toMatchObject({ ok: false, reason: "api_error" });
    if (!r.ok) expect(r.fallback).toContain("카드가 오늘은 수줍어하네요");
    expect(bad.calls).toHaveLength(2);
  });

  it("거절은 재시도하지 않는다", async () => {
    const { client, calls } = fakeClient([msg("", "refusal")]);
    expect(await interpretWith(client, input, quiet)).toMatchObject({
      ok: false,
      reason: "refusal",
    });
    expect(calls).toHaveLength(1);
  });

  it("잘리면 max_tokens를 1.5배로 1회 재시도", async () => {
    const { client, calls } = fakeClient([msg("", "max_tokens"), msg(goodOutput)]);
    expect((await interpretWith(client, input, quiet)).ok).toBe(true);
    expect(calls[1]?.max_tokens).toBe(Math.round((calls[0]?.max_tokens as number) * 1.5));
  });

  it("금지 표현이 나오면 1회 다시 쓰고, 또 나오면 대체 문장 (D-084)", async () => {
    const banned = JSON.stringify({ ...JSON.parse(goodOutput), advice: "부적을 꼭 사세요" });
    const twice = fakeClient([msg(banned), msg(banned)]);
    expect(await interpretWith(twice.client, input, quiet)).toMatchObject({
      ok: false,
      reason: "banned",
    });
    expect(twice.calls).toHaveLength(2);
    const once = fakeClient([msg(banned), msg(goodOutput)]);
    expect(await interpretWith(once.client, input, quiet)).toMatchObject({ ok: true });
  });
});

describe("사주 정밀은 나눠서 동시에 부른다 (04 §2, D-084)", () => {
  const sajuInput: InterpretInput = { ...input, shop: "saju", product: "saju_full" };
  const head = JSON.stringify({
    greeting: "어서 오시오.",
    summary: "곧은 나무 같은 그대",
    sections: { overall: "가".repeat(300), thisYear: "나".repeat(260), months: "다".repeat(450) },
    advice: "적금부터 정하시오.",
    luckyColor: "파란색",
  });
  const tail = JSON.stringify({
    sections: {
      money: "라".repeat(170),
      work: "마".repeat(170),
      love: "바".repeat(170),
      daewoon: "사".repeat(180),
      personality: "아".repeat(180),
      elements: "자".repeat(150),
      yongsin: "차".repeat(150),
    },
  });

  it("두 부분을 따로 부르고 합친다. 시스템 프롬프트는 같아 캐시가 탄다", async () => {
    const { client, calls } = fakeClient([msg(head), msg(tail)]);
    const r = await interpretWith(client, sajuInput, quiet);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.output.sections)).toHaveLength(10);
      expect(r.output.luckyColor).toBe("파란색");
      expect(r.output.greeting).toBe("어서 오시오.");
    }
    expect(calls).toHaveLength(2);
    expect(calls[0]?.system).toEqual(calls[1]?.system);
    const schemaKeys = (c: Record<string, unknown> | undefined) =>
      Object.keys(
        (
          c?.output_config as {
            format: { schema: { properties: { sections: { properties: object } } } };
          }
        ).format.schema.properties.sections.properties,
      );
    expect(schemaKeys(calls[0])).toEqual(["overall", "thisYear", "months"]);
    expect(schemaKeys(calls[1])).toContain("yongsin");
  });

  it("한 부분이라도 실패하면 대체 문장", async () => {
    const { client } = fakeClient([msg(head), msg("{"), msg("{")]);
    expect(await interpretWith(client, sajuInput, quiet)).toMatchObject({
      ok: false,
      fallback: expect.stringContaining("사주"),
    });
  });
});

describe("분류 (docs/04 §6)", () => {
  it("사전에 없는 상징은 버리고 5개까지만", async () => {
    const out = JSON.stringify({
      category: "기타",
      risk: "none",
      symbols: ["pig", "unknown_x", "pig", "snake", "water", "fire", "dog", "cat"],
    });
    const { client } = fakeClient([msg(out)]);
    const r = await classifyWith(client, { kind: "dream", text: "돼지 꿈" }, quiet);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.symbols).not.toContain("unknown_x");
      expect(new Set(r.symbols).size).toBe(r.symbols.length);
      expect(r.symbols.length).toBeLessThanOrEqual(5);
    }
  });

  it("질문 분류는 상징을 고르지 않는다", async () => {
    const { client } = fakeClient([
      msg(JSON.stringify({ category: "건강", risk: "medical", symbols: [] })),
    ]);
    expect(
      await classifyWith(client, { kind: "question", text: "허리가 아파요" }, quiet),
    ).toMatchObject({
      ok: true,
      risk: "medical",
      symbols: [],
    });
  });
});

describe("이어 묻기 (F15, docs/04 §13)", () => {
  const originalInput = JSON.stringify(input);
  const originalOutput = goodOutput;
  const answer1 = JSON.stringify({ risk: "none", answer: "가".repeat(200) });

  it("원래 풀이 → 앞선 문답 → 새 질문 순서로 보내고, 대화 캐시를 켠다", async () => {
    const { client, calls } = fakeClient([msg(answer1)]);
    const r = await followupWith(
      client,
      {
        shop: "tarot",
        product: "tarot_three",
        originalInput,
        originalOutput,
        history: [],
        question: "그 사람이 연락할까요?",
      },
      quiet,
    );
    expect(r).toMatchObject({ ok: true, risk: "none", answerJson: answer1 });
    expect(calls[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(calls[0]?.messages).toEqual([
      { role: "user", content: originalInput },
      { role: "assistant", content: originalOutput },
      {
        role: "user",
        content: JSON.stringify({ question: "그 사람이 연락할까요?", turn: 1, of: 3 }),
      },
    ]);
  });

  it("두 번째 이어 묻기의 앞부분은 첫 번째 요청과 바이트가 같다 (캐시가 탄다)", async () => {
    const first = fakeClient([msg(answer1)]);
    const r1 = await followupWith(
      first.client,
      {
        shop: "tarot",
        product: "tarot_three",
        originalInput,
        originalOutput,
        history: [],
        question: "Q1",
      },
      quiet,
    );
    if (!r1.ok) throw new Error("first failed");
    const second = fakeClient([msg(answer1)]);
    await followupWith(
      second.client,
      {
        shop: "tarot",
        product: "tarot_three",
        originalInput,
        originalOutput,
        history: [{ question: "Q1", answerJson: r1.answerJson }],
        question: "Q2",
      },
      quiet,
    );
    const m1 = first.calls[0]?.messages as unknown[];
    const m2 = second.calls[0]?.messages as unknown[];
    expect(JSON.stringify(m2.slice(0, m1.length))).toBe(JSON.stringify(m1));
    expect(second.calls[0]?.system).toEqual(first.calls[0]?.system);
    expect(second.calls[0]?.output_config).toEqual(first.calls[0]?.output_config);
  });

  it("같이 본 풀이는 물은 사람을 붙이고 두 사람 몫으로 센다 (D-091)", async () => {
    const { client, calls } = fakeClient([msg(answer1)]);
    await followupWith(
      client,
      {
        shop: "tarot",
        product: "tarot_pair",
        originalInput,
        originalOutput,
        history: [{ question: "Q1", answerJson: answer1, asker: "하나" }],
        question: "Q2",
        asker: "준호",
      },
      quiet,
    );
    const m = calls[0]?.messages as { content: unknown }[];
    expect(m[2]?.content).toBe(JSON.stringify({ question: "Q1", asker: "하나", turn: 1, of: 6 }));
    expect(m[4]?.content).toBe(JSON.stringify({ question: "Q2", asker: "준호", turn: 2, of: 6 }));
  });

  it("위기 신호면 답을 버린다", async () => {
    const { client } = fakeClient([msg(JSON.stringify({ risk: "self_harm", answer: "..." }))]);
    expect(
      await followupWith(
        client,
        {
          shop: "dream",
          product: "dream",
          originalInput,
          originalOutput,
          history: [],
          question: "q",
        },
        quiet,
      ),
    ).toMatchObject({ ok: true, risk: "self_harm", answer: "" });
  });

  it("실패하면 점집 말투 대체 문장", async () => {
    const { client } = fakeClient([rateLimit(), rateLimit()]);
    const r = await followupWith(
      client,
      {
        shop: "saju",
        product: "saju_full",
        originalInput,
        originalOutput,
        history: [],
        question: "q",
      },
      quiet,
    );
    expect(r).toMatchObject({ ok: false, reason: "api_error" });
    if (!r.ok) expect(r.fallback).toContain("구름에 가려");
  });
});
