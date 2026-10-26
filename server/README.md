# 小艺国内模型 API

这是独立的 Cloudflare Worker，无运行时外部依赖。静态 GitHub Pages 不执行服务端代码；需要单独部署此目录，前端才能调用联网模型。当前代码没有部署云资源，也没有真实模型密钥。

## 部署

需要 Cloudflare 账号、Node.js 22+ 和至少一家已开通的模型 API。先在 `wrangler.toml` 中确认 `ALLOWED_ORIGIN` 是网站的精确 Origin（协议 + 域名 + 端口，没有路径或尾斜线）。多个站点可用逗号分隔，禁止 `*`；开发的 HTTP 只接受 localhost、127.0.0.1 或 [::1]。

在本目录执行以下命令。`npx wrangler@4` 仅在运行命令时下载 CLI；项目本身不需要安装依赖。

```sh
npx wrangler@4 login
npx wrangler@4 deploy
npx wrangler@4 secret put ZHIPU_API_KEY
```

只给实际使用的供应商设置 secret。其他可选命令：

```sh
npx wrangler@4 secret put DASHSCOPE_API_KEY
npx wrangler@4 secret put MOONSHOT_API_KEY
npx wrangler@4 secret put DEEPSEEK_API_KEY
npx wrangler@4 secret put TENCENT_TOKENHUB_API_KEY
npx wrangler@4 secret put ARK_API_KEY
npx wrangler@4 secret put CUSTOM_API_KEY
```

密钥在交互提示中输入，不能写入代码、Git、`wrangler.toml` 的 `[vars]` 或前端配置。示例中的 `replace-with-...` 不会被当成有效配置。

`MODEL_PROVIDER` 为内置 `deepseek`、`qwen`、`kimi`、`glm`、`tencent`、`ark`，或服务器注册表中配置的自定义 ID；`MODEL_NAME` 只能是服务端允许列表中的别名。本地 `env.example` 默认使用 `glm` / `glm-5.3`，部署时仍须确认 `wrangler.toml` 中的实际配置。默认供应商缺少密钥时自动选第一家已配置的服务。所有供应商都未配置时，`GET /api/models` 返回空列表，聊天明确返回 `503 model_not_configured`；前端应保留本地知识库模式并显示服务未配置。

### GLM-5.3 与 Tencent TokenHub

智谱使用 `MODEL_PROVIDER=glm`、`MODEL_NAME=glm-5.3` 和服务端 secret `ZHIPU_API_KEY`。Worker 向 `https://open.bigmodel.cn/api/paas/v4/chat/completions` 发送 Bearer 认证的 Chat Completions 请求，固定 `stream: false`。

腾讯 TokenHub 国际接口单独使用 `MODEL_PROVIDER=tencent`、`MODEL_NAME=kimi-k3` 与 secret `TENCENT_TOKENHUB_API_KEY`，固定地址为 `https://tokenhub-intl.tencentmaas.com/v1/chat/completions`。该配置与原有 Moonshot `kimi` / `kimi-k3.1-pro` 分开，不能混用两个平台的 API key、模型 ID 或账户授权。公开模型列表显示为 **Tencent TokenHub · Kimi**；前端根据 `/api/models` 自动发现，配置密钥后才能选择。

两者均只向前端返回 `choices[0].message.content`，不返回 `reasoning_content`。只有推理文本、空文本或供应商错误对象时，返回受控错误；不把推理文本补成最终答案。`401`、上游 `429` 与其他上游失败统一映射为 `502 provider_error`，本站限流仍单独返回 `429 rate_limited`。这只说明协议适配已通过本地模拟测试，真实授权、额度及服务连通性须在部署后验证。

### 火山方舟 Ark Responses

火山方舟使用 `MODEL_PROVIDER=ark`、`MODEL_NAME=doubao-seed-evolving` 和服务端 secret `ARK_API_KEY`。固定接口为 `https://ark.cn-beijing.volces.com/api/v3/responses`，使用 Bearer 认证；它是独立的 Responses 协议，不会拼接 `/chat/completions`。公开模型标签为 **Volcengine Ark · Doubao**。

