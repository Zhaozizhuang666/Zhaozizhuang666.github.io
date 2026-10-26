import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {retrieveKnowledge} from '../server/knowledge.mjs';

const code = fs.readFileSync(new URL('../xiaoyi-engine.js', import.meta.url), 'utf8');
const data = Object.fromEntries(['competitions', 'journals', 'technical-knowledge'].map(kind => [kind, JSON.parse(fs.readFileSync(new URL(`../data/${kind}.json`, import.meta.url), 'utf8'))]));
const sandbox = {window: {}};
vm.runInNewContext(code, sandbox);
const make = () => sandbox.window.XiaoyiEngine.create({data});
function conversation(engine = make()) {
  const messages = [];
  return {engine, ask(text) { messages.push({role: 'user', content: text}); const result = engine.reply(text, messages); messages.push({role: 'assistant', content: result.text}); return result; }, messages};
}
const ids = reply => Array.from(reply.sources, source => source.id);
const technicalSources = reply => assert.ok(reply.sources.length && reply.sources.every(source => source.kind === 'technical-knowledge' && source.website && source.sourceLocation));

test('learning entry navigation remains distinct from conceptual VLA explanations', () => {
  for (const [query, id] of [
    ['VLA Guide 入口在哪？', 'learning-vla-guide'],
    ['Where can I open VLA Guide?', 'learning-vla-guide'],
    ['AI算力中心网络学习资源在哪里？', 'learning-ai-network'],
    ['学习资源怎么使用？', 'site-guide-learning-resources'],
  ]) assert.ok(ids(make().reply(query)).includes(id), query);
  assert.ok(ids(make().reply('VLA是什么？')).includes('tech-vla-foundation'));
});

test('domestic model website request returns all external links without implying API access', () => {
  const chat = conversation();
  const result = chat.ask('给我目前国内大模型网站链接');
  assert.equal(result.sources.length, 6);
  assert.deepEqual(result.sources.map(source => source.name), ['DeepSeek', '通义千问', 'Kimi', '豆包', '智谱清言', '腾讯元宝']);
  assert.match(result.text, /外部网站/);
  assert.match(result.text, /Xiaoyi 当前仅使用本地知识模式/);
  const followup = chat.ask('把链接给我');
  assert.equal(followup.sources.length, 6);
  assert.ok(followup.text.includes('https://yuanbao.tencent.com/'));
});

test('personal course materials override profile and competition menus with accurate sources', () => {
  for (const [query, id, path, expected] of [
    ['介绍一下赵子状的6G研修经历', 'profile-6g-course-paper', '6g-data-flows-embodied-ai-course-paper.pdf', /研修论文/],
    ['把6G研修报道链接给我', 'profile-6g-training-story', 'mp.weixin.qq.com/s/E-2veNzXsiRZpJQ-XQ2a4g', /研修/],
  ]) {
    const chat = conversation();
    const result = chat.ask(query);
    assert.deepEqual(ids(result), [id], query);
    assert.match(result.text, expected);
    assert.ok(result.sources[0].website.endsWith(path));
    const source = chat.ask('把链接给我');
    assert.deepEqual(ids(source), [id]);
    assert.ok(source.text.includes(path));
    const server = retrieveKnowledge(chat.messages);
    assert.deepEqual(ids(server), [id], `server ${query}`);
    assert.equal(server.records[0].sourceType, result.sources[0].sourceType);
  }
  const course = make().reply('6G研修论文介绍');
  assert.match(course.text, /未作为已发表期刊论文或结业证书展示/);
});

test('classic browser factory has no DOM dependency and loads all three actual schemas once', async () => {
  const paths = [];
  const engine = sandbox.window.XiaoyiEngine.create({fetch: async path => { paths.push(path); return {ok: true, json: async () => data[path.slice(5, -5)]}; }});
  assert.deepEqual(Object.keys(engine).sort(), ['context', 'loadData', 'reply', 'reset']);
  await Promise.all([engine.loadData(), engine.loadData()]);
  assert.equal(paths.length, 3);
  technicalSources(engine.reply('VLM 是什么？'));
  await engine.loadData();
  assert.equal(paths.length, 3);
});

