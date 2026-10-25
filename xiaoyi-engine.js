/* Deterministic, curated local retrieval. This module does not call an LLM. */
(function (root) {
  'use strict';
  const PLATFORM = '“创享艺苑”是由大学生自发而起的创业者联盟，旨在以专业知识让创新融入学习生活。通过不定期分享创新创业思路与实战技巧，推送社会实践活动招募与成果展示，传递前沿学术动态，提供项目落地推广方案与资源对接。在这里，让创意落地有路径，实践成长有方向。\n\n创始人：赵子状。';
  const canonical = value => String(value || '').normalize('NFKC').replace(/[✚✙✛✜➕﹢＋]/g, '+');
  const norm = value => canonical(value).toLowerCase().replace(/[\s“”‘’「」《》【】（）()·\-—–，,。？?！!：:]/g, '');
  const unique = entries => [...new Map(entries.filter(Boolean).map(entry => [entry.id, entry])).values()];
  const ROUTES = [
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
    function technical(text) {
      const routed = unique(ROUTES.filter(([pattern]) => pattern.test(text)).flatMap(([, ids]) => ids.map(byId)));
      if (routed.length) return routed.slice(0, 5);
      const query = norm(text);
      return entries('technical-knowledge').map(entry => {
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
      if (!sources.length) return {text: '这次提到的主题还没有可核实的来源链接。告诉我概念、赛事或刊名，我会提供对应的已收录来源。', sources: []};
      return {text: `可以，下面是对应来源：\n\n${sources.map(entry => `[${entry.name}](${entry.website})${entry.urlType === 'search' ? '（检索入口，尚未核验为官网）' : ''}`).join('\n\n')}\n\n${sources.some(entry => entry.sourceType === 'primary-paper') ? '原始论文链接用于核查概念与方法，不能据此推定已复现其结果。' : '来源类型与具体位置同时保留在下方资料卡片中。'}`, sources};
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
      if (!/^https?:\/\//.test(entry.website || '')) return '当前记录没有可用的链接。';
      return entry.urlType === 'official' ? `[查看官网与当届通知](${entry.website})` : `[检索当届官方公告](${entry.website})（检索入口，尚未核验为官网）`;
    }
    function directory(text, request) {
      const {kind, selected, followup} = request;
      if (!selected.length) return {text: `没有找到与“${text}”明确匹配的${kind === 'journals' ? '期刊' : '赛事'}记录。可提供更短的刊名或赛事名称；未收录不代表不存在。`, sources: []};
      const sources = selected.map(entry => source(entry, kind));
      const preparation = preparationIntent(text);
      const action = preparation || /报名|截止|资格|费用|赛道|规则|主办|官网|适合我|我能参加|我可以参加/.test(text);
      if (selected.length > 1 && followup && action) return {text: `刚才列出了多项${kind === 'journals' ? '期刊' : '赛事'}。你想继续了解哪一项？可以说名称或“第几个”。`, sources};
      if (kind === 'competitions' && selected.length === 1) {
        const entry = selected[0];
        const title = entry.name;
        const link = directoryLink(entry);
        if (preparation) {
          const steps = entry.id === 'sxit-competition-001'
            ? '先核对当届赛道与资格，再用一个真实问题梳理用户、解决方案和验证证据，准备能展示进展的原型与项目说明。'
            : entry.id === 'sxit-competition-024'
              ? '先核对当届作品类别和参赛条件，再选一个能完成的小作品，整理需求、可运行演示、测试记录与说明材料。'
              : '先核对当届赛题或作品方向、资格与时间，再做一个范围明确的原型，用测试记录说明完成了什么、还存在哪些问题。';
          return {text: `准备“${title}”，可以先这样做：\n${steps}\n\n这是准备建议，不是已核验的提交清单；具体材料和评审要求以当届公告为准。\n${link}`, sources};
        }
        if (/适合我|我能参加|我可以参加/.test(text)) {
          const background = memory.background.length ? `你提到：${memory.background.slice(-2).join('；')}。\n` : '';
          return {text: `关于“${title}”：\n${background}${entry.summary}\n\n可以从兴趣方向、已有技能和能投入的时间判断是否值得准备；目前资料不足以确认你符合当届参赛资格。告诉我你的年级、专业和已有作品，我可以继续帮你缩小范围。\n${link}`, sources};
        }
        if (/报名|截止|资格|费用|赛道|规则|时间/.test(text)) return {text: `“${title}”的当届报名时间、资格、费用与赛道细则尚未完整收录，不能由目录补全。先通过下方入口核对当届通知，再确认所在学校的报名安排；我不会推测截止时间或保证可以报名。\n\n${link}`, sources};
        if (/主办/.test(text)) return {text: `“${title}”的源目录记录了主办单位，但未注明版本，可能包含历史信息。当前组织机构请核对当届官网通知。\n\n${link}`, sources};
        return {text: `${title}\n${entry.summary}\n\n目录记录：山西工学院校内竞赛类别 ${entry.level}，不是全国统一赛事分级。\n${link}\n报名资格、赛道、时间与评审要求以当届官方公告为准。`, sources};
      }
      const textRows = selected.map((entry, index) => `${selected.length > 1 ? `${index + 1}. ` : ''}${entry.name}${kind === 'journals' ? ` · ${entry.batch}` : ` · 校内 ${entry.level}`}\n${entry.summary}`).join('\n\n');
      return {text: `${textRows}\n\n${kind === 'journals' ? '批次依源 PDF 顺序和编号推定；此目录不等同核心期刊、SCI 或现行出版许可。' : 'A / B1 / B2 为山西工学院校内分级，报名与评审请核对当届公告。'}${selected.some(entry => entry.urlType === 'search') ? ' 检索入口尚未核验为官网。' : ''}`, sources};
    }
    function explain(text, records) {
      const ids = records.map(entry => entry.id);
      const comparison = /区别|比较|对比|关系|不同|vs\.?|versus|相比/i.test(text);
      if (comparison && !ids.includes('tech-vla-foundation') && !ids.includes('tech-vlm-bridge') && /它们|二者|两者|这两个/.test(text)) records = unique([...memory.technical.map(byId), ...records]);
      let body;
      const allIds = records.map(entry => entry.id);
      if (allIds.includes('tech-vln-foundation') && /评测|评价|指标|sr|spl|如何测|怎么测/i.test(text)) {
        records = [byId('tech-vln-evaluation'), byId('tech-vln-foundation')].filter(Boolean);
        body = `${records[0]?.summary || ''}\n${records[0]?.details || ''}\n\n例如，两条轨迹都到达目标，绕路更多的一条可能得到更低的 SPL。解释结果时还要明确智能体是否在正确位置停止，而不能只看它曾经路过目标。`;
      } else if (comparison && allIds.includes('tech-vln-foundation') && (allIds.includes('tech-vla-foundation') || allIds.includes('tech-vlm-bridge'))) {
        records = ['tech-vln-foundation', 'tech-vlm-bridge', 'tech-vla-foundation'].map(byId).filter(Boolean);
        body = 'VLN（Vision-and-Language Navigation）是根据视觉观察和语言指令完成导航的任务，重点是走到哪里、怎样走、何时停止。VLM（Vision–Language Model）连接视觉与语言，通常用于理解或生成；VLA（Vision–Language–Action）把视觉、语言与动作连接为策略。\n\n它们处在不同描述层次：VLN 是任务方向，VLM/VLA 更偏模型或策略范式。VLN 系统可以使用 VLM 或动作策略，但导航到达率不能直接代表机械臂操作成功率。';
      } else if (comparison && allIds.includes('tech-vla-foundation') && allIds.includes('tech-vlm-bridge')) {
        records = ['tech-vlm-bridge', 'tech-vla-foundation'].map(byId).filter(Boolean);
        body = 'VLM（Vision–Language Model）把视觉特征连接到语言模型，用于图像与语言的理解和生成。VLA（Vision–Language–Action）进一步把视觉观察、语言任务与动作相连，用于机器人策略。\n\n两者的关键区别是输出与验证方式：VLM 的回答质量不等于机器人执行成功；VLA 还要核对动作接口、数据约定，并在固定任务协议下检验真实行为。VLA 可以利用 VLM 的预训练能力，但并非所有 VLM 都能直接控制机器人。';
      } else if (/机器人.*(是什么|是啥)|什么是机器人/.test(text)) {
        body = '机器人是通过机械或其他物理执行机构感知环境并完成动作的系统；它可以采用预设控制，也可以使用学习策略。现有资料重点讨论学习型机器人：VLA 连接视觉、语言与动作，具身 Agent 则关注目标规划、短时动作和执行反馈。\n\n“有机器人载体”“使用 VLA”和“具备可靠智能”是不同判断，不能仅凭演示或流畅回答划等号。';
      } else if (/具身.*(是什么|是啥)|什么是具身/.test(text)) {
        body = '具身智能关注智能系统如何通过身体或机器人载体与环境形成感知、决策、行动和反馈的闭环。这里的学习资料重点是具身 Agent：高层组织目标或计划，低层输出短时动作，再用完成、失败或状态过期等反馈调整计划。\n\nVLA 是连接视觉、语言与动作的一类策略路线；分层 Agent 是系统组织方式，两者可以组合。分层本身不保证长程任务可靠，仍需检查接口一致性与执行失败。';
      } else {
        body = records.slice(0, 3).map(entry => `${entry.name}\n${entry.summary}\n${entry.details}`).join('\n\n');
      }
      if (!records.length) return {text: '本地已整理资料暂时没有足够条目支持这个概念。可以具体到 VLA、VLM、VLN、RAG、Agent、训练评测或 AI Infra；我不会把相近刊名或赛事名称当作技术定义。', sources: []};
      return {text: `${body}\n\n${records.every(entry => entry.sourceType === 'first-party-site-guide') ? '更完整的操作步骤与配置说明见下方本站手册。' : '可通过下方来源核查概念与方法；模型能力、许可和性能仍应结合原始实现与实际实验判断。'}`, sources: records.slice(0, 4).map(entry => source(entry, 'technical-knowledge'))};
    }
    function project(text) {
      const explicitDomain = domain(text);
      if (explicitDomain && explicitDomain !== memory.idea.domain) memory.idea = {domain: explicitDomain, selected: -1, stage: 0};
      if (!memory.idea.domain) memory.idea.domain = 'general';
      const choices = IDEAS[memory.idea.domain];
      const selection = text.match(/(?:第\s*([一二三123])\s*(?:个|条|项|种)?|([一二三123])\s*(?:号|方案|方向))/);
      if (selection) memory.idea.selected = {'一': 0, '二': 1, '三': 2, '1': 0, '2': 1, '3': 2}[selection[1] || selection[2]];
      const background = memory.background.length ? `沿用你提供的条件：${memory.background.slice(-3).join('；')}。\n\n` : '';
      const lowResource = memory.background.some(item => /没.{0,3}硬件|无硬件|零基础|初学|预算.{0,4}(低|少)|一人/.test(item));
      if (memory.idea.selected < 0) {
        return {text: `${background}可以先比较这三个范围较小的方向：\n\n${choices.map((choice, index) => `${index + 1}. ${choice.name}：${choice.problem}。最小原型是${choice.prototype}。`).join('\n\n')}\n\n${lowResource ? '按目前条件，优先使用公开授权资料或仿真，不把购置设备作为起点。' : '先选择一个方向，再确定最小原型与验证办法。'}这些是待验证的项目建议，不是已获奖案例。`, sources: []};
      }
      const choice = choices[memory.idea.selected];
      memory.idea.stage += 1;
      const next = memory.idea.stage === 1
        ? `第一步：明确使用者与问题——${choice.problem}。\n第二步：只做${choice.prototype}。\n第三步：${choice.test}。`
        : memory.idea.stage === 2
          ? `继续细化“${choice.name}”：\n1. 写下一个使用情境和一项可观察目标。\n2. 整理原型需要的输入、输出与资料授权，先排除无法取得的资源。\n3. 按“${choice.test}”制作测试清单，保留失败记录。`
          : `下一轮迭代仍围绕“${choice.name}”：先检查上一轮最主要的一个失败，再只修改一个因素，用相同任务重测。把观察、改动和证据记在一页记录中，避免在没有反馈时继续扩大功能。`;
      return {text: `${background}当前选择：${memory.idea.selected + 1}. ${choice.name}。\n\n${next}${lowResource ? '\n\n实施边界：先采用可获得的授权资料与低成本软件原型；确需硬件时再评估设备与安全条件。' : ''}\n\n这是项目推演，尚需真实用户和实验反馈验证。`, sources: []};
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
      if (!text) return {text: '请写下想了解的概念、目录名称或项目问题。', sources: []};
      const siteGuides = technical(text).filter(entry => entry.sourceType === 'first-party-site-guide');
      if (siteGuides.length && !sourceIntent(text)) return remember(explain(text, siteGuides), 'technical');
      if (/身份证|家庭住址|住哪|私人地址|密码|密钥|api.?key|未公开|私人电话|私密|内部数据|薪资/i.test(text)) return remember({text: '我只使用网站公开经历与已整理资料，不提供未公开的个人信息、账号凭据或单位内部数据。公开联系入口请查看个人主页。', sources: []}, 'privacy');
      if (/创享艺苑|平台介绍|介绍.*平台/.test(text)) return remember({text: PLATFORM, sources: []}, 'platform');
      if (/opc|一人公司/i.test(text)) return remember({text: 'OPC 是 One Person Company（一人公司）。赵子状用它描述自己的个人项目探索；他的原点学堂与原点夜校学习经历是另一件事。创享艺苑的公开定位是大学生创业者联盟。', sources: []}, 'profile');
      if (/创始人|赵子状/.test(text)) return remember({text: '赵子状是创享艺苑创始人，计算机专业背景，目前在千寻智能担任机器人端到端评测工程师，关注 VLA、具身智能与 Agent，并在原点学堂和原点夜校持续学习。更多公开经历可查看个人主页。', sources: []}, 'profile');
      if (/^(你好|哈喽|hello|hi)[！!。\s]*$/i.test(text)) return remember({text: '你好，我是小艺。可以查已整理的技术、竞赛与期刊资料，也可以一起缩小科创项目的范围。本地模式使用有限资料与规则，不是通用大模型。', sources: []}, 'greeting');
      if (sourceIntent(text)) {
        const result = sourceAnswer(text, messages);
        const scope = result.sources[0]?.kind;
        return remember(result, scope === 'technical-knowledge' ? 'technical' : scope || 'limited');
      }
      if (acknowledgement(text)) return {text: '好的，需要时可以继续问刚才的主题，也可以换一个问题。', sources: []};
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
      if (/\bskills?\b|技能包|技能是什么/i.test(text)) return remember({text: '当前本地资料没有单独核验 Agent Skill 的定义与实现规范。若你指某个平台的 Skill，请提供名称；我可以区分其任务说明、资源和执行接口，但不会把具身 Agent 的资料冒充该平台文档。', sources: []}, 'technical');
      if (!records.length && technicalFollowup(text)) {
        const active = activeEvidence(text, messages).filter(entry => entry.kind === 'technical-knowledge');
        records = /它们|二者|两者|这两个/.test(text) && memory.scope === 'technical' ? memory.technical.map(byId).filter(Boolean) : active;
      }
      if (/区别|比较|对比|关系|不同|vs\b/i.test(text) && records.length === 1 && memory.scope === 'technical' && (/它|它们|二者|两者|这两个/.test(text) || /vlm|vla/i.test(text) && memory.technical.some(id => ['tech-vla-foundation', 'tech-vlm-bridge'].includes(id)))) records = unique([...records, ...memory.technical.map(byId)]);
      if (records.length) return remember(explain(text, records), 'technical');
      if (definition) return remember(explain(text, []), 'technical');
      if (/航空|航天|卫星|飞机|飞行/.test(text)) return remember({text: '本地技术资料目前重点是 VLA、训练评测与 AI Infra，没有足够的航空航天专业条目。若是做科普项目，可以告诉我目标读者和主题；我能协助缩小原型范围，但不会编造专业事实或竞赛获奖案例。', sources: []}, 'limited');
      return remember({text: '可以具体到一个概念、赛事或刊名，也可以说明“帮助谁、解决什么问题”。本地模式仅检索已整理资料并提供有限的项目推演；超出资料范围时，我会说明缺口。', sources: []}, 'limited');
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
