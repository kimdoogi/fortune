/**
 * Haiku 호출 한 번 (docs/04 §2). 공식 SDK를 쓰고, SDK의 fetch를 AI Gateway 바인딩으로 돌린다 (docs/15 §6).
 * - 바인딩 경유라 게이트웨이 토큰이 필요 없다. 키는 게이트웨이 BYOK 또는 이 Worker의 secret.
 * - temperature·top_p·top_k·prefill은 보내지 않는다 (Haiku 5.5에서 400). 형식은 구조화 출력으로 맞춘다.
 */
import Anthropic from "@anthropic-ai/sdk";

export interface LlmEnv {
  AI: Ai;
  AI_GATEWAY_ID: string;
  /** 게이트웨이 BYOK를 쓰면 비워 둔다 */
  ANTHROPIC_API_KEY?: string;
  /** direct: 게이트웨이 없이 api.anthropic.com (로컬 확인용) */
  LLM_ROUTE?: "gateway" | "direct";
}

/** SDK 요청을 AI Gateway의 Anthropic 엔드포인트로 그대로 넘긴다 */
function gatewayFetch(env: LlmEnv): typeof fetch {
  return async (input, init) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      if (k === "x-api-key" && !env.ANTHROPIC_API_KEY) return; // BYOK: 게이트웨이가 키를 넣는다
      headers[k] = v;
    });
    return env.AI.gateway(env.AI_GATEWAY_ID).run(
      {
        provider: "anthropic",
        endpoint: url.pathname.replace(/^\//, ""),
        headers,
        query: JSON.parse(await req.text()),
      },
      { signal: req.signal },
    );
  };
}

export function makeClient(env: LlmEnv): Anthropic {
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY ?? "byok",
    fetch: env.LLM_ROUTE === "direct" ? undefined : gatewayFetch(env),
    maxRetries: 0, // 재시도 규칙은 docs/04 §9를 직접 따른다
  });
}

export interface CallSpec {
  system: string;
  /** 대화 전체. 한 번 묻는 호출은 user 하나 */
  messages: Anthropic.MessageParam[];
  /** 마지막 메시지에 캐시 중단점을 둔다 (이어 묻기: 다음 호출이 앞부분을 캐시에서 읽게, 04 §13) */
  cacheConversation?: boolean;
  schema: Record<string, unknown>;
  maxTokens: number;
  effort: "low" | "medium" | "high";
  timeoutMs: number;
}

export type CallOutcome =
  | { kind: "text"; text: string; usage: Anthropic.Usage }
  | { kind: "max_tokens" }
  | { kind: "refusal"; category: string | null }
  | { kind: "timeout" }
  | { kind: "retryable"; status: number | null }
  | { kind: "fatal"; status: number | null };

export async function callModel(
  client: Anthropic,
  model: string,
  spec: CallSpec,
): Promise<CallOutcome> {
  try {
    const res = await client.messages.create(
      {
        model,
        max_tokens: spec.maxTokens,
        // 점집·상품마다 고정이라 캐시한다 (04 §2)
        system: [{ type: "text", text: spec.system, cache_control: { type: "ephemeral" } }],
        messages: spec.messages,
        ...(spec.cacheConversation ? { cache_control: { type: "ephemeral" as const } } : {}),
        output_config: {
          effort: spec.effort,
          format: { type: "json_schema", schema: spec.schema },
        },
      },
      { timeout: spec.timeoutMs },
    );
    if (res.stop_reason === "refusal") {
      return { kind: "refusal", category: res.stop_details?.category ?? null };
    }
    if (res.stop_reason === "max_tokens") return { kind: "max_tokens" };
    // 앞에 thinking 블록이 올 수 있다. text 블록을 찾는다 (04 §2)
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return { kind: "fatal", status: null };
    return { kind: "text", text: text.text, usage: res.usage };
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionTimeoutError) return { kind: "timeout" };
    if (e instanceof Anthropic.RateLimitError) return { kind: "retryable", status: 429 };
    if (e instanceof Anthropic.InternalServerError) return { kind: "retryable", status: e.status };
    if (e instanceof Anthropic.APIConnectionError) return { kind: "retryable", status: null };
    if (e instanceof Anthropic.APIError) return { kind: "fatal", status: e.status ?? null };
    throw e;
  }
}