现有 `messages` 纯文本请求保持兼容。Worker 将 system prompt 映射到 `instructions`，将 user 历史映射为 `input_text`、assistant 历史映射为 `output_text`，放入 `input` 消息数组；固定 `stream: false`、`store: false`，输出上限映射为 `max_output_tokens`。回复必须是 `status: completed`，且只采纳 assistant message 的 `output_text`。推理项不展示；工具调用、拒绝、未完成、失败、空输出和错误 JSON 都返回受控错误，不会把中间内容当成最终回复。

仅 `ark` 可额外接收顶层 `images: ["https://images.example.com/robot.jpg"]`，最多 1 个，单个 URL 最长 2000 字符。只允许 HTTPS 域名形式的地址，拒绝凭据、IP 字面量、单标签或常见本地主机名、`data:`、`file:` 等输入；不接受文件上传或 Base64。图片追加到最后一条 user message，类型为 `input_image`。Worker 不抓取图片 URL，由模型供应商获取，调用者应只提供有权提交且可公开访问的图片。URL 校验不进行 DNS/重定向或图片内容探测；供应商是否能读取图片以真实请求结果为准。其他 provider 带非空 `images` 时返回 `400 images_unsupported`。

### 任意 OpenAI-compatible 供应商

需要新增模型时，不修改前端，也不要让访客传入 URL、密钥或任意模型名。把以下 JSON 作为服务端变量 `MODEL_PROVIDERS_JSON`（建议生产用 Wrangler variable；其中每个 `secretEnv` 对应一个 Wrangler secret）：

```json
[
  {
    "id": "my-provider",
    "label": "My Provider",
    "baseUrl": "https://api.example.com/v1",
    "models": ["my-model", "my-reasoner"],
    "secretEnv": "MY_PROVIDER_API_KEY"
  }
]
```

然后设置 `MY_PROVIDER_API_KEY`。`baseUrl` 只接受 HTTPS 公网域名，服务端会拒绝 IP 字面量、本地/内网主机、凭据、查询字符串和片段；服务端自动拼接 `/chat/completions`，也接受已经以该路径结尾的 URL。`id`、模型 ID 和 secret 变量名会按严格字符集校验；自定义 ID 不能覆盖内置供应商。最多登记 8 家供应商，每家最多 40 个模型。注册表内容无效时会被忽略并保持安全失败。部署者须核验域名与 DNS 解析目标，不能把访客提交的域名写入服务端注册表；此处不进行 DNS 解析探测。

简单场景也可只配置一组 `CUSTOM_BASE_URL`、`CUSTOM_MODEL`、`CUSTOM_API_KEY` 和可选的 `CUSTOM_LABEL`，它们在公开模型列表中显示为 `custom`。密钥仍须使用 Wrangler secret：

```sh
npx wrangler@4 secret put CUSTOM_API_KEY
```

`GET /api/models` 只返回已配置供应商、公开标签和允许的模型 ID；不会返回 base URL、secretEnv 名称或密钥。外部应用可按小艺的 HTTP 应用协议接入：读取 `/api/models`，选择返回的 `provider` 与 `model`，然后 POST `/api/chat` 并读取 `answer`。默认上游采用 OpenAI Chat Completions 格式；注册表也支持两个由 Worker 负责映射的原生协议：`anthropic-messages`（Anthropic Messages API）和 `gemini-generate-content`（Google Gemini `generateContent` API）；内置 `ark` 使用独立的 `openai-responses` 适配，目前不开放为自定义协议。四种协议对外都返回同一个 `{answer, reply, provider, model, sources}` 结构。客户端只能传 `messages`、`provider`、`model`、`mode`、`context` 和 Ark 专用的 `images`；URL、Authorization/API key、system prompt、工具和生成参数均由 Worker 控制。

#### 原生 Anthropic / Gemini 接入

在 `MODEL_PROVIDERS_JSON` 的一行定义中加入 `protocol`。不填时保持 `openai-compatible`，所以现有配置不需要修改：

```json
[
  {"id":"claude","label":"Claude","baseUrl":"https://api.anthropic.com/v1","models":["claude-sonnet-4-5"],"secretEnv":"ANTHROPIC_API_KEY","protocol":"anthropic-messages"},
  {"id":"gemini","label":"Gemini","baseUrl":"https://generativelanguage.googleapis.com/v1beta","models":["gemini-2.5-flash"],"secretEnv":"GEMINI_API_KEY","protocol":"gemini-generate-content"}
]
```