test('VLA → VLM → embodied intelligence stays conceptual and cites actual technical entries', () => {
  const chat = conversation();
  const first = chat.ask('VLA 是什么？');
  assert.ok(ids(first).includes('tech-vla-foundation'));
  const second = chat.ask('那VLM呢？');
  assert.ok(ids(second).includes('tech-vlm-bridge'));
  assert.match(second.text, /视觉编码器|图像特征/);
  const third = chat.ask('具身智能是什么？');
  assert.match(third.text, /感知、决策、行动和反馈/);
  assert.ok(ids(third).includes('tech-embodied-agent'));
  for (const reply of [first, second, third]) { technicalSources(reply); assert.doesNotMatch(reply.text, /以下三个方向适合开展小范围验证|校内|期刊/); }
});

test('VLN definition, source request and evaluation stay connected for three turns', () => {
  const chat = conversation();
  const definition = chat.ask('什么是VLN');
  assert.deepEqual(ids(definition), ['tech-vln-foundation']);
  assert.match(definition.text, /Vision-and-Language Navigation/);
  assert.match(definition.text, /自然语言指令和视觉观察/);
  assert.equal(definition.sources[0].sourceType, 'primary-paper');
  const source = chat.ask('好的那把链接给我');
  assert.deepEqual(ids(source), ['tech-vln-foundation']);
  assert.match(source.text, /https:\/\/arxiv\.org\/abs\/1711\.07280/);
  assert.doesNotMatch(source.text, /请提供具体概念/);
  const evaluation = chat.ask('怎么评测它？');
  assert.deepEqual(ids(evaluation), ['tech-vln-evaluation', 'tech-vln-foundation']);
  assert.match(evaluation.text, /SR.*SPL/s);
  assert.match(evaluation.text, /路径效率/);
});

test('English source requests retain the VLN paper in replies, context, and server retrieval', () => {
  for (const prompt of [
    'Please give me the link',
    'Which paper defines this?',
    'Which source should I read?',
    'Can you send me the link?',
    'Please share the source.',
    'Where can I read the paper?',
  ]) {
    const chat = conversation();
    chat.ask('What is VLN?');
    chat.ask('Thanks!');
    const history = [...chat.messages, {role: 'user', content: prompt}];
    const fresh = make();
    const before = JSON.stringify(fresh.context('unrelated').conversation);
    assert.deepEqual(ids(fresh.context(prompt, history)), ['tech-vln-foundation'], `${prompt}: context`);
    assert.equal(JSON.stringify(fresh.context('unrelated').conversation), before, 'source context must not mutate conversation state');
    const serverSources = retrieveKnowledge(history).sources;
    assert.ok(ids({sources: serverSources}).includes('tech-vln-foundation'), `${prompt}: server`);
    assert.ok(serverSources.every(source => source.sourceType === 'primary-paper'), `${prompt}: server source types`);
    for (const reply of [chat.ask(prompt), fresh.reply(prompt, history)]) {
      assert.deepEqual(ids(reply), ['tech-vln-foundation'], prompt);
      assert.match(reply.text, /https:\/\/arxiv\.org\/abs\/1711\.07280/);
      assert.equal(reply.sources[0].sourceType, 'primary-paper');
    }
  }
});

test('English source follow-ups stop at an unknown topic and switch to an explicitly named topic', () => {
  for (const prompt of ['Please give me the link', 'Which paper defines this?', 'Which source should I read?']) {
    const chat = conversation();
    chat.ask('What is VLN?');
    chat.ask('What is quantum gravity?');
    const history = [...chat.messages, {role: 'user', content: prompt}];
    const fresh = make();
    assert.deepEqual(ids(fresh.context(prompt, history)), [], `${prompt}: context boundary`);
    assert.deepEqual(ids(retrieveKnowledge(history)), [], `${prompt}: server boundary`);
    for (const reply of [chat.ask(prompt), fresh.reply(prompt, history)]) {
      assert.equal(reply.sources.length, 0, prompt);
      assert.doesNotMatch(reply.text, /1711\.07280/);
    }
  }
  const chat = conversation();
  chat.ask('What is VLN?');
  const newSource = chat.ask('Please give me the VLA paper');
  assert.deepEqual(ids(newSource), ['tech-vla-foundation']);
  assert.doesNotMatch(newSource.text, /1711\.07280/);
  const unknownSource = chat.ask('Show me sources about quantum gravity');
  assert.deepEqual(ids(unknownSource), []);
  assert.equal(retrieveKnowledge(chat.messages).records.length, 0);
});

