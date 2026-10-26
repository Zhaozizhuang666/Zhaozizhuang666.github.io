# Cloudflare Workers AI binding

This adapter uses the official `env.AI.run(model, input)` binding. It does not need a Workers AI token in the browser or a second HTTP proxy. Existing API-key providers continue to work independently.

## Configuration

The checked-in Wrangler files add an `AI` binding and configure three verified text-chat models. They keep the existing GLM API provider as the default; adding the binding does not change the selected default.

```toml
[vars]
MODEL_PROVIDER = "cloudflare" # optional: make the binding the default provider
MODEL_NAME = "@cf/zai-org/glm-4.7-flash"
CLOUDFLARE_MODELS = '["@cf/zai-org/glm-4.7-flash","@cf/qwen/qwen3-30b-a3b-fp8","@cf/meta/llama-3.1-8b-instruct-fp8"]'

[ai]
binding = "AI"
```

`CLOUDFLARE_MODELS` is a JSON string containing an array of exact, unique model IDs. It must be nonempty, at most 40 items and 8 KiB. Every ID must exist in the code's verified `CLOUDFLARE_CHAT_MODELS` registry. A malformed list, an unknown/non-chat ID, or a missing `AI.run` binding makes the provider unavailable in `/api/models`; it does not silently activate another Cloudflare model. A client can only select a model that is in this deployment's configured subset. The UI already consumes `/api/models`, so the configured models appear as ordinary selectable choices.

The verified registry currently contains:

- `@cf/zai-org/glm-4.7-flash`: `messages`, `max_completion_tokens`, `stream: false`; reasoning is disabled using its documented `chat_template_kwargs.enable_thinking: false`, and `store: false` is explicit. Only final assistant text in `choices[0].message.content` is returned.
- `@cf/qwen/qwen3-30b-a3b-fp8`: `messages`, `max_tokens`, `stream: false`; final assistant text comes from `choices[0].message.content`. Its separate `reasoning_content` is never exposed.
- `@cf/meta/llama-3.1-8b-instruct-fp8`: `messages`, `max_tokens`, `stream: false`; final text comes from `response`. Tool-call results are rejected.
- `@cf/deepseek-ai/deepseek-v4.1-flash-1017`: `messages`, `max_completion_tokens`, `stream: false`, `reasoning_effort: "none"`, `store: false`; final assistant text comes from `choices[0].message.content`. This model's official page requires Workers Paid or eligible AI Gateway credits, so it is supported in code but omitted from the default deployment list. Confirm account access and budget before adding its ID to `CLOUDFLARE_MODELS`.

Configured availability is not proof of account entitlement or a successful live inference. Check `/api/models`, then run a text-only smoke request for each enabled model after deployment. All enabled models may consume Cloudflare's Workers AI allocation or billed usage; a binding is not a promise of unlimited free inference.

## Catalog review and updates

The full catalog is not a list of interchangeable chat models. It also includes embeddings, classification, translation, image and speech tasks; even the Text Generation category includes specialized decision/extraction models. Do not copy every catalog entry into the chat menu.

The official catalog endpoint is `GET /accounts/{account_id}/ai/models/search`, with a token holding Workers AI Read or Write permission. It supports `task`, `hide_experimental`, `include_deprecated`, `page` and `per_page` query parameters. Review the Text Generation candidates with experimental/deprecated models excluded, and follow pagination until the catalog is complete. Use the official model page and raw synchronous input/output schemas to verify each candidate's exact model ID, multi-turn `messages` support, token-limit option, final-text field, reasoning/tool behavior and account restrictions. Add a registry entry and contract tests before enabling it in the deployment allow-list. The runtime does not fetch or auto-enable the catalog during conversations.

Public official sources verified on 2026-10-26:

- [Workers AI binding and `AI.run`](https://developers.cloudflare.com/workers-ai/configuration/bindings/)
- [Model Search API](https://developers.cloudflare.com/api/resources/ai/subresources/models/methods/list/)
- [Workers AI model catalog](https://developers.cloudflare.com/workers-ai/models/)
- [GLM-4.7-Flash](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/)
- [Qwen3-30B-A3B FP8](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/)
- [Llama 3.1 8B Instruct FP8](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/)
- [DeepSeek V4.1 Flash 1017](https://developers.cloudflare.com/workers-ai/models/deepseek-v4.1-flash-1017/)

## Conversation and failure boundaries

The binding shares the existing Origin check, rate limiter, body/history/context bounds, retrieval evidence, token cap, timeout, answer-size limit and `no-store` response headers. Messages and evidence are assembled per request. This adapter does not store visitor conversations in Worker memory, KV or a database, and it does not add a provider-side session identifier. The existing limiter stores only an IP-derived quota key and counters. Provider data handling still follows Cloudflare's service terms.

Only text input is enabled through this route. The existing optional image URL request field remains exclusive to Ark. Client-supplied model options, tools, endpoints and credentials are not accepted. Empty or malformed output, reasoning-only output, tool calls, refusals, filtered endings and incomplete Chat Completions return a controlled error. A binding exception returns `provider_error`; a missed response deadline returns `provider_timeout`. Upstream diagnostics are not returned to visitors.

The binding receives an `AbortSignal` through its third argument; the response deadline aborts that signal and `Promise.race` bounds the HTTP response time. Cancellation is best effort: timed-out work may continue inside Workers AI and may still count toward usage. It cannot write a late reply into another conversation because the result and message arrays stay local to the original request.

Validation: `node --test tests/agent-api.test.mjs` uses injected fake bindings to exercise discovery, all four model contracts, invalid allow-lists and client choices, output validation, timeouts, rate limits and concurrent visitor isolation. It does not claim live model quality or account entitlement validation.