`anthropic-messages` 会把服务端 system prompt 放入 Messages API 的 `system` 字段，并使用 `x-api-key` 与固定的 `anthropic-version: 2023-06-01` 请求头；`gemini-generate-content` 会把 system prompt 转换为 `systemInstruction`，将 assistant 映射为 Gemini 的 `model` turn，并把模型名放入路径 `/models/{model}:generateContent`，API key 使用 `x-goog-api-key`。只采纳原生响应中的可展示文本，拒绝工具调用、被安全策略阻断、空响应、超长响应和错误 JSON。模型 ID 仍由服务端严格允许列表控制。

官方协议说明：Anthropic Messages API（`https://platform.claude.com/docs/en/api/messages/create`）、Google Gemini `generateContent`（`https://ai.google.dev/api/generate-content`）。模型名称、权限、版本和服务状态会变化；这些原生适配器只提供受限文本问答，不承诺自动支持供应商的工具、视觉、缓存或流式扩展。

例如，兼容客户端只需要知道 Worker 的公开地址和允许的 Origin：

```sh
curl "https://your-worker.example.workers.dev/api/chat" \\
  -H "Origin: https://your-name.github.io" \\
  -H "Content-Type: application/json" \\
  --data '{"provider":"my-provider","model":"my-model","messages":[{"role":"user","content":"请给我一个学习建议"}]}'
```

客户端不应把供应商地址当作 API 地址，也不应复制供应商 API key；Worker 会从它自己的服务器配置中选择上游并添加 Authorization。

当前网站仅启用本地知识模式。若未来重新部署在线服务，需明确设置 `window.XIAOYI_CONFIG.enableOnline = true`，并把 `window.XIAOYI_CONFIG.endpoint` 指向 Worker 的完整 `/api/chat` URL。模型列表位于同一 Worker 的 `/api/models`。前端只存公开 URL，不存 API key。`GET /api/models` 仅说明已设置了密钥，不能保证账号余额、模型授权、供应商服务可用；真实可用性以调用结果为准。

## 本地开发与验证

```sh
cp env.example .dev.vars
npx wrangler@4 dev
```

编辑被 Git 忽略的 `.dev.vars`，只填需要测试的一家密钥。测试不调用真实供应商：

```sh
node --test ../tests/agent-api.test.mjs
```

`wrangler deploy --dry-run` 可在实际部署前检查打包；不会创建云资源。Worker 将仓库 `data/competitions.json`、`data/journals.json` 与 `data/technical-knowledge.json` 打包到服务端进行本地检索；更新数据后需要重新部署 Worker。技术资料是对个人学习指南和教育教程的改写索引，保留来源页与 `sourceType`，不代表原始研究或实验结果。它不访问用户提供的网址，也不实时浏览网页。

## 接口约定

`GET /api/models` 返回：

```json
{"providers":[{"id":"deepseek","label":"DeepSeek","models":[{"id":"deepseek-flash","label":"deepseek-flash"}]}],"default":{"provider":"deepseek","model":"deepseek-flash"}}
```

`POST /api/chat`：

```json
{"messages":[{"role":"user","content":"我想探索航天科普项目，有什么建议？"}],"provider":"deepseek","model":"deepseek-flash","mode":"auto","context":{"kind":"website-library","sources":[],"sourceNotes":[]}}
```

`provider`、`model`、`mode`、`context` 均可省略；`images` 是仅 Ark 支持的可选图片 URL 数组。`messages` 只允许 `user`/`assistant` 纯文本消息，首尾须为 user；不接收客户端的 system、API key、base URL、工具、生成参数。成功返回 `{answer, reply, provider, model, sources}`（`reply` 与 `answer` 相同，兼容旧调用）；`sources` 是服务端实际检索到的资料，包含 `title/name`、`url/website`、`urlType`、`sourceType`、`sourceLocation`。引用资料不代表当届赛事规则或已核验获奖案例；`urlType:search` 必须显示为搜索入口。技术资料中的 `personal-learning-guide` 是个人指南或观点，`educational-tutorial` 是教育教程；回答须转述并引用来源，不能将它们称为权威共识或原始论文。

