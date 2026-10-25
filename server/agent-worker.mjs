import { buildSystemPrompt } from './system-prompt.mjs';
import { retrieveKnowledge, buildEvidenceMessage } from './knowledge.mjs';

export const LIMITS = Object.freeze({bodyBytes: 49152, contextBytes: 16384, messages: 20, messageChars: 6000, conversationChars: 18000, responseBytes: 262144, answerChars: 24000, maxTokens: 4096});

// URLs and model names are owned by the server, never supplied by the browser.
export const PROVIDERS = Object.freeze({
  deepseek: {label: 'DeepSeek', key: 'DEEPSEEK_API_KEY', endpoint: 'https://api.deepseek.com/chat/completions', models: ['deepseek-flash', 'deepseek-v4-pro']},
  qwen: {label: 'Qwen · 通义千问', key: 'DASHSCOPE_API_KEY', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', models: ['qwen-plus']},
  kimi: {label: 'Kimi · 月之暗面', key: 'MOONSHOT_API_KEY', endpoint: 'https://api.moonshot.cn/v1/chat/completions', models: ['kimi-k3.1-pro']},
  glm: {label: 'GLM · 智谱', key: 'ZHIPU_API_KEY', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', models: ['glm-4.7-flash', 'glm-5.3']},
});
const CUSTOM_PROVIDER_ID = 'custom';
const ENV_NAME = /^[A-Z][A-Z0-9_]{2,63}$/;
const PROVIDER_ID = /^[a-z][a-z0-9_-]{1,63}$/;
const MODEL_ID = /^[\w:.@/+\-]{1,160}$/;
const GEMINI_MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
const PROTOCOLS = new Set(['openai-compatible', 'anthropic-messages', 'gemini-generate-content']);

class APIError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new APIError(status, code, message); };
const byteLength = value => new TextEncoder().encode(value).byteLength;
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

export function parseAllowedOrigins(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  const origins = value.split(',').map(origin => origin.trim());
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { return []; }
    if (origin !== url.origin || url.username || url.password || !['https:', 'http:'].includes(url.protocol)) return [];
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return [];
  }
  return [...new Set(origins)];
}

function validSecret(value) {
  return typeof value === 'string' && value.trim().length >= 8 && !/[\r\n]/.test(value) && !/^(replace|your[-_ ]|placeholder|example|<)/i.test(value.trim());
}

function safeProviderUrl(value, protocol) {
  if (typeof value !== 'string' || value.length > 500) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  // DNS names only: reject every IP literal, local/single-label and reserved host.
  if (!hostname.includes('.') || hostname.includes(':') || /^[\d.]+$/.test(hostname) || !/^[a-z0-9.-]+$/.test(hostname)) return null;
  if (['localhost', 'local', 'internal', 'lan', 'home', 'invalid', 'test', 'onion'].some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))) return null;
  if (hostname.endsWith('.') || hostname.split('.').some(label => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) return null;
  const pathname = url.pathname.replace(/\/+$/, '');
  if (protocol === 'gemini-generate-content') {
    // Model routing is built from the server allow-list, never a URL template.
    if (pathname.includes('/models/') || pathname.includes(':')) return null;
    return `${url.origin}${pathname}`;
  }
  const suffix = protocol === 'anthropic-messages' ? '/messages' : '/chat/completions';
  return `${url.origin}${pathname.endsWith(suffix) ? pathname : `${pathname}${suffix}`}`;
}