test('expanded core topics answer with the relevant primary paper and recover source-only history', () => {
  for (const [query, id] of [
    ['RAG是什么', 'tech-retrieval-augmented-generation'],
    ['工具调用 Agent 是什么', 'tech-tool-agent'],
    ['模仿学习是什么', 'tech-imitation-learning'],
    ['强化学习是什么', 'tech-reinforcement-learning'],
    ['Diffusion Policy是什么', 'tech-diffusion-policy'],
    ['域随机化是什么', 'tech-sim-to-real'],
  ]) {
    const chat = conversation(), first = chat.ask(query);
    assert.ok(ids(first).includes(id), query);
    assert.equal(first.sources.find(source => source.id === id).sourceType, 'primary-paper');
    const history = [...chat.messages, {role: 'user', content: '好的'}, {role: 'assistant', content: '好的'}];
    const fresh = make(), before = JSON.stringify(fresh.context('无关').conversation);
    const context = fresh.context('给我原文链接', history);
    assert.ok(ids(context).includes(id), query);
    assert.equal(JSON.stringify(fresh.context('无关').conversation), before);
    const source = fresh.reply('给我原文链接', history);
    assert.ok(ids(source).includes(id), query);
    assert.match(source.text, /https:\/\/arxiv\.org\/abs\//);
  }
});

test('source followups do not reuse evidence after unknown topic or platform switch', () => {
  for (const newTopic of ['量子引力是什么', '介绍一下创享艺苑', '我想做航空科普项目']) {
    const chat = conversation();
    chat.ask('VLN是什么');
    chat.ask(newTopic);
    const source = chat.ask('给我链接');
    assert.equal(source.sources.length, 0, newTopic);
    assert.doesNotMatch(source.text, /1711\.07280/);
  }
});

test('site usage and model setup questions cite first-party guide instead of project brainstorming', () => {
  for (const [query, id, expected] of [
    ['网站怎么使用', 'site-guide-usage', /顶部导航/],
    ['怎么切换主题', 'site-guide-theme', /Light.*Dark/s],
    ['小艺怎么用', 'site-guide-xiaoyi', /默认.*右侧/s],
    ['知识库怎么用', 'site-guide-library', /关键词与批次/],
    ['怎么接入模型', 'site-guide-models', /服务端环境变量/],
  ]) {
    const result = make().reply(query);
    assert.ok(ids(result).includes(id), query);
    assert.match(result.text, expected);
    assert.ok(result.sources.every(source => source.sourceType === 'first-party-site-guide'));
    assert.match(result.sources[0].website, /guide\.html#/);
    assert.doesNotMatch(result.text, /以下三个方向适合开展小范围验证/);
  }
});

test('natural provider setup questions resolve through the engine and cite deployment guidance', () => {
  for (const query of [
    'Xiaoyi 如何接入豆包？', '小艺怎么配置豆包？', '豆包怎么接入？',
    '小艺如何使用火山方舟？', '火山方舟怎么接入？', '我要配置 GLM',
    'GLM 怎么配置？', '小艺如何切换到 GLM-5.3？',
    '如何接入 Kimi K3？', 'TokenHub 怎么接入？', '我想让 Xiaoyi 连接腾讯 TokenHub',
    'How do I connect Xiaoyi to GLM?', 'How can Xiaoyi connect to Doubao?',
  ]) {
    const result = make().reply(query);
    assert.ok(ids(result).includes('site-guide-models'), query);
    assert.ok(ids(result).includes('site-guide-model-providers'), query);
    assert.match(result.text, /独立部署 Worker/);
    assert.match(result.text, /未配置在线模型端点|没有已部署在线端点/);
    assert.match(result.text, /glm\s*\/\s*glm-5\.3/);
    assert.ok(result.sources.every(source => source.sourceType === 'first-party-site-guide'));
    assert.ok(result.sources.every(source => /guide\.html#models$/.test(source.website)));
    assert.doesNotMatch(result.text, /帮助谁、解决什么问题|以下三个方向适合开展小范围验证|本地资料暂未收录/);
    const server = retrieveKnowledge([{role: 'user', content: query}]);
    assert.ok(server.records.some(record => /^site-guide-model/.test(record.id)), `server: ${query}`);
  }
});

test('provider setup keeps input limits and source followups without carrying a prior technical topic', () => {
  const chat = conversation();
  chat.ask('什么是 VLN？');
  const setup = chat.ask('Xiaoyi 如何接入豆包并使用图片？');
  assert.ok(ids(setup).includes('site-guide-model-inputs'));
  assert.match(setup.text, /最多一个|最多.{0,3}一个/);
  assert.match(setup.text, /聊天界面目前仅支持文本/);
  const links = chat.ask('把链接给我');
  assert.ok(links.sources.length > 0);
  assert.ok(links.sources.every(source => /guide\.html#models$/.test(source.website)));
  assert.doesNotMatch(links.text, /1711\.07280/);
  const technical = chat.ask('VLN 怎么评测？');
  assert.ok(ids(technical).includes('tech-vln-evaluation'));
  assert.ok(technical.sources.every(source => source.sourceType !== 'first-party-site-guide'));
});

test('three-round comparison preserves VLA/VLM context, then handles an explicit training comparison independently', () => {
  const chat = conversation();
  chat.ask('介绍 VLA');
  chat.ask('那 VLM 呢');
  const compared = chat.ask('它们有什么区别？');
  assert.deepEqual(ids(compared), ['tech-vlm-bridge', 'tech-vla-foundation']);
  assert.match(compared.text, /VLM.*VLA/s);
  const training = chat.ask('训练和推理有什么区别？');
  assert.deepEqual(ids(training), ['tech-training-vs-inference']);
  assert.doesNotMatch(training.text, /VLA/);
});

test('knowledge aliases work across three rounds per technical domain', () => {
  for (const prompts of [
    [['视觉语言模型是什么', 'tech-vlm-bridge'], ['Vision Language Action 是什么', 'tech-vla-foundation'], ['Embodied Agent 是什么', 'tech-embodied-agent']],
    [['LoRA怎么理解', 'tech-vla-action-interface'], ['VLA评测怎么做', 'tech-robot-e2e-evaluation'], ['checkpoint如何恢复', 'tech-training-reproducibility']],
    [['FSDP是什么', 'tech-distributed-strategy'], ['KV Cache是什么', 'tech-kv-cache'], ['TTFT是什么意思', 'tech-inference-metrics']],
    [['GPU选型考虑什么', 'tech-gpu-resources'], ['CUDA是什么', 'tech-cuda-operators'], ['AllReduce是什么', 'tech-training-network']],
  ]) {
    const chat = conversation();
    for (const [prompt, id] of prompts) { const reply = chat.ask(prompt); assert.ok(ids(reply).includes(id), `${prompt}: ${ids(reply)}`); technicalSources(reply); }
  }
});

test('three-round project follows selected direction and background without repeating option menu', () => {
  const chat = conversation();
  const menu = chat.ask('我是大二，会Python，一个人没有硬件，想做航空航天类项目');
  assert.match(menu.text, /1\. 卫星与生活/);
  const choice = chat.ask('第二个方向');
  assert.match(choice.text, /当前选择：2\. 航空学习资料助手/);
  assert.match(choice.text, /大二|Python/);
  assert.doesNotMatch(choice.text, /以下三个方向适合开展小范围验证/);
  const next = chat.ask('继续，怎么验证？');
  assert.match(next.text, /航空学习资料助手/);
  assert.match(next.text, /测试清单/);
  assert.notEqual(next.text, choice.text);
  assert.doesNotMatch(next.text, /纸飞机实验科普/);
});

test('first/second options can switch and retain the project identity over three rounds', () => {
  const chat = conversation();
  chat.ask('我想做机器人项目，预算不多');
  const first = chat.ask('第一个');
  assert.match(first.text, /机器人失败片段整理工具/);
  const second = chat.ask('换第二个方案');
  assert.match(second.text, /具身智能互动科普/);
  assert.doesNotMatch(second.text, /当前选择：1/);
  assert.match(chat.ask('下一步怎么开始').text, /具身智能互动科普/);
});

test('definition interrupts project brainstorming, then project follow-up resumes chosen idea', () => {
  const chat = conversation();
  chat.ask('我想做机器人项目');
  chat.ask('第一个');
  const definition = chat.ask('VLA是什么？');
  assert.ok(ids(definition).includes('tech-vla-foundation'));
  assert.doesNotMatch(definition.text, /当前选择/);
  const continued = chat.ask('继续展开');
  assert.ok(ids(continued).includes('tech-vla-foundation'));
  assert.doesNotMatch(continued.text, /当前选择/);
  assert.match(chat.ask('回到项目，下一步').text, /机器人失败片段整理工具/);
});

test('journal → robot definition → VLM avoids generic noun matching a journal', () => {
  const chat = conversation();
  const journal = chat.ask('查询机器人期刊');
  assert.ok(journal.sources.some(source => source.kind === 'journals'));
  const robot = chat.ask('机器人是什么？');
  assert.match(robot.text, /物理执行机构/);
  technicalSources(robot);
  assert.ok(ids(robot).every(id => id.startsWith('tech-')));
  const vlm = chat.ask('那VLM呢？');
  assert.ok(ids(vlm).includes('tech-vlm-bridge'));
});

test('competition → deadline follow-up → technical scope preserves only relevant evidence', () => {
  const chat = conversation();
  const competition = chat.ask('电赛有哪些信息？');
  assert.ok(competition.sources.some(source => source.name === '全国大学生电子设计竞赛'));
  const deadline = chat.ask('那报名截止时间呢？');
  assert.match(deadline.text, /尚未完整收录/);
  assert.equal(deadline.sources[0].id, competition.sources[0].id);
  const gpu = chat.ask('GPU是什么？');
  technicalSources(gpu);
  assert.ok(ids(gpu).includes('tech-gpu-resources'));
});

test('explicit directories beat broad technical aliases and retain batch limitations', () => {
  const chat = conversation();
  chat.ask('VLA是什么？');
  const journal = chat.ask('第一批期刊有哪些？');
  assert.equal(journal.sources.length, 4);
  assert.ok(journal.sources.every(source => source.kind === 'journals' && source.batch === '第一批'));
  assert.match(journal.text, /不等同核心期刊/);
  const competition = chat.ask('蓝桥杯比赛介绍');
  assert.ok(competition.sources.length > 0);
  assert.ok(competition.sources.every(source => source.kind === 'competitions'));
});

test('platform has exact official ending, privacy remains bounded, OPC is not school', () => {
  const chat = conversation();
  const platform = chat.ask('介绍一下创享艺苑');
  assert.ok(platform.text.endsWith('创始人：赵子状。'));
  assert.doesNotMatch(platform.text, /OPC|一人公司|不能/);
  assert.match(chat.ask('赵子状的私人地址和API Key是什么').text, /不提供未公开/);
  const opc = chat.ask('OPC是什么');
  assert.match(opc.text, /One Person Company/);
  assert.match(opc.text, /独立于原点学堂与原点夜校的学习经历/);
});

test('limited topics, Skill and missing data are honest across three rounds', () => {
  const chat = conversation();
  assert.match(chat.ask('量子引力是什么').text, /暂未收录足以解释该概念的条目/);
  assert.match(chat.ask('Agent Skill是什么').text, /尚未收录经核验的 Agent Skill/);
  assert.match(chat.ask('解释一下所有最新模型能力').text, /暂未收录足以解释该概念的条目/);
  const empty = sandbox.window.XiaoyiEngine.create({data: {}});
  assert.match(empty.reply('VLA是什么').text, /暂未收录足以解释该概念的条目/);
  assert.equal(empty.reply('VLA是什么').sources.length, 0);
});

test('context is bounded, carries actual technical evidence, reset clears retained direction', () => {
  const chat = conversation();
  chat.ask('我大二会Python，想做机器人项目');
  chat.ask('第二个');
  chat.ask('VLM是什么');
  const context = chat.engine.context('VLA和VLM有什么区别', chat.messages);
  assert.equal(context.localMode, 'curated-retrieval');
  assert.ok(context.sources.every(source => source.kind === 'technical-knowledge'));
  assert.equal(context.conversation.idea.selected, '具身智能互动科普');
  assert.ok(context.sources.length <= 4);
  chat.engine.reset();
  assert.equal(chat.engine.context('继续').conversation.idea, null);
  assert.doesNotMatch(chat.engine.reply('下一步').text, /具身智能互动科普/);
});

test('directory context returns the same sample sources as replies without advancing conversation memory', () => {
  const chat = conversation();
  const technical = chat.ask('VLA是什么？');
  const before = JSON.stringify(chat.engine.context('继续').conversation);
  for (const [query, kind, batch] of [
    ['有哪些学科竞赛？', 'competitions', ''],
    ['推荐一些国家第一批期刊', 'journals', '第一批'],
    ['第二批期刊有哪些？', 'journals', '第二批'],
  ]) {
    const context = chat.engine.context(query, chat.messages);
    assert.equal(context.sources.length, 4, query);
    assert.ok(context.sources.every(source => source.kind === kind && (!batch || source.batch === batch)));
    const expected = conversation().ask(query);
    assert.equal(ids(context).join(','), ids(expected).join(','));
    assert.equal(JSON.stringify(context.conversation), before, 'context reads must not change scope or project state');
  }
  const retained = chat.engine.context('继续', chat.messages);
  assert.equal(ids(retained).join(','), ids(technical).join(','), 'previewing directory samples must not replace remembered evidence');
  assert.equal(chat.engine.context('查询不存在的胡萝卜期刊').sources.length, 0);
});

test('Internet+ Unicode variants and short competition names resolve to concise sourced answers', () => {
  for (const query of ['互联网+', '互联网＋', '互联网✚', '互联网➕', '互联网﹢', '互联网✚是什么？']) {
    const engine = make(), result = engine.reply(query);
    assert.deepEqual(ids(result), ['sxit-competition-001'], query);
    assert.match(result.text, /中国国际大学生创新大赛/);
    assert.match(result.text, /创新与创业项目/);
    assert.match(result.text, /检索入口，尚未核验为官网/);
    assert.doesNotMatch(result.text, /请提供具体概念|Sheet1|A2:D2|主办单位|中央委员会/);
    assert.ok(result.sources[0].sourceLocation.includes('Sheet1!'), 'provenance remains in metadata');
    assert.equal(ids(engine.context(query)).join(','), ids(result).join(','));
  }
  for (const query of ['计算机设计大赛', '计设大赛', '计设大赛是什么？']) {
    const result = make().reply(query);
    assert.deepEqual(ids(result), ['sxit-competition-024']);
    assert.match(result.text, /中国大学生计算机设计大赛/);
    assert.match(result.text, /计算机应用与数字作品/);
    assert.match(result.text, /https:\/\/jsjds\.blcu\.edu\.cn\/index\.htm/);
    assert.match(result.text, /校内分级：山西工学院 B1 类/);
    assert.ok(result.text.length < 500);
    assert.doesNotMatch(result.text, /Sheet1|主办单位|教育部高等学校/);
    assert.equal(result.sources[0].urlType, 'official');
  }
  assert.equal(make().reply('大广赛').sources[0].name, '全国大学生广告艺术大赛');
});

test('competition registration, preparation and fit followups stay on the named record across turns', () => {
  for (const name of ['互联网✚', '计算机设计大赛', '计设大赛']) {
    const chat = conversation();
    const first = chat.ask(name), id = first.sources[0].id, title = first.sources[0].name;
    const registration = chat.ask('如何报名？');
    assert.deepEqual(ids(registration), [id]);
    assert.ok(registration.text.includes(title));
    assert.match(registration.text, /尚未完整收录|不能由目录补全/);
    const preparation = chat.ask('如何准备？');
    assert.deepEqual(ids(preparation), [id]);
    assert.ok(preparation.text.includes(title));
    assert.match(preparation.text, /准备建议；已核验的提交清单尚未收录/);
    assert.notEqual(preparation.text, registration.text);
    const fit = chat.ask('它适合我吗？');
    assert.deepEqual(ids(fit), [id]);
    assert.ok(fit.text.includes(title));
    assert.match(fit.text, /资料不足以确认|年级、专业/);
    for (const result of [registration, preparation, fit]) assert.doesNotMatch(result.text, /请提供具体概念|Sheet1|主办单位（源表）/);
  }
});

test('natural preparation questions keep the contest through registration and freshly reconstructed online history', () => {
  for (const prompt of ['需要准备什么？', '需要准备什么材料？', '要准备哪些资料？', '应该做什么准备？', '那么，我需要准备什么呢？']) {
    const chat = conversation();
    chat.ask('计算机设计大赛是什么？');
    chat.ask('怎么报名？');
    const fresh = make();
    const before = JSON.stringify(fresh.context('无关输入').conversation);
    const preview = fresh.context(prompt, chat.messages);
    assert.deepEqual(ids(preview), ['sxit-competition-024'], prompt);
    assert.equal(JSON.stringify(fresh.context('无关输入').conversation), before);
    const recovered = fresh.reply(prompt, [...chat.messages, {role: 'user', content: prompt}]);
    const preparation = chat.ask(prompt);
    for (const result of [preparation, recovered]) {
      assert.deepEqual(ids(result), ['sxit-competition-024'], prompt);
      assert.match(result.text, /中国大学生计算机设计大赛/);
      assert.match(result.text, /可运行演示、测试记录/);
      assert.match(result.text, /准备建议；已核验的提交清单尚未收录/);
      assert.match(result.text, /https:\/\/jsjds\.blcu\.edu\.cn\/index\.htm/);
      assert.doesNotMatch(result.text, /请提供具体概念|尚未完整收录/);
    }
  }
});

test('preparation wording in a new subject does not carry old competition evidence', () => {
  for (const newTopic of ['出国旅行需要准备什么？', '面试需要准备哪些材料？', 'VLA训练需要准备什么？']) {
    const chat = conversation();
    chat.ask('计算机设计大赛是什么？');
    chat.ask('怎么报名？');
    const switched = chat.ask(newTopic);
    assert.ok(switched.sources.every(source => source.kind !== 'competitions'), newTopic);
    const followup = chat.ask('需要准备什么？');
    assert.ok(followup.sources.every(source => source.kind !== 'competitions'), newTopic);
    assert.doesNotMatch(followup.text, /计算机设计大赛/);
  }
});

test('three-turn competition switches, conceptual questions and unknown topics do not reuse stale records', () => {
  const chat = conversation();
  assert.deepEqual(ids(chat.ask('互联网＋')), ['sxit-competition-001']);
  assert.deepEqual(ids(chat.ask('计算机设计大赛')), ['sxit-competition-024']);
  const prepare = chat.ask('怎么准备？');
  assert.match(prepare.text, /可运行演示、测试记录/);
  assert.doesNotMatch(prepare.text, /中国国际大学生创新大赛/);
  assert.ok(ids(chat.ask('VLA是什么？')).includes('tech-vla-foundation'));
  const unknown = chat.ask('那量子引力呢？');
  assert.equal(unknown.sources.length, 0);
  assert.doesNotMatch(unknown.text, /计算机设计大赛|创新大赛/);
  const journal = chat.ask('第一批期刊有哪些？');
  assert.ok(journal.sources.every(source => source.kind === 'journals'));
  assert.deepEqual(ids(chat.ask('互联网✚怎么准备？')), ['sxit-competition-001']);
});

test('fresh engines recover directory followups from online history without mutating context state', () => {
  const messages = [{role: 'user', content: '计算机设计大赛'}, {role: 'assistant', content: '在线模型的介绍'}];
  for (const prompt of ['报名', '如何准备', '它适合我吗']) {
    const engine = make();
    messages.push({role: 'user', content: prompt});
    const before = JSON.stringify(engine.context('无关输入').conversation);
    const context = engine.context(prompt, messages);
    assert.deepEqual(ids(context), ['sxit-competition-024']);
    assert.equal(JSON.stringify(context.conversation), before);
    const result = engine.reply(prompt, messages);
    assert.deepEqual(ids(result), ids(context));
    messages.push({role: 'assistant', content: result.text});
  }
  const stale = make();
  stale.reply('计算机设计大赛');
  const switched = [...messages, {role: 'user', content: 'GPU是什么？'}, {role: 'assistant', content: '在线技术解释'}, {role: 'user', content: '那它呢？'}];
  const context = stale.context('那它呢？', switched);
  assert.ok(ids(context).includes('tech-gpu-resources'));
  assert.ok(context.sources.every(source => source.kind === 'technical-knowledge'));
});

test('ordinal selection in online directory history persists into registration followup', () => {
  const messages = [{role: 'user', content: '有哪些学科竞赛？'}, {role: 'assistant', content: '目录示例'}, {role: 'user', content: '第二个'}, {role: 'assistant', content: '第二项介绍'}, {role: 'user', content: '如何报名？'}];
  const engine = make(), result = engine.reply('如何报名？', messages);
  assert.deepEqual(ids(result), ['sxit-competition-002']);
  assert.match(result.text, /挑战杯/);
  assert.equal(ids(engine.context('如何报名？', messages)).join(','), ids(result).join(','));
});
