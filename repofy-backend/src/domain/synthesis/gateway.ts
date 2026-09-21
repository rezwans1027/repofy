import { z } from "zod";
import { NarrativeSelectionSchema } from "@repofy/contracts";
import { MODEL, NARRATIVE_POLICY as P, PROMPT, SynthesisError, type ModelOutcome } from "./policy";
import type { PreparedNarrative } from "./narrative";

// Emit the documented enum/object subset, without a JSON-Schema dialect declaration.
function providerSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "$schema")
    .map(([key,item]) => key === "const" ? ["enum",[item]] : [key,providerSchema(item)]));
  return value;
}
const selectionSchema = providerSchema(z.toJSONSchema(NarrativeSelectionSchema, { target: "draft-7" }));

const responseSchema = z.object({ status: z.enum(["completed", "incomplete", "failed"]), model: z.literal(MODEL.version),
  usage: z.object({ input_tokens: z.number().int().min(0).max(80000), output_tokens: z.number().int().min(0).max(P.maxOutputTokens) }),
  output: z.array(z.object({ type: z.string(), role: z.string().optional(), status: z.string().optional(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional() })).max(4) });
export interface ModelGateway { generate(input: PreparedNarrative["input"], signal: AbortSignal): Promise<{ selection: unknown; usage: ModelOutcome }> }
/** Fixed provider host, no redirects/tools/conversations, bounded streaming read and total deadline. */
export class OpenAIResponsesGateway implements ModelGateway {
  constructor(private readonly apiKey: string, private readonly request: typeof fetch = fetch, private readonly timeoutMs = P.timeoutMs) {}
  async generate(input: PreparedNarrative["input"], signal: AbortSignal) {
    const started = performance.now();
    const usage: ModelOutcome = { code: "valid", inputTokens: null, outputTokens: null, latencyMs: 0 };
    const fail = (code: ModelOutcome["code"]): never => { throw new SynthesisError(code, { ...usage, code, latencyMs: Math.min(60000,Math.round(performance.now()-started)) }); };
    const controller = new AbortController(), abort = () => controller.abort();
    const timer = setTimeout(abort,this.timeoutMs); signal.addEventListener("abort",abort,{ once: true });
    try {
      signal.throwIfAborted();
      const body = JSON.stringify({ model: MODEL.version, store: false, background: false, tools: [], max_output_tokens: P.maxOutputTokens,
        input: [{ role: "developer", content: PROMPT }, { role: "user", content: JSON.stringify(input) }],
        text: { format: { type: "json_schema", name: "readiness_selection_v1", strict: true,
          schema: selectionSchema } } });
      if (Buffer.byteLength(body) > P.maxInputBytes + 8192) fail("response_limit");
      const response = await this.request("https://api.openai.com/v1/responses", { method: "POST", redirect: "error", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` }, body });
      usage.providerStatus = response.status;
      if (!response.ok) {
        await response.body?.cancel();
        // Only explicit 429 is retryable. Transport errors and 5xx can have an unknown paid outcome.
        fail(response.status === 429 ? "provider_rate_limit" : [400,401,403,404,413,422].includes(response.status) ? "provider_rejected" : "outcome_unknown");
      }
      if (!response.body) fail("provider_malformed");
      const reader = response.body!.getReader(); let size = 0; const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const next = await reader.read(); if (next.done) break;
          size += next.value.byteLength;
          if (size > P.maxResponseBytes) { await reader.cancel(); fail("response_limit"); }
          chunks.push(next.value);
        }
      } finally { reader.releaseLock(); }
      let raw: unknown;
      try { raw = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { fail("provider_malformed"); }
      const parsed = responseSchema.safeParse(raw); if (!parsed.success) fail("provider_malformed");
      const result = parsed.data!;
      usage.inputTokens = result.usage.input_tokens; usage.outputTokens = result.usage.output_tokens;
      if (result.status !== "completed") fail("provider_incomplete");
      if (result.output.some(o => o.content?.some(c => c.type === "refusal"))) fail("provider_refusal");
      if (result.output.length !== 1 || result.output[0].type !== "message" || result.output[0].role !== "assistant" || result.output[0].status !== "completed" ||
        result.output[0].content?.length !== 1 || result.output[0].content[0].type !== "output_text") fail("provider_malformed");
      let selection: unknown;
      try { selection = JSON.parse(result.output[0].content![0].text!); } catch { fail("provider_malformed"); }
      return { selection, usage: { ...usage, latencyMs: Math.min(60000,Math.round(performance.now()-started)) } };
    } catch (error) {
      if (error instanceof SynthesisError) throw error;
      return fail("outcome_unknown"); // Never retain or log a provider exception/body/URL/key.
    } finally { clearTimeout(timer); signal.removeEventListener("abort",abort); }
  }
}