function normalizeCustomDefinition(raw) {
  if (!plainObject(raw) || typeof raw.id !== 'string' || !PROVIDER_ID.test(raw.id) || Object.hasOwn(PROVIDERS, raw.id)) return null;
  if (['constructor', 'prototype'].includes(raw.id) || Object.keys(raw).some(key => !['id', 'label', 'baseUrl', 'endpoint', 'secretEnv', 'models', 'protocol'].includes(key))) return null;
  if (raw.baseUrl !== undefined && raw.endpoint !== undefined) return null;
  if (typeof raw.label !== 'string' || !raw.label.trim() || raw.label.length > 100 || /[\u0000-\u001f]/.test(raw.label)) return null;
  const protocol = raw.protocol ?? 'openai-compatible';
  if (!PROTOCOLS.has(protocol)) return null;
  const endpoint = safeProviderUrl(raw.baseUrl ?? raw.endpoint, protocol);
  if (!endpoint || typeof raw.secretEnv !== 'string' || !ENV_NAME.test(raw.secretEnv)) return null;
  if (!Array.isArray(raw.models) || raw.models.length < 1 || raw.models.length > 40) return null;
  const modelPattern = protocol === 'gemini-generate-content' ? GEMINI_MODEL_ID : MODEL_ID;
  const models = [...new Set(raw.models.map(model => typeof model === 'string' ? model.trim() : '').filter(model => modelPattern.test(model)))];
  if (models.length !== raw.models.length) return null;
  return {id: raw.id, label: raw.label.trim(), key: raw.secretEnv, endpoint, models, protocol, custom: true};
}

/** Parse only server-owned configuration; never accepts a request field. */
export function parseCustomProviders(env = {}) {
  const definitions = [];
  const rawRegistry = env.MODEL_PROVIDERS_JSON;
  if (typeof rawRegistry === 'string' && rawRegistry && byteLength(rawRegistry) <= 16384) {
    try {
      const parsed = JSON.parse(rawRegistry);
      const rows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.providers) ? parsed.providers : [];
      for (const row of rows.slice(0, 8)) {
        const definition = normalizeCustomDefinition(row);
        if (definition && !definitions.some(existing => existing.id === definition.id)) definitions.push(definition);
      }
    } catch { /* malformed custom registry is ignored and cannot create a route */ }
  }
  const customBase = env.CUSTOM_BASE_URL;
  const customModel = env.CUSTOM_MODEL;
  const customKey = env.CUSTOM_API_KEY;
  const customLabel = env.CUSTOM_LABEL || 'Custom OpenAI-compatible';
  if (customBase !== undefined || customModel !== undefined || customKey !== undefined) {
    const definition = normalizeCustomDefinition({id: CUSTOM_PROVIDER_ID, label: customLabel, baseUrl: customBase, models: [customModel], secretEnv: 'CUSTOM_API_KEY'});
    if (definition && validSecret(customKey) && definitions.length < 8 && !definitions.some(existing => existing.id === definition.id)) definitions.push(definition);
  }
  return definitions;
}

function providerDefinitions(env) {
  return {...PROVIDERS, ...Object.fromEntries(parseCustomProviders(env).map(provider => [provider.id, provider]))};
}

export function configuredModels(env) {
  const definitions = providerDefinitions(env);
  const providers = Object.entries(definitions).filter(([, provider]) => validSecret(env[provider.key])).map(([id, provider]) => ({id, label: provider.label, models: provider.models.map(model => ({id: model, label: model}))}));
  const desired = providers.find(provider => provider.id === env.MODEL_PROVIDER) || providers[0];
  const model = desired?.models.find(model => model.id === env.MODEL_NAME)?.id || desired?.models[0].id;
  return {providers, default: desired ? {provider: desired.id, model} : null};
}