错误返回 `{error: "适合展示给用户的中文说明", code: "稳定错误代码"}`。没有有效密钥为 503；频率超限为 429；供应商错误为 502；供应商超时为 504。上游响应正文、内部错误、密钥不返回前端。

## 请求、资料与费用边界

单请求 48 KiB；最多 20 条消息，单条最多 6000 字符，合计最多 18000 字符；context 最多 16 KiB、6 层、500 个值。响应最多 256 KiB/24000 字符。`MAX_TOKENS` 默认 2048，服务端硬上限 4096；`REQUEST_TIMEOUT_MS` 默认 30000，可设置 1000–60000。过长报告可能受输出上限截断，可分段追问。

角色与边界保存在服务端。角色规则按最新平台介绍修订：创享艺苑是大学生自发而起的创业者联盟，赵子状为创始人；创始人的个人 OPC 不代表平台只有一人。不虚构团队人数、合作资源或背书。服务支持科学知识、无害航天、机器人/AI 与原创探索，完整孵化模板仅在用户明确索要完整报告时使用。客户端 context 只作为不可信资料；服务端检索资料也作为数据处理，不允许覆盖 system。提示规则能够约束模型，但不能承诺模型永不出错；需要对重要事实核对来源。

本服务不持久化对话，不把输入或密钥写入日志；请求历史和选中的参考资料会发送给所选供应商处理，其保留政策和费用由该供应商决定。请避免发送敏感个人信息。维护者应在供应商控制台设置账户预算和告警。

## 速率限制与公开 API

`wrangler.toml` 已绑定 `RATE_LIMITER`，按 Cloudflare 提供的连接 IP，每个位置约 10 次/60 秒；`namespace_id` 是账号内正整数命名空间，若已有相同 ID 被其他应用使用，请改成未使用的值。该绑定是局部且最终一致的限流，不是全球严格总额度；共享网络用户可能共用额度。

未绑定 `RATE_LIMITER` 时使用单个 Worker isolate 的短时内存限流（同样 10 次/60 秒，最多保留 2000 个活跃键）。实例重启、多实例及多地域不会共享额度，因此只能作为开发/降级保护，不是生产全局限额。绑定存在但故障时返回 503，不绕过限流。

`ALLOWED_ORIGIN` 与 CORS 只限制浏览器跨站读取，不是身份认证，也不能阻止非浏览器客户端伪造 Origin。此 API 公开可用；上面的限流和供应商预算只能限制部分滥用与花费。如果需要私有访问，应在部署层另行配置 Cloudflare Access 或用户认证；不要把共享密钥放进公开前端冒充认证。

## 供应商官方文档（2026-10-25 核对）

- DeepSeek：https://api-docs.deepseek.com/quick_start/pricing/ （`deepseek-flash` / `deepseek-v4-pro`）
- 千问：https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope （北京旧域名仍支持，建议配置 `DASHSCOPE_WORKSPACE_ID` 使用北京业务空间域名；密钥须同地域）
- Kimi：https://platform.moonshot.cn/docs/api/chat （`kimi-k3.1-pro`，国内接口 api.moonshot.cn）
- GLM：https://docs.bigmodel.cn/api-reference/%E6%A8%A1%E5%9E%8B-api/%E5%AF%B9%E8%AF%9D%E8%A1%A5%E5%85%A8 （`glm-5.3`；Chat Completions 接口 `https://open.bigmodel.cn/api/paas/v4/chat/completions`）和 https://docs.bigmodel.cn/cn/guide/models/free/glm-4.7-flash （`glm-4.7-flash`）
- Tencent TokenHub：用户提供的国际 Chat Completions 接口 `https://tokenhub-intl.tencentmaas.com/v1/chat/completions`（`kimi-k3`，使用 TokenHub 账户的 API key）
- 火山方舟：用户提供的原生 Responses 接口 `https://ark.cn-beijing.volces.com/api/v3/responses`（`doubao-seed-evolving`，使用 `ARK_API_KEY`）
- Cloudflare Rate Limiting：https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

模型名称、权限和服务状态会变化；内置允许列表可更新代码并部署，也可由维护者通过服务端注册表增加自定义供应商/模型。前端仍只能选择公开模型列表中的 ID。
