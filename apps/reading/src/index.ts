import { WorkerEntrypoint } from "cloudflare:workers";
/**
 * reading Worker (docs/15 §6). app Worker가 Service Binding RPC로만 부른다.
 * M1: LLM_MODE=fixture만 지원. 실제 Haiku 호출(AI Gateway 경유)은 M2에서 docs/04 대로 붙인다.
 */
import type {
  InterpretInput,
  InterpretOutput,
  ProductId,
  ReadingService,
} from "@fortune/shared-types";

interface Env {
  LLM_MODE: "fixture" | "live";
}

/** 상품별 섹션 키 (docs/04 §4) */
const SECTIONS: Record<ProductId, string[]> = {
  daily: ["overall", "tip"],
  saju_full: [
    "overall",
    "personality",
    "elements",
    "yongsin",
    "daewoon",
    "thisYear",
    "love",
    "money",
    "work",
  ],
  tarot_one: ["card", "message"],
  tarot_three: ["past", "present", "future", "advice"],
  obanggi: ["flag", "message", "advice"],
  dream: ["symbols", "meaning", "advice"],
};

function fixture(input: InterpretInput): InterpretOutput {
  const sections = Object.fromEntries(
    SECTIONS[input.product].map((k) => [
      k,
      `[고정 응답] ${input.shop}/${input.product}의 ${k} 섹션`,
    ]),
  );
  return {
    greeting: "[고정 응답] 어서 오세요",
    summary: "[고정 응답] 개발용 결과입니다",
    sections,
    advice: "[고정 응답] 실제 풀이는 LLM_MODE=live에서 나옵니다",
  };
}

export default class Reading extends WorkerEntrypoint<Env> implements ReadingService {
  async interpret(input: InterpretInput): Promise<InterpretOutput> {
    if (this.env.LLM_MODE === "fixture") return fixture(input);
    throw new Error("LLM_MODE=live is implemented in M2 (docs/04)");
  }

  override async fetch(): Promise<Response> {
    return new Response("not found", { status: 404 });
  }
}