export function validatePayload(payload, knownProviders = PROVIDERS) {
  if (!plainObject(payload)) fail(400, 'invalid_payload', '请求必须是 JSON 对象。');
  const allowedFields = new Set(['messages', 'provider', 'model', 'mode', 'context']);
  if (Object.keys(payload).some(key => !allowedFields.has(key))) fail(400, 'invalid_payload', '请求包含不支持的字段。');
  if (!Array.isArray(payload.messages) || payload.messages.length < 1 || payload.messages.length > LIMITS.messages) fail(400, 'invalid_messages', `对话需包含 1–${LIMITS.messages} 条消息。`);
  let total = 0;
  const messages = payload.messages.map(message => {
    if (!plainObject(message) || Object.keys(message).some(key => !['role', 'content'].includes(key)) || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') fail(400, 'invalid_message', '消息只允许 user/assistant 角色及纯文本 content。');
    const content = message.content.trim();
    if (!content || content.length > LIMITS.messageChars || /\u0000/.test(content)) fail(400, 'invalid_message', `单条消息需为 1–${LIMITS.messageChars} 个字符的文本。`);
    total += content.length;
    return {role: message.role, content};
  });
  if (messages[0].role !== 'user' || messages.at(-1).role !== 'user') fail(400, 'invalid_messages', '对话首条和最后一条必须是用户消息。');
  if (total > LIMITS.conversationChars) fail(400, 'conversation_too_long', '对话过长，请开始新的讨论。');
  const mode = payload.mode ?? 'auto';
  if (!['auto', 'incubation', 'guide'].includes(mode)) fail(400, 'invalid_mode', '不支持的对话模式。');
  if (payload.provider !== undefined && (typeof payload.provider !== 'string' || !PROVIDER_ID.test(payload.provider) || !Object.hasOwn(knownProviders, payload.provider))) fail(400, 'invalid_provider', '不支持的模型服务。');
  if (payload.model !== undefined && (typeof payload.model !== 'string' || !MODEL_ID.test(payload.model))) fail(400, 'invalid_model', '不支持的模型。');
  let context;
  if (payload.context !== undefined) {
    if (!plainObject(payload.context)) fail(400, 'invalid_context', '资料 context 必须是对象。');
    const json = JSON.stringify(payload.context);
    if (byteLength(json) > LIMITS.contextBytes) fail(400, 'context_too_large', '参考资料过长，请减少资料数量。');
    let count = 0;
    function inspect(value, depth = 0) {
      if (depth > 6 || ++count > 500) fail(400, 'invalid_context', '参考资料层级或字段过多。');
      if (typeof value === 'string' && (value.length > 6000 || value.includes('\0'))) fail(400, 'invalid_context', '参考资料字段过长或包含无效字符。');
      if (Array.isArray(value)) value.forEach(item => inspect(item, depth + 1));
      else if (plainObject(value)) for (const [key, child] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key) || key.length > 80) fail(400, 'invalid_context', '参考资料字段无效。');
        inspect(child, depth + 1);
      }
    }
    inspect(payload.context);
    context = payload.context;
  }
  return {messages, mode, context, provider: payload.provider, model: payload.model};
}

export function resolveProvider(env, requestedProvider, requestedModel) {
  const listing = configuredModels(env);
  if (!listing.default) fail(503, 'model_not_configured', '联网模型尚未配置，请使用本地知识库模式。');
  const id = requestedProvider || listing.default.provider;
  const definition = providerDefinitions(env)[id];
  if (!definition) fail(400, 'invalid_provider', '不支持的模型服务。');
  if (!validSecret(env[definition.key])) fail(503, 'provider_not_configured', '所选模型服务尚未配置，请切换其他模型或使用本地知识库。');
  const model = requestedModel || (id === listing.default.provider ? listing.default.model : definition.models[0]);
  if (!definition.models.includes(model)) fail(400, 'invalid_model', '模型不在服务端允许列表中。');
  let endpoint = definition.endpoint;
  if (id === 'qwen' && env.DASHSCOPE_WORKSPACE_ID) {
    if (!/^[A-Za-z0-9-]{1,80}$/.test(env.DASHSCOPE_WORKSPACE_ID)) fail(503, 'invalid_configuration', '模型服务配置需要维护者检查。');
    endpoint = `https://${env.DASHSCOPE_WORKSPACE_ID}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions`;
  }
  const protocol = definition.protocol ?? 'openai-compatible';
  if (protocol === 'gemini-generate-content') endpoint = `${endpoint}/models/${encodeURIComponent(model)}:generateContent`;
  return {id, model, endpoint, protocol, apiKey: env[definition.key].trim(), custom: Boolean(definition.custom)};
}

function conversationTurns(messages) {
  const turns = [];
  for (const message of messages.filter(message => message.role !== 'system')) {
    const previous = turns.at(-1);
    if (previous?.role === message.role) previous.content += `\n\n${message.content}`;
    else turns.push({...message});
  }
  return turns;
}

