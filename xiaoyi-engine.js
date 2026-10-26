/* Deterministic, curated local retrieval. This module does not call an LLM. */
(function (root) {
  'use strict';
  const PLATFORM = '“创享艺苑”是由大学生自发而起的创业者联盟，旨在以专业知识让创新融入学习生活。通过不定期分享创新创业思路与实战技巧，推送社会实践活动招募与成果展示，传递前沿学术动态，提供项目落地推广方案与资源对接。在这里，让创意落地有路径，实践成长有方向。\n\n创始人：赵子状。';
  const canonical = value => String(value || '').normalize('NFKC').replace(/[✚✙✛✜➕﹢＋]/g, '+');
  const norm = value => canonical(value).toLowerCase().replace(/[\s“”‘’「」《》【】（）()·\-—–，,。？?！!：:]/g, '');
  const unique = entries => [...new Map(entries.filter(Boolean).map(entry => [entry.id, entry])).values()];
  const ROUTES = [
    [/记忆流.*(?:怎么|如何|使用)|(?:怎么|如何|使用).*记忆流|(?:小艺|xiaoyi).*(?:记忆|保存对话|恢复对话)|清空记忆|删除记忆/i, ['site-guide-xiaoyi-memory']],
    [/网站.*(?:怎么|如何|使用|操作|配置)|(?:使用|配置)(?:说明|手册)/i, ['site-guide-usage']],
    [/主题|深色模式|浅色模式|白天黑夜|(?:light|dark|auto)模式/i, ['site-guide-theme']],
    [/(?:小艺|xiaoyi).*(?:怎么用|怎么使用|使用|拖动|侧边|打不开)|对话框怎么关闭/i, ['site-guide-xiaoyi']],
    [/(?:知识库|资料库).*(?:怎么|使用|搜索|检索)|(?:竞赛|期刊)目录使用/i, ['site-guide-library']],
    [/(?:接入|配置|切换).*模型|模型.*(?:接入|配置|切换)|接入deepseek|接入通义千问|在线模型不能用|为什么只有knowledge|配置api/i, ['site-guide-models']],
    [/\bvln\b|vision[\s-]*(?:and[\s-]*)?language[\s-]*navigation|视觉语言导航|语言导航|导航智能体/i, ['tech-vln-foundation']],
    [/\bsr\b|\bspl\b|导航评测|导航成功率|success weighted by path length/i, ['tech-vln-evaluation']],
    [/\brag\b|检索增强|知识库问答/i, ['tech-retrieval-augmented-generation']],
    [/react|tool[ -]*(call|use)|function calling|工具调用|工具型\s*agent/i, ['tech-tool-agent']],
    [/模仿学习|imitation learning|行为克隆|behavio[u]?r cloning|dagger|专家示范/i, ['tech-imitation-learning']],
    [/强化学习|reinforcement learning|奖励函数|q.learning|\bdqn\b/i, ['tech-reinforcement-learning']],
    [/diffusion policy|扩散策略|动作扩散|视觉运动策略/i, ['tech-diffusion-policy']],
    [/sim[ -]?to[ -]?real|sim2real|仿真到现实|域随机化|domain randomization/i, ['tech-sim-to-real']],
    [/\bvlm\b|视觉语言模型/i, ['tech-vlm-bridge']],
    [/\bvla\b|视觉语言动作/i, ['tech-vla-foundation']],
    [/具身|embodied|分层.*(agent|智能体)/i, ['tech-embodied-agent', 'tech-vla-foundation']],
    [/\bagents?\b|智能体/i, ['tech-tool-agent', 'tech-embodied-agent']],
    [/预训练|pre.?train/i, ['tech-vla-pretraining-finetuning']],
    [/微调|fine.?tun|lora/i, ['tech-vla-pretraining-finetuning', 'tech-vla-action-interface']],
    [/评测|评估|evaluation|rollout|成功率/i, ['tech-robot-e2e-evaluation']],
    [/动作.*(接口|归一化)|反归一化|openvla|octo/i, ['tech-vla-action-interface']],
    [/模型选型|动作表示|diffusion|flow action/i, ['tech-vla-model-selection']],
    [/训练循环|训练调试|不收敛|training loop|backward/i, ['tech-training-loop']],
    [/断点|续训|checkpoint|复现|reproduc/i, ['tech-training-reproducibility']],
    [/cuda|算子|gemm|softmax|warp/i, ['tech-cuda-operators']],
    [/分布式|ddp|fsdp|zero|张量并行|流水线并行|数据并行/i, ['tech-distributed-strategy']],
    [/训练显存|显存预算|激活检查点|梯度累积|activation checkpoint/i, ['tech-training-memory']],
    [/\bgpu\b|显存|带宽|tensor core/i, ['tech-gpu-resources']],
    [/roofline|性能分析|profiling|算术强度/i, ['tech-gpu-profiling']],
    [/prefill|decode|预填充|解码/i, ['tech-prefill-decode']],
    [/kv.?cache|kv缓存|键值缓存/i, ['tech-kv-cache']],
    [/ttft|tpot|itl|首.*延迟|吞吐|尾延迟|goodput|slo/i, ['tech-inference-metrics']],
    [/推理优化|量化|quantization|batching|推测解码/i, ['tech-inference-optimization']],
    [/训练.*推理|推理.*训练|ai训练|什么是训练|训练是什么|optimizer|epoch|学习率/i, ['tech-training-vs-inference']],
    [/allreduce|集合通信|梯度同步|网络拓扑|gpu通信/i, ['tech-training-network']]
  ];
  const IDEAS = {
    aerospace: [
      {name: '卫星与生活交互科普', problem: '帮助中学生理解卫星如何服务天气、导航与通信', prototype: '一个有出处的交互故事，先覆盖一个应用场景', test: '请几位目标读者完成同一组理解题，记录误解与反馈'},
      {name: '航空学习资料助手', problem: '帮助初学者在指定公开资料里找到解释', prototype: '一份小型授权资料集、带来源问答与固定问题清单', test: '逐题检查出处、正确性与“资料不足”时的处理'},
      {name: '纸飞机实验科普', problem: '帮助学生观察配重与形状怎样影响飞行', prototype: '固定场地、少量机型和可重复的测量记录', test: '多次重复并保留原始记录，区分观察结果与推测'}
    ],
    robotics: [
      {name: '机器人失败片段整理工具', problem: '帮助学习者定位操作失败的阶段', prototype: '使用有权使用的视频，记录任务、观察、动作和失败标签', test: '让另一位观察者按相同规则标注，检查一致性'},
      {name: '具身智能互动科普', problem: '帮助初学者理解感知、决策与行动的闭环', prototype: '一个可交互的任务流程和几种可解释的失败情况', test: '检查读者能否解释失败原因，而非只看演示是否流畅'},
      {name: '仿真单任务实验', problem: '在可控环境中验证一个明确操作任务', prototype: '固定环境、动作接口与成功判据的小实验', test: '固定初始状态与 rollout 预算，保存成功和失败记录'}
    ],
    culture: [
      {name: '地方文化交互叙事', problem: '帮助访客理解一个地方文化对象', prototype: '有授权图片与出处的单主题故事', test: '用目标读者访谈检查理解与资料准确性'},
      {name: '技艺学习资料工具', problem: '帮助学生梳理一项技艺的步骤', prototype: '经核验的步骤卡片与资料索引', test: '请相关从业者检查表达是否准确'},
      {name: '文化资料检索助手', problem: '帮助读者在指定资料中寻找可追溯信息', prototype: '限定资料范围的问答与检索入口', test: '检查引用、遗漏和不能回答的问题'}
    ],
    environment: [
      {name: '校园节能观察', problem: '帮助学生识别具体的校园用能问题', prototype: '一个场景的观察记录与简单展示', test: '比较相同条件下的记录，避免从少量数据推断因果'},
      {name: '种植观察工具', problem: '帮助种植初学者整理观察记录', prototype: '记录照片、环境和操作的简单网页', test: '请目标使用者完成记录任务并反馈'},
      {name: '垃圾分类学习工具', problem: '帮助学生理解本地分类规则', prototype: '引用本地规则的少量分类练习', test: '检验规则准确性与用户理解'}
    ],
    accessibility: [
      {name: '公共信息易读工具', problem: '帮助使用者理解一种具体公共说明', prototype: '原文、易读改写与人工核对流程', test: '与目标使用者一起检查理解和信息完整性'},
      {name: '手机操作学习卡', problem: '帮助初学者完成一种手机操作', prototype: '少量清晰步骤与可访问的展示', test: '观察真实操作中的停顿和误解'},
      {name: '办事资料整理', problem: '帮助使用者找到办事所需信息', prototype: '有官方出处的任务清单', test: '核验更新日期并检查真实任务完成情况'}
    ],
    general: [
      {name: '单场景学习工具', problem: '帮助一类学习者解决一个具体困难', prototype: '只支持一项任务的小网页', test: '观察目标用户能否完成任务'},
      {name: '有出处的资料助手', problem: '帮助读者从限定资料中寻找答案', prototype: '小型资料集、引用与无法回答的处理', test: '用固定问题检查答案和来源'},
      {name: '实践记录与展示', problem: '帮助参与者整理一次实践过程', prototype: '问题、过程、证据和反馈的简洁展示', test: '请未参与的人检查是否理解项目价值'}
    ]
  };

  function create(options) {
    options = options || {};
    const data = {...(options.data || {})};
    const fetcher = options.fetch || root.fetch?.bind(root);
    let loading;
    let memory;
    function reset() {
      memory = {scope: '', technical: [], sources: [], idea: {domain: '', selected: -1, stage: 0}, background: []};
    }
    reset();
    async function loadData() {
      if (!loading) loading = Promise.all(['competitions', 'journals', 'technical-knowledge'].map(async kind => {
        if (data[kind]?.entries) return;
        if (!fetcher) return;
        try {
          const response = await fetcher(`data/${kind}.json`);
          if (!response.ok) throw new Error('Unavailable');
          const parsed = await response.json();
          if (Array.isArray(parsed.entries)) data[kind] = parsed;
        } catch (_) { /* Missing datasets yield an explicit limited answer, not invented entries. */ }
      })).finally(() => { loading = null; });
      await loading;
      return {competitions: Boolean(data.competitions), journals: Boolean(data.journals), technical: Boolean(data['technical-knowledge'])};
    }
    function entries(kind) { return data[kind]?.entries || []; }
    function byId(id) { return entries('technical-knowledge').find(entry => entry.id === id); }
    function source(entry, kind) {
      return {...entry, kind, sourceTitle: data[kind]?.sourceTitle, sourceNote: data[kind]?.sourceNote};
    }
    function venture(text) {
      if (!/创享艺苑/.test(text) || !/商业|业务|发展|成长|未来|主线|规划|已有|现有|基础|完成|做过|具身|VLA|Agent|智能体|Skill|技能|RAG|工作坊|研究助手|机器人|应用|服务|项目|方向|OPC|一人公司|伙伴|团队|合作/i.test(text)) return null;
      const ids = [];
      if (/商业|业务|发展|成长|未来|主线|方向|OPC|一人公司|伙伴|团队/i.test(text)) ids.push('venture-platform-direction');
      if (/具身|VLA|机器人|知识服务|知识库应用|课程|工作坊|场馆|讲解|演示/i.test(text)) ids.push('venture-embodied-knowledge-applications');
      if (/Agent|智能体|Skill|技能|RAG|工具|工作流|研究助手/i.test(text)) ids.push('venture-agent-skills');
      if (/商业|已有|现有|基础|完成|做过|成果|状态|落地|合作|伙伴|团队|OPC|一人公司/i.test(text)) ids.push('venture-foundations-status');
      return unique((ids.length ? ids : ['venture-platform-direction', 'venture-foundations-status']).map(byId)).slice(0, 4);
    }
    function technical(text) {
      if (/6g.*(?:报道|文章|story)|研修报道|研修文章/i.test(text)) return unique(['profile-6g-training-story'].map(byId));
      if (/6g|6G时代数据要素|secure data flows/i.test(text)) return unique(['profile-6g-course-paper'].map(byId));
      // Resource navigation is distinct from an explanation of the VLA concept.
      if (/学习资源.*(?:怎么|如何|使用)|(?:怎么|如何).*学习资源|learning resources.*(?:use|help)/i.test(text)) return unique(['site-guide-learning-resources'].map(byId));
      if (/(?:vla[\s-]*guide|本地VLA知识库)/i.test(text) && /入口|在哪|哪里|链接|浏览|打开|\b(?:where|link|open|find|access)\b/i.test(text)) return unique(['learning-vla-guide'].map(byId));
      if (/算力.*网络.*(?:合集|资源|入口|学习)|(?:rdma|roce).*(?:学习资源|学习合集)|AI Network Learning/i.test(text)) return unique(['learning-ai-network'].map(byId));
      const initiative = venture(text);
      if (initiative !== null) return initiative;
      // Provider names and setup verbs need not be adjacent (for example,
      // “Xiaoyi 如何接入豆包？”). Resolve that intent before broad “使用” routes.
      const provider = /cloudflare|workers\s*ai|豆包|doubao|火山方舟|volcengine|\bark\b|\bglm(?:[\s-]*\d[\w.-]*)?\b|智谱|kimi|tokenhub|moonshot|deepseek|qwen|通义千问/i.test(text);
      const setup = /接入|配置|切换|启用|连接|部署|(?:小艺|xiaoyi).*(?:使用|支持|选择)|\b(?:connect|configure|integrate|enable|switch|setup|set up)\b/i.test(text);
      const media = /图片|图像|上传|多模态|音频|视频|\b(?:images?|uploads?|multimodal|audio|video)\b/i.test(text);
      if (provider && setup) return unique(['site-guide-models', /cloudflare|workers\s*ai/i.test(text) ? 'site-guide-model-workers-ai' : 'site-guide-model-providers', ...(media ? ['site-guide-model-inputs'] : [])].map(byId));
      const routed = unique(ROUTES.filter(([pattern]) => pattern.test(text)).flatMap(([, ids]) => ids.map(byId)));
      if (routed.length) return routed.slice(0, 5);
      const query = norm(text);
      return entries('technical-knowledge').filter(entry => entry.sourceType !== 'owner-provided-business-plan').map(entry => {
        const score = Math.max(0, ...[entry.name, ...(entry.aliases || [])].map(name => norm(name)).filter(name => name.length > 2).map(name => query.includes(name) ? name.length : 0));
        return {entry, score};
      }).filter(row => row.score).sort((a, b) => b.score - a.score).slice(0, 4).map(row => row.entry);
    }
    function findDirectory(text, kind) {
      const query = norm(text);
      const strip = norm(text.replace(/查找|查询|介绍|推荐|一些|一下|有哪些|有哪一些|我想|请问|我|想|看|关于|有关|第一批|第二批|学术|期刊|竞赛|比赛|目录|具体|详情|链接|是什么|如何|怎么|报名|截止|时间|规则|吗|呢/g, ''));
      const scored = entries(kind).map(entry => {
        const names = [entry.name, ...(entry.aliases || [])].map(norm).filter(Boolean);
        const score = Math.max(0, ...names.map(name => query.includes(name) ? name.length + 20 : strip.length > 1 && name.includes(strip) ? strip.length : 0));
        return {entry, score};
      }).filter(row => row.score).sort((a, b) => b.score - a.score);
      return scored.map(row => row.entry);
    }
    function selectDirectory(text, kind) {
      const batch = /第二批/.test(text) ? '第二批' : /第一批/.test(text) ? '第一批' : '';
      const generic = /^(查找|查询|介绍|推荐|给我|看看|列出|有哪些|有哪一些|的|国家|学术|第一批|第二批|期刊|竞赛|比赛|学科|目录|清单|名单|几条|一些|一下|\s|[？?。、])+$/.test(text);
      if (generic) return entries(kind).filter(entry => !batch || entry.batch === batch).slice(0, 4);
      return findDirectory(text, kind).filter(entry => !batch || entry.batch === batch).slice(0, 4);
    }
    function explicitDirectory(text) {
      const normalized = canonical(text);
      if (/期刊|学术刊物|刊名|第一批|第二批|投稿|\bjournal\b/i.test(normalized)) return 'journals';
      if (/竞赛|比赛|大赛|赛事|挑战杯|蓝桥杯|电赛|大挑|小挑|互联网\+/.test(normalized) && !/想做|项目想法|创意|点子/.test(normalized)) return 'competitions';
      if (entries('competitions').some(entry => [entry.name, ...(entry.aliases || [])].some(name => norm(name).length >= 2 && norm(text) === norm(name)))) return 'competitions';
      // A complete name or alias can select a directory; a generic science noun cannot.
      for (const kind of ['competitions', 'journals']) if (entries(kind).some(entry => [entry.name, ...(entry.aliases || [])].some(name => norm(name).length >= 5 && norm(text) === norm(name)))) return kind;
      return '';
    }
    function preparationIntent(text) {
      // Keep short, natural follow-ups narrow: a new subject such as travel must not reuse a contest.
      return /如何准备|怎么准备|如何入手|怎么入手/.test(text)
        || /^(?:那|那么|请问|我|我们|它|这个|参赛)*(?:需要|应该|要|该)?(?:准备(?:什么|哪些|啥)(?:材料|资料|作品|内容|东西|工作)?|做(?:什么|哪些|啥)准备)(?:呢|吗|呀|啊)?$/.test(norm(text));
    }
    function directoryFollowup(text) {
      return preparationIntent(text) || /报名|截止|资格|费用|赛道|规则|主办|官网|适合我|我能参加|我可以参加|^(它|这个|刚才|这几|第[一二三四1234]|还有|更多)|^那[，,\s]*(它|这个|刚才|第[一二三四1234])/.test(text);
    }
    function previousUsers(text, messages) {
      const history = (Array.isArray(messages) ? messages : []).filter(message => message?.role === 'user' && typeof message.content === 'string').map(message => message.content.trim());
      if (history.length && norm(history.at(-1)) === norm(text)) history.pop();
      return history;
    }
    function sourceIntent(text) {
      return /链接|原文|出处|参考资料|参考文献|来源|官网(?:在|哪|地址|链接)|官网[？?]?$|\b(?:sources?|links?|references?|papers?)\b/i.test(text);
    }
    function sourceFollowup(text) {
      return /^(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:(?:give|send|show|share)\s+(?:me\s+)?(?:the\s+)?(?:original\s+)?(?:sources?|links?|references?|papers?)(?:\s+(?:for\s+(?:this|it)|please))?|(?:which|what)\s+(?:source|paper|reference)\s+(?:should\s+i\s+read|defines?\s+(?:this|it))|where\s+can\s+i\s+(?:read|find)\s+(?:the\s+)?(?:paper|source|reference|link)|(?:sources?|links?|references?|papers?))[?.!\s]*$/i.test(text.trim()) || (sourceIntent(text) && !norm(text.replace(/好的?|知道了|明白了|了解了|那|那么|请问|请|麻烦|能|可以|把|发|给我|给|我|一下|一?个|这|这个|它|的|对应|相关|刚才|上面|原始|论文|原文|链接|来源|出处|参考资料|参考文献|官网|在哪|哪里|地址|url|sources?|links?|是什么|呢|吗/gi, '')));
    }
    function acknowledgement(text) {
      return /^(?:好的?|知道了|明白了|了解了|谢谢|收到|ok|thanks)[。.!！\s]*$/i.test(text);
    }
    function technicalFollowup(text) {
      return /^(?:那|那么|请|再|能|可以|我想)?(?:把|给我|讲|说)?(?:它|它们|这个|这些|刚才|继续|展开|举例|详细|怎么评测|如何评测|怎么学习|怎么入门|学习路线|区别|对比|比较|二者|两者|这两个)/.test(text) || /^(?:它|这个)?(?:有哪些|常用的)?(?:评测指标|评价指标|指标|数据集)(?:是什么|有哪些|怎么选|呢|吗)?[？?]?$/i.test(text);
    }
    function activeEvidence(text, messages, priorOnly) {
      const currentTechnical = technical(text);
      if (!priorOnly && currentTechnical.length) return currentTechnical.map(entry => source(entry, 'technical-knowledge'));
      const currentKind = explicitDirectory(text);
      if (!priorOnly && currentKind) return selectDirectory(text, currentKind).map(entry => source(entry, currentKind));
      if (sourceIntent(text) && !sourceFollowup(text)) return [];
      const history = previousUsers(text, messages);
      for (let index = history.length - 1; index >= 0; index--) {
        const earlier = history[index];
        const records = technical(earlier);
        if (records.length) return records.map(entry => source(entry, 'technical-knowledge'));
        const kind = explicitDirectory(earlier);
        if (kind) {
          let selected = selectDirectory(earlier, kind);
          for (const followup of history.slice(index + 1)) selected = directoryChoice(selected, followup);
          return selected.map(entry => source(entry, kind));
        }
        if (!sourceFollowup(earlier) && !acknowledgement(earlier) && !technicalFollowup(earlier) && !directoryFollowup(earlier)) return [];
      }
      return history.length ? [] : memory.sources.slice(0, 4);
    }
    function sourceAnswer(text, messages) {
      const sources = activeEvidence(text, messages).slice(0, 4);
      const domestic = sources.find(entry => entry.id === 'site-guide-domestic-model-web-links');
      if (domestic) {
        const links = (domestic.externalLinks || []).filter(link => link && /^https?:\/\//.test(link.url || ''));
        const websiteSources = links.map(link => ({...link, website: link.url, urlType: 'external-links', kind: domestic.kind, sourceTitle: domestic.sourceTitle, sourceNote: domestic.sourceNote}));
        return {text: `国内大模型网站入口（在新标签页打开）：\n\n${websiteSources.map(entry => `[${entry.name}](${entry.website})`).join('\n\n')}\n\n以上为外部网站。Xiaoyi 当前仅使用本地知识模式，未接入上述平台的 API。`, sources: websiteSources};
      }
      if (!sources.length) return {text: '当前主题未检索到可核实的来源。请提供具体概念、赛事或刊名，以便匹配已收录资料。', sources: []};
      return {text: `相关来源：\n\n${sources.map(entry => `[${entry.name}](${entry.website})${entry.urlType === 'search' ? '（检索入口，尚未核验为官网）' : ''}`).join('\n\n')}\n\n${sources.some(entry => entry.sourceType === 'primary-paper') ? '原始论文可用于核查概念与方法；本站未声明复现其研究结果。' : '来源类型与具体位置见下方资料卡片。'}`, sources};
    }
    function directoryChoice(selected, text) {
      const choice = text.match(/第\s*([一二三四1234])\s*(?:个|条|项|种)?/);
      if (!choice) return selected;
      const index = {'一': 0, '二': 1, '三': 2, '四': 3, '1': 0, '2': 1, '3': 2, '4': 3}[choice[1]];
      return selected[index] ? [selected[index]] : [];
    }
    function directoryRequest(text, messages) {
      const explicit = explicitDirectory(text);
      if (explicit) return {kind: explicit, selected: selectDirectory(text, explicit)};
      if (!directoryFollowup(text) || technical(text).length || /什么是|是什么|区别|对比/.test(text) && !/^(它|这个|刚才)/.test(text)) return null;
      const history = previousUsers(text, messages), followups = [];
      let previous = null;
      for (let index = history.length - 1; index >= 0; index--) {
        const kind = explicitDirectory(history[index]);
        if (kind) { previous = {kind, selected: selectDirectory(history[index], kind)}; break; }
        if (!directoryFollowup(history[index]) || technical(history[index]).length) return null;
        followups.unshift(history[index]);
      }
      if (!previous && !history.length && ['competitions', 'journals'].includes(memory.scope)) previous = {kind: memory.scope, selected: memory.sources};
      if (!previous?.selected.length) return null;
      for (const item of [...followups, text]) previous.selected = directoryChoice(previous.selected, item);
      return {...previous, followup: true};
    }
    function domain(text) {
      if (/航空|航天|卫星|飞机|飞行/.test(text)) return 'aerospace';
      if (/机器人|具身|\bvla\b/i.test(text)) return 'robotics';
      if (/文化|非遗|艺术/.test(text)) return 'culture';
      if (/老人|无障碍|残障/.test(text)) return 'accessibility';
      if (/农业|种植|环保|环境|节能/.test(text)) return 'environment';
      return '';
    }
    function hydrate(text, messages) {
      const history = (Array.isArray(messages) ? messages : []).filter(message => message?.role === 'user' && typeof message.content === 'string').map(message => message.content);
      if (history.at(-1) !== text) history.push(text);
      for (const item of history) {
        if (/(大一|大二|大三|大四|研究生|零基础|初学|python|编程|代码|硬件|算力|团队|预算|一人|两人|三人|\d人|面向|帮助|服务|参赛|学习|周|个月|元)/i.test(item) && !/^(什么是|.*是什么|那.*呢)/.test(item)) {
          if (!memory.background.includes(item)) memory.background.push(item.slice(0, 240));
        }
        if (!memory.idea.domain && /想做|想搞|准备做|创意|点子|方向/.test(item)) memory.idea.domain = domain(item) || 'general';
      }
      memory.background = memory.background.slice(-6);
      return history;
    }
    function directoryLink(entry) {
      if (!/^https?:\/\//.test(entry.website || '')) return '当前记录暂无可用链接。';
      return entry.urlType === 'official' ? `[查看官网与当届通知](${entry.website})` : `[检索当届官方公告](${entry.website})（检索入口，尚未核验为官网）`;
    }
    function directory(text, request) {
      const {kind, selected, followup} = request;
      if (!selected.length) return {text: `未检索到与“${text}”明确匹配的${kind === 'journals' ? '期刊' : '赛事'}记录。可尝试刊名或赛事简称；检索范围限于本站目录。`, sources: []};
      const sources = selected.map(entry => source(entry, kind));
      const preparation = preparationIntent(text);
      const action = preparation || /报名|截止|资格|费用|赛道|规则|主办|官网|适合我|我能参加|我可以参加/.test(text);
      if (selected.length > 1 && followup && action) return {text: `当前结果包含多项${kind === 'journals' ? '期刊' : '赛事'}。请指定名称或序号。`, sources};
      if (kind === 'competitions' && selected.length === 1) {
        const entry = selected[0];
        const title = entry.name;
        const link = directoryLink(entry);
        if (preparation) {
          const steps = entry.id === 'sxit-competition-001'
            ? '核对当届赛道与资格，围绕真实问题梳理用户、解决方案和验证证据，准备原型与项目说明。'
            : entry.id === 'sxit-competition-024'
              ? '核对当届作品类别和参赛条件，选择范围可控的作品，整理需求、可运行演示、测试记录与说明材料。'
              : '核对当届赛题或作品方向、资格与时间，制作范围明确的原型，并以测试记录说明完成情况与待解决问题。';
          return {text: `“${title}”准备建议：\n${steps}\n\n以上为准备建议；已核验的提交清单尚未收录，具体材料和评审要求以当届公告为准。\n${link}`, sources};
        }
        if (/适合我|我能参加|我可以参加/.test(text)) {
          const background = memory.background.length ? `已提供条件：${memory.background.slice(-2).join('；')}。\n` : '';
          return {text: `关于“${title}”：\n${background}${entry.summary}\n\n参赛适配度可结合兴趣、技能、时间投入与已有作品评估。当前资料不足以确认当届参赛资格；补充年级、专业和作品信息后，可进一步分析准备方向。\n${link}`, sources};
        }
        if (/报名|截止|资格|费用|赛道|规则|时间/.test(text)) return {text: `“${title}”的当届报名时间、资格、费用与赛道细则尚未完整收录。请通过下方入口核对当届通知及所在学校的报名安排。\n\n${link}`, sources};
        if (/主办/.test(text)) return {text: `“${title}”源目录中的主办单位信息未标注版本，可能为历史记录。当前组织机构以当届官网通知为准。\n\n${link}`, sources};
        return {text: `${title}\n${entry.summary}\n\n校内分级：山西工学院 ${entry.level} 类；该分类仅适用于源学校目录。\n${link}\n报名资格、赛道、时间与评审要求以当届官方公告为准。`, sources};
      }
      const textRows = selected.map((entry, index) => `${selected.length > 1 ? `${index + 1}. ` : ''}${entry.name}${kind === 'journals' ? ` · ${entry.batch}` : ` · 校内 ${entry.level}`}\n${entry.summary}`).join('\n\n');
      return {text: `${textRows}\n\n${kind === 'journals' ? '批次依源 PDF 顺序和编号推定；此目录不等同核心期刊、SCI 或现行出版许可。' : 'A / B1 / B2 为山西工学院校内分级，报名与评审请核对当届公告。'}${selected.some(entry => entry.urlType === 'search') ? ' 检索入口尚未核验为官网。' : ''}`, sources};
    }
    function explain(text, records) {
      const ids = records.map(entry => entry.id);
      const comparison = /区别|比较|对比|关系|不同|vs\.?|versus|相比/i.test(text);
      const business = records.length && records.every(entry => entry.sourceType === 'owner-provided-business-plan');
      if (!business && comparison && !ids.includes('tech-vla-foundation') && !ids.includes('tech-vlm-bridge') && /它们|二者|两者|这两个/.test(text)) records = unique([...memory.technical.map(byId), ...records]);
      let body;
      const allIds = records.map(entry => entry.id);
      if (business) {
        body = records.slice(0, 3).map(entry => `${entry.name}\n${entry.summary}\n${entry.details}`).join('\n\n');
      } else if (allIds.includes('tech-vln-foundation') && /评测|评价|指标|sr|spl|如何测|怎么测/i.test(text)) {
        records = [byId('tech-vln-evaluation'), byId('tech-vln-foundation')].filter(Boolean);
        body = `${records[0]?.summary || ''}\n${records[0]?.details || ''}\n\n例如，两条轨迹均到达目标时，路径更长的一条可能得到更低的 SPL。成功判定还需核对停止位置，经过目标位置本身不足以判定成功。`;
      } else if (comparison && allIds.includes('tech-vln-foundation') && (allIds.includes('tech-vla-foundation') || allIds.includes('tech-vlm-bridge'))) {
        records = ['tech-vln-foundation', 'tech-vlm-bridge', 'tech-vla-foundation'].map(byId).filter(Boolean);
        body = 'VLN（Vision-and-Language Navigation）是根据视觉观察和语言指令完成导航的任务，重点是走到哪里、怎样走、何时停止。VLM（Vision–Language Model）连接视觉与语言，通常用于理解或生成；VLA（Vision–Language–Action）把视觉、语言与动作连接为策略。\n\n它们处在不同描述层次：VLN 是任务方向，VLM/VLA 更偏模型或策略范式。VLN 系统可以使用 VLM 或动作策略，但导航到达率不能直接代表机械臂操作成功率。';
      } else if (comparison && allIds.includes('tech-vla-foundation') && allIds.includes('tech-vlm-bridge')) {
        records = ['tech-vlm-bridge', 'tech-vla-foundation'].map(byId).filter(Boolean);
        body = 'VLM（Vision–Language Model）把视觉特征连接到语言模型，用于图像与语言的理解和生成。VLA（Vision–Language–Action）进一步把视觉观察、语言任务与动作相连，用于机器人策略。\n\n两者的关键区别是输出与验证方式：VLM 的回答质量不等于机器人执行成功；VLA 还要核对动作接口、数据约定，并在固定任务协议下检验真实行为。VLA 可以利用 VLM 的预训练能力，但并非所有 VLM 都能直接控制机器人。';
      } else if (/机器人.*(是什么|是啥)|什么是机器人/.test(text)) {
        body = '机器人是通过机械或其他物理执行机构感知环境并完成动作的系统；它可以采用预设控制，也可以使用学习策略。现有资料重点讨论学习型机器人：VLA 连接视觉、语言与动作，具身 Agent 则关注目标规划、短时动作和执行反馈。\n\n机器人载体、VLA 应用与系统可靠性分别需要相应证据；演示效果或回答流畅度不足以证明可靠性。';
      } else if (/具身.*(是什么|是啥)|什么是具身/.test(text)) {
        body = '具身智能关注智能系统如何通过身体或机器人载体与环境形成感知、决策、行动和反馈的闭环。本站学习资料重点讨论具身 Agent：高层组织目标或计划，低层输出短时动作，再用完成、失败或状态过期等反馈调整计划。\n\nVLA 是连接视觉、语言与动作的一类策略路线；分层 Agent 是系统组织方式，两者可以组合。分层本身不保证长程任务可靠，仍需检查接口一致性与执行失败。';
      } else {
        body = records.slice(0, 3).map(entry => `${entry.name}\n${entry.summary}\n${entry.details}`).join('\n\n');
      }
      if (!records.length) return {text: '本地资料暂未收录足以解释该概念的条目。当前覆盖 VLA、VLM、VLN、RAG、Agent、训练评测与 AI Infra，可围绕这些主题进一步查询。', sources: []};
      const note = records.every(entry => entry.sourceType === 'first-party-site-guide')
        ? '操作步骤与配置说明见下方本站手册。'
        : records.every(entry => /^owner-provided-(?:course-paper|project-material|training-story)$/.test(entry.sourceType))
          ? '下方链接提供原始材料，并区分研修、方案探索与已验证成果。'
        : records.every(entry => entry.sourceType === 'owner-provided-business-plan')
          ? '商业计划材料见下方来源，已开展基础与计划应用分别列示。'
          : '可通过下方来源核查概念与方法；模型能力、许可和性能仍应结合原始实现与实际实验判断。';
      return {text: `${body}\n\n${note}`, sources: records.slice(0, 4).map(entry => source(entry, 'technical-knowledge'))};
    }
    function project(text) {
      const explicitDomain = domain(text);
      if (explicitDomain && explicitDomain !== memory.idea.domain) memory.idea = {domain: explicitDomain, selected: -1, stage: 0};
      if (!memory.idea.domain) memory.idea.domain = 'general';
      const choices = IDEAS[memory.idea.domain];
      const selection = text.match(/(?:第\s*([一二三123])\s*(?:个|条|项|种)?|([一二三123])\s*(?:号|方案|方向))/);
      if (selection) memory.idea.selected = {'一': 0, '二': 1, '三': 2, '1': 0, '2': 1, '3': 2}[selection[1] || selection[2]];
      const background = memory.background.length ? `已提供条件：${memory.background.slice(-3).join('；')}。\n\n` : '';
      const lowResource = memory.background.some(item => /没.{0,3}硬件|无硬件|零基础|初学|预算.{0,4}(低|少)|一人/.test(item));
      if (memory.idea.selected < 0) {
        return {text: `${background}以下三个方向适合开展小范围验证：\n\n${choices.map((choice, index) => `${index + 1}. ${choice.name}：${choice.problem}。建议原型：${choice.prototype}。`).join('\n\n')}\n\n${lowResource ? '结合当前条件，建议优先使用公开授权资料或仿真。' : '选定方向后，可明确原型范围与验证方法。'}以上为待验证的项目构想，未作为获奖案例引用。`, sources: []};
      }
      const choice = choices[memory.idea.selected];
      memory.idea.stage += 1;
      const next = memory.idea.stage === 1
        ? `第一步：明确使用者与问题——${choice.problem}。\n第二步：实现${choice.prototype}。\n第三步：${choice.test}。`
        : memory.idea.stage === 2
          ? `“${choice.name}”实施要点：\n1. 明确使用情境和可观察目标。\n2. 整理原型的输入、输出与资料授权，确认资源可获得。\n3. 按“${choice.test}”制作测试清单，保留失败记录。`
          : `“${choice.name}”下一轮迭代：定位上一轮的主要失败因素，单独修改该因素，并使用相同任务复测。记录观察、改动与证据，根据反馈调整功能范围。`;
      return {text: `${background}当前选择：${memory.idea.selected + 1}. ${choice.name}。\n\n${next}${lowResource ? '\n\n资源建议：优先采用授权资料与低成本软件原型；涉及硬件时另行评估设备与安全条件。' : ''}\n\n该方案为项目推演，仍需用户反馈与实验验证。`, sources: []};
    }
    function remember(result, scope) {
      memory.scope = scope;
      memory.sources = result.sources || [];
      if (scope === 'technical' && memory.sources.length) memory.technical = unique([...memory.technical.map(byId), ...memory.sources]).slice(-5).map(entry => entry.id);
      return result;
    }
    function reply(input, messages) {
      const text = String(input || '').trim();
      hydrate(text, messages);
      if (!text) return {text: '请输入具体概念、目录名称或项目问题。', sources: []};
      const siteGuides = technical(text).filter(entry => entry.sourceType === 'first-party-site-guide');
      if (siteGuides.length && !sourceIntent(text)) return remember(explain(text, siteGuides), 'technical');
      if (/身份证|家庭住址|住哪|私人地址|密码|密钥|api.?key|未公开|私人电话|私密|内部数据|薪资/i.test(text)) return remember({text: 'Xiaoyi 仅使用网站公开经历与已整理资料，不提供未公开的个人信息、账号凭据或单位内部数据。公开联系方式见个人主页。', sources: []}, 'privacy');
      const personalRecords = technical(text).filter(entry => /^owner-provided-(?:course-paper|project-material|training-story)$/.test(entry.sourceType));
      if (personalRecords.length) return remember(sourceIntent(text) ? sourceAnswer(text, messages) : explain(text, personalRecords), 'technical');
      const ventureRecords = technical(text).filter(entry => entry.sourceType === 'owner-provided-business-plan');
      if (ventureRecords.length) return remember(sourceIntent(text) ? sourceAnswer(text, messages) : explain(text, ventureRecords), 'venture');
      if (/创享艺苑|平台介绍|介绍.*平台/.test(text)) return remember({text: PLATFORM, sources: []}, 'platform');
      if (/opc|一人公司/i.test(text)) return remember({text: 'OPC 是 One Person Company（一人公司）。赵子状以此描述个人创业实践，独立于原点学堂与原点夜校的学习经历。创享艺苑的公开定位为大学生创业者联盟。', sources: []}, 'profile');
      if (/创始人|赵子状/.test(text)) return remember({text: '赵子状是创享艺苑创始人，计算机专业背景，目前在千寻智能担任机器人端到端评测工程师，关注 VLA、具身智能与 Agent，并在原点学堂和原点夜校持续学习。更多公开经历可查看个人主页。', sources: []}, 'profile');
      if (/^(你好|哈喽|hello|hi)[！!。\s]*$/i.test(text)) return remember({text: '你好，我是 Xiaoyi，网站里的知识入口。可查询技术、竞赛与期刊资料，并提供初步项目建议。当前使用本地资料与规则检索，未启用在线大模型。', sources: []}, 'greeting');
      if (sourceIntent(text)) {
        const result = sourceAnswer(text, messages);
        const scope = result.sources[0]?.kind;
        return remember(result, scope === 'technical-knowledge' ? 'technical' : scope || 'limited');
      }
      if (acknowledgement(text)) return {text: '可继续当前主题，或提出新的问题。', sources: []};
      const request = directoryRequest(text, messages);
      if (request) return remember(directory(text, request), request.kind);
      const definition = /是什么|什么是|是啥|如何理解|解释|定义|区别|对比|比较|关系|不同|vs\b|那.{1,25}呢[？?]?$/i.test(text);
      const projectIntent = /想做|想搞|准备做|做一个|项目|创意|点子|方向|原型|方案|参赛|怎么落地/.test(text) && !definition;
      const projectFollowup = memory.idea.domain && memory.scope === 'ideas' && /第[一二三123]|[一二三123](号|方案|方向)|继续|接下来|下一步|怎么开始|怎么验证|怎么测试|会.{0,8}(python|编程|代码)|大[一二三四]|没.{0,3}硬件|预算|团队/i.test(text) && !definition && !technical(text).length;
      if (projectIntent || projectFollowup) return remember(project(text), 'ideas');
      let records = technical(text);
      if (technicalFollowup(text) && records.every(entry => entry.id === 'tech-robot-e2e-evaluation')) {
        const prior = activeEvidence(text, messages, true).filter(entry => entry.kind === 'technical-knowledge');
        if (prior.some(entry => ['tech-vln-foundation', 'tech-vln-evaluation'].includes(entry.id))) records = unique([byId('tech-vln-foundation'), byId('tech-vln-evaluation')]);
      }
      if (/机器人.*(是什么|是啥)|什么是机器人/.test(text)) records = unique([byId('tech-embodied-agent'), byId('tech-vla-foundation')]);
      if (/\bskills?\b|技能包|技能是什么/i.test(text)) return remember({text: '本地资料尚未收录经核验的 Agent Skill 定义与实现规范。请提供具体平台名称，以便进一步区分任务说明、资源与执行接口；相关结论仍需以该平台文档为准。', sources: []}, 'technical');
      if (!records.length && technicalFollowup(text)) {
        const active = activeEvidence(text, messages).filter(entry => entry.kind === 'technical-knowledge');
        records = /它们|二者|两者|这两个/.test(text) && memory.scope === 'technical' ? memory.technical.map(byId).filter(Boolean) : active;
      }
      if (/区别|比较|对比|关系|不同|vs\b/i.test(text) && records.length === 1 && memory.scope === 'technical' && (/它|它们|二者|两者|这两个/.test(text) || /vlm|vla/i.test(text) && memory.technical.some(id => ['tech-vla-foundation', 'tech-vlm-bridge'].includes(id)))) records = unique([...records, ...memory.technical.map(byId)]);
      if (records.length) return remember(explain(text, records), 'technical');
      if (definition) return remember(explain(text, []), 'technical');
      if (/航空|航天|卫星|飞机|飞行/.test(text)) return remember({text: '本地技术资料主要覆盖 VLA、训练评测与 AI Infra，航空航天专业资料尚不充分。科普项目可从目标读者、主题和原型范围展开；专业事实与竞赛案例需另行核验。', sources: []}, 'limited');
      return remember({text: '请提供具体概念、赛事、刊名，或项目的目标用户与拟解决问题。本地模式基于已整理资料提供检索与初步项目分析，未覆盖的内容将明确说明。', sources: []}, 'limited');
    }
    function context(input, messages) {
      const text = String(input || '').trim();
      if (sourceIntent(text)) {
        const sources = activeEvidence(text, messages).slice(0, 4);
        return {kind: 'website-library', sources, sourceNotes: unique(sources.map(entry => ({id: entry.kind, note: data[entry.kind]?.sourceNote}))).map(item => item.note).filter(Boolean), localMode: 'curated-retrieval', conversation: {scope: memory.scope, idea: null, background: memory.background.slice(-3)}};
      }
      const request = directoryRequest(text, messages);
      let sources = request ? request.selected.map(entry => source(entry, request.kind)) : technical(text).slice(0, 4).map(entry => source(entry, 'technical-knowledge'));
      if (!sources.length && !request && /它|刚才|继续|第[一二三123]|那.*呢/.test(text)) {
        const history = previousUsers(text, messages);
        sources = history.length
          ? technical(history.at(-1)).slice(0, 4).map(entry => source(entry, 'technical-knowledge'))
          : memory.sources.slice(0, 4);
      }
      return {kind: 'website-library', sources, sourceNotes: unique(sources.map(entry => ({id: entry.kind, note: data[entry.kind]?.sourceNote}))).map(item => item.note).filter(Boolean), localMode: 'curated-retrieval', conversation: {scope: memory.scope, idea: memory.idea.domain ? {domain: memory.idea.domain, selected: memory.idea.selected >= 0 ? IDEAS[memory.idea.domain][memory.idea.selected].name : null} : null, background: memory.background.slice(-3)}};
    }
    return {loadData, reply, context, reset};
  }
  root.XiaoyiEngine = {create};
})(typeof window !== 'undefined' ? window : globalThis);

/*
 * A small, tab-session memory stream for Xiaoyi.  This is deliberately
 * separate from the retrieval engine: it stores recent turns for continuity,
 * but it does not turn assistant text into a knowledge source or send
 * anything to a provider.  The UI may disable or clear it at any time.
 */
(function (root) {
  'use strict';
  const VERSION = 1;
  // Do not read or migrate the former localStorage stream: it could belong to
  // somebody who previously used this browser profile. Session storage is
  // scoped to the current top-level tab and site, not to an authenticated user.
  const DEFAULT_KEY = 'xiaoyi-memory-session-v2';
  const MAX_ENTRIES = 24;
  const MAX_ENTRY_CHARS = 6000;
  const MAX_TOTAL_CHARS = 24000;
  const MAX_TOTAL_BYTES = 60000;
  const text = value => String(value == null ? '' : value).replace(/\u0000/g, '').trim();
  const bytes = value => { let total = 0; for (const character of value) { const point = character.codePointAt(0); total += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4; } return total; };
  const id = () => {
    try { if (root.crypto?.randomUUID) return root.crypto.randomUUID(); } catch (_) { /* fallback below */ }
    return `xy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  function recallRequest(input) {
    const value = text(input);
    if (!/你还记得|我们聊过什么|(?:之前|上次).{0,20}(?:问|聊|说)|我的条件|^(?:查看|列出|看看|回忆一下)(?:我的|我们)?(?:记忆|聊天|对话)|^(?:what (?:do you )?remember|do you remember|recall (?:my|our))\b/i.test(value)) return null;
    return {query: value.replace(/你还记得|我们聊过什么|我们|之前|上次|我|的|条件|吗|什么|问过|聊过|说过|记忆|回忆一下|[，,。.?？!！]/g,'').replace(/\b(?:what|do|you|remember|recall|my|our|did|discuss|about|conversation|history)\b/gi,'').trim()};
  }

  function create(options) {
    options = options || {};
    const key = text(options.key) || DEFAULT_KEY;
    let storage = options.storage;
    if (storage === undefined) {
      try { storage = root.sessionStorage; } catch (_) { storage = null; }
    }
    let persistent = Boolean(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function');
    let state = {version: VERSION, enabled: true, activeConversation: id(), entries: []};
    function read() {
      if (!storage || typeof storage.getItem !== 'function') return;
      let raw;
      try { raw = storage.getItem(key); } catch (_) { persistent = false; return; }
      if (!raw || bytes(raw) > MAX_TOTAL_BYTES) return;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION) return;
        state.enabled = parsed.enabled !== false;
        state.activeConversation = text(parsed.activeConversation).slice(0, 80) || state.activeConversation;
        state.entries = Array.isArray(parsed.entries) ? parsed.entries.map(entry => ({
          id: text(entry?.id).slice(0, 80) || id(),
          conversationId: text(entry?.conversationId).slice(0, 80) || state.activeConversation,
          createdAt: Number.isFinite(entry?.createdAt) ? entry.createdAt : Date.now(),
          user: text(entry?.user).slice(0, MAX_ENTRY_CHARS),
          assistant: text(entry?.assistant).slice(0, MAX_ENTRY_CHARS),
          sources: Array.isArray(entry?.sources) ? entry.sources.map(source => ({name: text(source?.name || source?.title).slice(0, 160), website: /^https?:\/\//.test(source?.website || source?.url || '') ? String(source.website || source.url).slice(0, 500) : '', urlType: text(source?.urlType).slice(0, 20)})).filter(source => source.website).slice(0, 4) : []
        })).filter(entry => entry.user && entry.assistant) : [];
        trim();
      } catch (_) { /* malformed or blocked storage is treated as an empty stream */ }
    }
    function save() {
      if (!storage || typeof storage.setItem !== 'function') return false;
      try { storage.setItem(key, JSON.stringify(state)); persistent = true; return true; }
      catch (_) { persistent = false; return false; }
    }
    function trim() {
      state.entries = state.entries.slice(-MAX_ENTRIES);
      let total = 0;
      const kept = [];
      for (let index = state.entries.length - 1; index >= 0; index -= 1) {
        const entry = state.entries[index];
        const size = bytes(JSON.stringify(entry));
        const chars = entry.user.length + entry.assistant.length;
        if (kept.length && (total + size > MAX_TOTAL_BYTES || chars + kept.reduce((sum, item) => sum + item.user.length + item.assistant.length, 0) > MAX_TOTAL_CHARS)) break;
        kept.push(entry); total += size;
      }
      state.entries = kept.reverse();
      while (state.entries.length && bytes(JSON.stringify(state)) > MAX_TOTAL_BYTES) state.entries.shift();
    }
    read();
    function list() { return clone(state.entries).reverse(); }
    function messages() {
      if (!state.enabled) return [];
      return state.entries.filter(entry => entry.conversationId === state.activeConversation).flatMap(entry => [
        {role: 'user', content: entry.user}, {role: 'assistant', content: entry.assistant}
      ]);
    }
    function remember(user, assistant, sources) {
      if (!state.enabled) return null;
      const u = text(user).slice(0, MAX_ENTRY_CHARS), a = text(assistant).slice(0, MAX_ENTRY_CHARS);
      if (!u || !a) return null;
      const safeSources = Array.isArray(sources) ? sources.map(source => ({name: text(source?.name || source?.title).slice(0, 160), website: /^https?:\/\//.test(source?.website || source?.url || '') ? String(source.website || source.url).slice(0, 500) : '', urlType: text(source?.urlType).slice(0, 20)})).filter(source => source.website).slice(0, 4) : [];
      const entry = {id: id(), conversationId: state.activeConversation, createdAt: Date.now(), user: u, assistant: a, sources: safeSources};
      state.entries.push(entry); trim(); save(); return clone(entry);
    }
    return {
      list,
      reload() { state = {version: VERSION, enabled: true, activeConversation: id(), entries: []}; read(); },
      current() { return clone(state.entries.filter(entry => entry.conversationId === state.activeConversation)); },
      messages,
      remember,
      recall(query) { const needle = text(query).toLowerCase(); return list().filter(entry => !needle || entry.user.toLowerCase().includes(needle)).slice(0, 5).map(entry => ({id: entry.id, conversationId: entry.conversationId, user: entry.user})); },
      remove(entryId) { const before = state.entries.length; state.entries = state.entries.filter(entry => entry.id !== entryId); if (state.entries.length !== before) save(); return before !== state.entries.length; },
      clear() { state.entries = []; save(); },
      startNew() { state.activeConversation = id(); save(); },
      resume(conversationId) { if (!state.entries.some(entry => entry.conversationId === conversationId)) return false; state.activeConversation = conversationId; save(); return true; },
      setEnabled(value) { state.enabled = value !== false; save(); },
      isEnabled() { return state.enabled; },
      isPersistent() { return persistent; },
      count() { return state.entries.length; },
      limits: {maxEntries: MAX_ENTRIES, maxEntryChars: MAX_ENTRY_CHARS, maxTotalChars: MAX_TOTAL_CHARS, maxTotalBytes: MAX_TOTAL_BYTES}
    };
  }
  root.XiaoyiMemory = {create, recallRequest, key: DEFAULT_KEY, limits: {maxEntries: MAX_ENTRIES, maxEntryChars: MAX_ENTRY_CHARS, maxTotalChars: MAX_TOTAL_CHARS, maxTotalBytes: MAX_TOTAL_BYTES}};
})(typeof window !== 'undefined' ? window : globalThis);
