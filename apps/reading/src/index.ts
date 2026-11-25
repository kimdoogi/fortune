import { WorkerEntrypoint } from "cloudflare:workers";
/**
 * reading Worker (docs/15 §6). app Worker가 Service Binding RPC로만 부른다. DB·KV 바인딩 없음.
 * interpret: 코드가 계산한 결과를 캐릭터 말투로 풀이 (docs/04 §1)
 * classify: 꿈·질문 글의 위험 여부와 꿈 상징 고르기 (docs/04 §6)
 * 실패 처리는 docs/04 §9 (core.ts): 경우마다 최대 1회 재시도, 그다음 점집 말투 대체 문장.
 */
import type {
  ClassifyInput,
  ClassifyResult,
  FollowupInput,
  FollowupResult,
  InterpretInput,
  InterpretResult,
  ReadingService,
} from "@fortune/shared-types";
import { classifyWith, fixture, fixtureClassify, followupWith, interpretWith } from "./core";
import { type LlmEnv, makeClient } from "./llm";

interface Env extends LlmEnv {
  LLM_MODE: "fixture" | "live";
}

export default class Reading extends WorkerEntrypoint<Env> implements ReadingService {
  async interpret(input: InterpretInput): Promise<InterpretResult> {
    if (this.env.LLM_MODE === "fixture")
      return { ok: true, output: fixture(input), promptVersion: "fixture" };
    return interpretWith(makeClient(this.env), input);
  }

  async classify(input: ClassifyInput): Promise<ClassifyResult> {
    if (this.env.LLM_MODE === "fixture") return fixtureClassify(input);
    return classifyWith(makeClient(this.env), input);
  }

  async followup(input: FollowupInput): Promise<FollowupResult> {
    if (this.env.LLM_MODE === "fixture") {
      const answerJson = JSON.stringify({
        risk: "none",
        answer: `[고정 응답] ${input.question}에 대한 답`,
      });
      return {
        ok: true,
        risk: "none",
        answer: `[고정 응답] ${input.question}에 대한 답`,
        answerJson,
        promptVersion: "fixture",
      };
    }
    return followupWith(makeClient(this.env), input);
  }

  override async fetch(): Promise<Response> {
    return new Response("not found", { status: 404 });
  }
}
