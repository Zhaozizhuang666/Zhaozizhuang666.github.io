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
const ids = reply => reply.sources.map(source => source.id);
function conversation() {
  const engine = make(), messages = [];
  return {engine, messages, ask(content) { messages.push({role: 'user', content}); const result = engine.reply(content, messages); messages.push({role: 'assistant', content: result.text}); return result; }};
}

test('business direction query uses the public plan summary before generic Agent or fixed platform copy', () => {
  const result = make().reply('创享艺苑的AI Agent方向是什么？');
  assert.ok(ids(result).includes('venture-platform-direction'));
  assert.ok(ids(result).includes('venture-agent-skills'));
  assert.ok(result.sources.every(source => source.sourceType === 'owner-provided-business-plan'));
  assert.ok(result.sources.every(source => source.website === 'https://zhaozizhuang666.github.io/#community'));
  assert.match(result.text, /伙伴|计划/);
  assert.doesNotMatch(result.text, /当前平台没有|本地已整理资料暂时/);
  const embodiedDirection = make().reply('创享艺苑的具身智能方向是什么？');
  assert.match(embodiedDirection.text, /公开规划|公开计划/);
  assert.doesNotMatch(embodiedDirection.text, /具身智能关注智能系统/);
});

test('summary separates current foundations from planned applications and keeps the alliance boundary', () => {
  const foundation = make().reply('创享艺苑现有基础和未来规划');
  assert.ok(ids(foundation).includes('venture-foundations-status'));
  assert.match(foundation.text, /已搭建|规划|公开基础/);
  assert.match(foundation.text, /成果归属各自主体/);
  const platform = make().reply('创享艺苑的商业模式');
  assert.ok(ids(platform).includes('venture-platform-direction'));
  assert.match(platform.text, /大学生创业者联盟/);
  assert.match(platform.text, /OPC/);
  assert.match(platform.text, /不概括联盟/);
  assert.doesNotMatch(platform.text, /价格|元\/|收入预测|毛利|内部 SOP|财务/);
});

test('plain platform introduction and generic Agent definition preserve their existing scopes', () => {
  const platform = make().reply('介绍一下创享艺苑');
  assert.equal(platform.sources.length, 0);
  assert.ok(platform.text.endsWith('创始人：赵子状。'));
  const agent = make().reply('Agent是什么？');
  assert.ok(agent.sources.every(source => source.id !== 'venture-platform-direction'));
  assert.ok(agent.sources.some(source => source.id === 'tech-tool-agent'));
});

test('business summary source follow-up returns community section without stale technical evidence', () => {
  const chat = conversation();
  chat.ask('创享艺苑的具身智能应用有哪些？');
  const source = chat.ask('给我链接');
  assert.ok(source.sources.length > 0);
  assert.ok(source.sources.every(item => item.website === 'https://zhaozizhuang666.github.io/#community'));
  assert.match(source.text, /#community/);
  assert.ok(ids(source).every(id => id.startsWith('venture-')));
});

test('direct business source questions also return the public summary link', () => {
  const result = make().reply('创享艺苑的 AI Agent 方向链接');
  assert.ok(result.sources.length > 0);
  assert.ok(result.sources.every(item => item.website === 'https://zhaozizhuang666.github.io/#community'));
  assert.match(result.text, /#community/);
});

test('server retrieval exposes the owner-provided business plan records and source type', () => {
  const direct = retrieveKnowledge([{role: 'user', content: '创享艺苑的AI Agent方向'}]);
  assert.ok(direct.records.some(record => record.id === 'venture-agent-skills'));
  assert.ok(direct.records.some(record => record.sourceType === 'owner-provided-business-plan'));
  assert.ok(direct.sources.some(source => source.website === 'https://zhaozizhuang666.github.io/#community'));
  const plan = direct.records.find(record => record.id === 'venture-agent-skills');
  assert.deepEqual(plan.sourceDocuments.map(document => document.url), [
    'https://zhaozizhuang666.github.io/assets/documents/chuangxiang-business-plan.docx',
    'https://zhaozizhuang666.github.io/assets/documents/chuangxiang-business-model.pptx',
    'https://zhaozizhuang666.github.io/assets/documents/chuangxiang-business-model.pdf'
  ]);
  const followed = retrieveKnowledge([
    {role: 'user', content: '创享艺苑的AI Agent方向'},
    {role: 'assistant', content: '摘要'},
    {role: 'user', content: '给我链接'}
  ]);
  assert.ok(followed.records.some(record => record.id === 'venture-agent-skills'));
  assert.ok(followed.sources.some(source => source.sourceType === 'owner-provided-business-plan'));
});

test('memory usage questions route to the site guide without intercepting general Agent memory concepts', () => {
  for (const prompt of ['记忆流怎么用？', '如何使用记忆流？', '小艺怎么恢复对话？', '清空记忆']) {
    const result = make().reply(prompt);
    assert.ok(ids(result).includes('site-guide-xiaoyi-memory'), prompt);
    assert.match(result.text, /Continue|Clear all/);
  }
  assert.ok(!ids(make().reply('Agent 的长期记忆是什么？')).includes('site-guide-xiaoyi-memory'));
  assert.ok(!ids(make().reply('机器人记忆机制如何评测？')).includes('site-guide-xiaoyi-memory'));
});