function upstreamRequest(provider, messages, maxTokens) {
  const headers = {'Content-Type': 'application/json'};
  if (provider.protocol === 'anthropic-messages') {
    headers['x-api-key'] = provider.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    return {headers, body: {model: provider.model, system: messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n'), messages: conversationTurns(messages), max_tokens: maxTokens, stream: false}};
  }
  if (provider.protocol === 'gemini-generate-content') {
    headers['x-goog-api-key'] = provider.apiKey;
    return {headers, body: {
      systemInstruction: {parts: messages.filter(message => message.role === 'system').map(message => ({text: message.content}))},
      contents: conversationTurns(messages).map(message => ({role: message.role === 'assistant' ? 'model' : 'user', parts: [{text: message.content}]})),
      generationConfig: {maxOutputTokens: maxTokens},
    }};
  }
  headers.Authorization = `Bearer ${provider.apiKey}`;
  return {headers, body: {model: provider.model, messages, max_tokens: maxTokens, stream: false,
    ...(provider.id === 'deepseek' ? {thinking: {type: 'disabled'}} : {}),
    ...(provider.id === 'kimi' ? {reasoning_effort: 'low'} : {}),
  }};
}

function upstreamAnswer(provider, result) {
  if (result?.error) return undefined;
  if (provider.protocol === 'anthropic-messages') {
    if (!Array.isArray(result?.content) || result.stop_reason === 'tool_use' || result.content.some(block => block?.type === 'tool_use' || block?.type === 'server_tool_use')) return undefined;
    return result.content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n\n');
  }
  if (provider.protocol === 'gemini-generate-content') {
    const candidate = result?.candidates?.[0];
    if (result?.promptFeedback?.blockReason || candidate?.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) return undefined;
    const parts = candidate?.content?.parts;
    if (Array.isArray(parts) && parts.some(part => part?.functionCall)) return undefined;
    return Array.isArray(parts) ? parts.filter(part => part && part.thought !== true && typeof part.text === 'string').map(part => part.text).join('\n\n') : undefined;
  }
  return result?.choices?.[0]?.message?.content;
}

export function createMemoryLimiter({limit = 10, periodMs = 60000, maxKeys = 2000, now = Date.now} = {}) {
  const counts = new Map();
  return key => {
    const time = now();
    for (const [stored, entry] of counts) if (entry.until <= time) counts.delete(stored);
    let current = counts.get(key);
    if (!current) {
      // Fail closed on a full cache instead of evicting active limits.
      if (counts.size >= maxKeys) return false;
      current = {count: 0, until: time + periodMs};
      counts.set(key, current);
    }
    return ++current.count <= limit;
  };
}
const memoryLimit = createMemoryLimiter();

async function limitRequest(request, env, fallback) {
  // Cloudflare supplies this header. Anonymous shared IPs may share a quota.
  const key = `xiaoyi:chat:${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
  if (env.RATE_LIMITER) {
    try {
      const result = await env.RATE_LIMITER.limit({key});
      if (!result || typeof result.success !== 'boolean') throw new Error('invalid limiter result');
      return result.success;
    } catch { fail(503, 'rate_limiter_unavailable', '服务暂时不可用，请稍后再试。'); }
  }
  return fallback(key);
}

async function readBoundedText(message, maxBytes, status = 413) {
  const declared = message.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) fail(status, 'body_too_large', '请求或响应内容过大。');
  if (!message.body) return '';
  const reader = message.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); fail(status, 'body_too_large', '请求或响应内容过大。'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
  catch { fail(status === 413 ? 400 : status, 'invalid_encoding', '内容编码无效。'); }
}

function headersFor(origin) {
  const headers = new Headers({'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff'});
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}
function jsonResponse(body, status, origin, extra = {}) {
  const headers = headersFor(origin);
  for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  return new Response(JSON.stringify(body), {status, headers});
}

/** Factory keeps fetch/time/rate-limit dependencies injectable for Node tests. */
export function createHandler({fetchImpl = fetch, fallbackLimiter = memoryLimit, timeoutMs} = {}) {
  return async (request, env = {}) => {
    let origin;
    try {
      const pathname = new URL(request.url).pathname;
      if (!['/api/chat', '/api/models'].includes(pathname)) fail(404, 'not_found', '接口不存在。');
      const allowed = parseAllowedOrigins(env.ALLOWED_ORIGIN);
      if (!allowed.length) fail(503, 'origin_not_configured', '服务来源尚未配置，请联系维护者。');
      const incomingOrigin = request.headers.get('Origin');
      if (!incomingOrigin || !allowed.includes(incomingOrigin)) fail(403, 'origin_forbidden', '不允许的请求来源。');
      origin = incomingOrigin;
      if (request.method === 'OPTIONS') {
        const method = request.headers.get('Access-Control-Request-Method');
        const expected = pathname === '/api/models' ? 'GET' : 'POST';
        if (method && method !== expected) fail(405, 'method_not_allowed', '不支持的请求方法。');
        const requested = (request.headers.get('Access-Control-Request-Headers') || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
        if (requested.some(header => header !== 'content-type')) fail(400, 'headers_not_allowed', '不支持的请求头。');
        const headers = headersFor(origin);
        headers.set('Access-Control-Allow-Methods', `${expected}, OPTIONS`);
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
        headers.set('Access-Control-Max-Age', '600');
        headers.append('Vary', 'Access-Control-Request-Method, Access-Control-Request-Headers');
        return new Response(null, {status: 204, headers});
      }
      if (pathname === '/api/models') {
        if (request.method !== 'GET') fail(405, 'method_not_allowed', '此接口只接受 GET。');
        return jsonResponse(configuredModels(env), 200, origin);
      }
      if (request.method !== 'POST') fail(405, 'method_not_allowed', '此接口只接受 POST。');
      if ((request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, 'unsupported_content_type', '请使用 application/json。');
      if (!await limitRequest(request, env, fallbackLimiter)) return jsonResponse({error: '请求过于频繁，请一分钟后再试。', code: 'rate_limited'}, 429, origin, {'Retry-After': '60'});
      const text = await readBoundedText(request, LIMITS.bodyBytes);
      let raw;
      try { raw = JSON.parse(text); } catch { fail(400, 'invalid_json', 'JSON 格式无效。'); }
      const definitions = providerDefinitions(env);
      const payload = validatePayload(raw, definitions);
      const provider = resolveProvider(env, payload.provider, payload.model);
      const retrieved = retrieveKnowledge(payload.messages);
      const evidence = buildEvidenceMessage(retrieved, payload.context);
      const messages = [{role: 'system', content: buildSystemPrompt(payload.mode)}, ...(evidence ? [evidence] : []), ...payload.messages];
      const maxTokens = Math.min(LIMITS.maxTokens, Math.max(256, Number.parseInt(env.MAX_TOKENS, 10) || 2048));
      const waitMs = timeoutMs ?? Math.min(60000, Math.max(1000, Number.parseInt(env.REQUEST_TIMEOUT_MS, 10) || 30000));
      const controller = new AbortController();
      let timer;
      try {
        const task = async () => {
          const outgoing = upstreamRequest(provider, messages, maxTokens);
          const upstream = await fetchImpl(provider.endpoint, {
            method: 'POST', redirect: 'error', signal: controller.signal,
            headers: outgoing.headers, body: JSON.stringify(outgoing.body),
          });
          if (!upstream.ok) { await upstream.body?.cancel(); fail(502, 'provider_error', '模型服务暂时不可用，请稍后重试或切换模型。'); }
          const result = JSON.parse(await readBoundedText(upstream, LIMITS.responseBytes, 502));
          const answer = upstreamAnswer(provider, result);
          if (typeof answer !== 'string' || !answer.trim() || answer.length > LIMITS.answerChars) fail(502, 'invalid_provider_response', '模型未返回有效回复，请稍后重试。');
          return jsonResponse({answer: answer.trim(), reply: answer.trim(), provider: provider.id, model: provider.model, sources: retrieved.sources}, 200, origin);
        };
        const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new APIError(504, 'provider_timeout', '模型响应超时，请稍后重试。')); }, waitMs); });
        return await Promise.race([task(), deadline]);
      } catch (error) {
        if (error instanceof APIError) throw error;
        fail(502, 'provider_error', '模型服务暂时不可用，请稍后重试或切换模型。');
      } finally { clearTimeout(timer); }
    } catch (error) {
      if (error instanceof APIError) return jsonResponse({error: error.message, code: error.code}, error.status, origin);
      return jsonResponse({error: '服务暂时不可用，请稍后重试。', code: 'internal_error'}, 500, origin);
    }
  };
}

export default {fetch: createHandler()};
