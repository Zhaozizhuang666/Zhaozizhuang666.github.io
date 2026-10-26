import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../xiaoyi-engine.js', import.meta.url), 'utf8');
function load(window = {}) { const sandbox = {window}; vm.runInNewContext(code, sandbox); return sandbox.window.XiaoyiMemory; }
function storage(initial) {
  const values = new Map(initial ? Object.entries(initial) : []);
  return {values, getItem(key) { return values.get(key) ?? null; }, setItem(key, value) { values.set(key, value); }};
}

test('memory stream persists the current tab conversation and resumes only explicitly', () => {
  const Memory = load(), saved = storage();
  const first = Memory.create({storage: saved});
  first.remember('VLA 是什么？', '回答一');
  first.remember('怎么评测？', '回答二');
  assert.equal(first.count(), 2);
  const reloaded = Memory.create({storage: saved});
  assert.deepEqual(JSON.parse(JSON.stringify(reloaded.messages())), [
    {role: 'user', content: 'VLA 是什么？'}, {role: 'assistant', content: '回答一'},
    {role: 'user', content: '怎么评测？'}, {role: 'assistant', content: '回答二'}
  ]);
  const prior = reloaded.list()[0];
  reloaded.startNew();
  assert.equal(reloaded.messages().length, 0, 'a new visit does not auto-merge prior sessions');
  assert.equal(reloaded.resume(prior.conversationId), true);
  assert.equal(reloaded.messages().length, 4, 'the stream can explicitly resume an older session');
});

test('default tab-session storage restores reloads but does not read a shared browser stream', () => {
  const shared = storage(), tabA = storage(), tabB = storage();
  let localReads = 0;
  const oldKey = 'xiaoyi-memory-v1';
  const legacy = {version: 1, enabled: true, activeConversation: 'old', entries: [{id: 'old', conversationId: 'old', user: 'private legacy question', assistant: 'private legacy answer'}]};
  shared.setItem(oldKey, JSON.stringify(legacy));
  const page = sessionStorage => ({sessionStorage, get localStorage() { localReads++; return shared; }});
  const a = load(page(tabA)).create();
  assert.equal(a.count(), 0, 'old persistent records are neither read nor migrated');
  a.remember('visitor A private question', 'visitor A answer');
  assert.equal(load(page(tabA)).create().count(), 1, 'same-tab reload and navigation reuse session storage');
  const b = load(page(tabB)).create();
  assert.equal(b.count(), 0, 'a separate normal tab cannot see visitor A records');
  assert.equal(b.recall('visitor A').length, 0);
  b.remember('visitor B private question', 'visitor B answer');
  assert.equal(load(page(tabA)).create().recall('visitor B').length, 0, 'tab A cannot read tab B records');
  assert.equal(load(page(storage())).create().count(), 0, 'a fresh page session starts empty');
  assert.equal(localReads, 0, 'memory never accesses browser-wide localStorage');
  assert.ok(tabA.values.has('xiaoyi-memory-session-v2'));
  assert.equal(shared.values.get(oldKey), JSON.stringify(legacy), 'legacy records are not copied or modified');
});

test('blocked default session storage stays in page memory without falling back to shared storage', () => {
  let localReads = 0;
  const Memory = load({get sessionStorage() { throw Error('blocked'); }, get localStorage() { localReads++; return storage(); }});
  const currentPage = Memory.create();
  currentPage.remember('private question', 'private answer');
  assert.equal(currentPage.count(), 1);
  assert.equal(currentPage.isPersistent(), false);
  assert.equal(Memory.create().count(), 0, 'a new page instance cannot recover unavailable storage');
  assert.equal(localReads, 0);
});

test('a restored cached page rereads the current tab session after another page clears it', () => {
  const saved = storage(), Memory = load({sessionStorage: saved});
  const cachedPage = Memory.create();
  cachedPage.remember('private question', 'private answer');
  const nextPage = Memory.create();
  nextPage.clear();
  cachedPage.reload();
  assert.equal(cachedPage.count(), 0, 'BFCache restoration cannot revive cleared records');
  assert.equal(cachedPage.messages().length, 0);
  nextPage.setEnabled(false);
  cachedPage.reload();
  assert.equal(cachedPage.isEnabled(), false, 'restoration also applies the current save preference');
});

test('memory remains bounded, sanitizes empty turns, and supports deleting or clearing records', () => {
  const Memory = load(), saved = storage(), memory = Memory.create({storage: saved});
  for (let index = 0; index < 40; index += 1) memory.remember(`question-${index}`, 'x'.repeat(7000));
  assert.ok(memory.count() <= Memory.limits.maxEntries);
  const payload = saved.values.get(Memory.key);
  assert.ok(payload.length <= Memory.limits.maxTotalBytes + 1000);
  assert.equal(memory.remember('', 'ignored'), null);
  const item = memory.list()[0];
  assert.equal(memory.remove(item.id), true);
  assert.equal(memory.remove(item.id), false);
  memory.clear();
  assert.equal(memory.count(), 0);
});

test('short completed turns retain exactly the newest twenty-four entries', () => {
  const Memory = load(), memory = Memory.create({storage: storage()});
  for (let index = 0; index < 40; index += 1) memory.remember(`question-${index}`, `answer-${index}`);
  assert.equal(memory.count(), Memory.limits.maxEntries);
  assert.equal(memory.list()[0].user, 'question-39');
  assert.equal(memory.list().at(-1).user, 'question-16');
});

test('blocked or malformed storage fails closed without breaking Xiaoyi', () => {
  const Memory = load();
  const blocked = {getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }};
  const memory = Memory.create({storage: blocked});
  assert.doesNotThrow(() => memory.remember('question', 'answer'));
  assert.equal(memory.count(), 1);
  assert.equal(memory.isEnabled(), true);
  assert.equal(memory.isPersistent(), false);
  const malformed = storage({[Memory.key]: '{not-json'});
  assert.doesNotThrow(() => Memory.create({storage: malformed}));
  assert.equal(Memory.create({storage: malformed}).count(), 0);
});

test('memory can be paused and query recall returns only user-authored history', () => {
  const Memory = load(), saved = storage(), memory = Memory.create({storage: saved});
  memory.remember('我会 Python，想做 VLA 项目', 'This is an unverified assistant statement');
  memory.remember('查询机器人期刊', 'Another reply');
  const recall = memory.recall('VLA');
  assert.equal(recall.length, 1);
  assert.match(recall[0].user, /Python/);
  assert.ok(!Object.hasOwn(recall[0], 'assistant'));
  memory.setEnabled(false);
  assert.equal(memory.remember('not saved', 'not saved'), null);
  assert.equal(Memory.create({storage: saved}).isEnabled(), false);
  assert.equal(memory.messages().length, 0);
  memory.setEnabled(true);
  assert.equal(memory.messages().length, 4);
});

test('recall routing recognizes deliberate history questions without swallowing technical memory concepts', () => {
  const Memory = load();
  for (const prompt of ['你还记得我的条件吗？', '我们聊过什么？', 'Do you remember my history?']) assert.ok(Memory.recallRequest(prompt), prompt);
  assert.equal(Memory.recallRequest('你还记得我们之前聊过VLA吗？').query, 'VLA');
  for (const prompt of ['Agent 的长期记忆是什么？', '介绍一下记忆流', '机器人记忆机制如何评测？', 'What is agent memory?', '什么是 VLN？']) assert.equal(Memory.recallRequest(prompt), null, prompt);
});

test('multibyte input stays within the actual stored UTF-8 byte limit', () => {
  const Memory = load(), saved = storage(), memory = Memory.create({storage: saved});
  for (let index = 0; index < 30; index += 1) memory.remember(`第${index}轮${'你'.repeat(6000)}`, '🧑‍🚀'.repeat(6000));
  const value = saved.values.get(Memory.key);
  assert.ok(Buffer.byteLength(value, 'utf8') <= Memory.limits.maxTotalBytes);
  assert.ok(memory.list().reduce((sum, item) => sum + item.user.length + item.assistant.length, 0) <= Memory.limits.maxTotalChars);
  const entry = memory.list()[0];
  entry.user = 'changed';
  assert.notEqual(memory.list()[0].user, 'changed', 'callers cannot mutate saved entries');
});

test('restored turns preserve minimal source links without putting references into API messages', () => {
  const Memory = load(), saved = storage(), first = Memory.create({storage: saved});
  first.remember('什么是 VLN？', 'VLN 是导航任务。', [
    {name: 'VLN paper', website: 'https://arxiv.org/abs/1711.07280', urlType: 'official', privateField: 'discard'},
    {name: 'unsafe', website: 'javascript:alert(1)'},
    ...Array.from({length: 8}, (_, index) => ({name: `Reference ${index}`, url: `https://example.org/${index}`}))
  ]);
  const restored = Memory.create({storage: saved});
  assert.equal(restored.current()[0].sources.length, 4);
  assert.equal(restored.current()[0].sources[0].website, 'https://arxiv.org/abs/1711.07280');
  assert.ok(!Object.hasOwn(restored.current()[0].sources[0], 'privateField'));
  assert.ok(restored.messages().every(message => Object.keys(message).join(',') === 'role,content'));
  restored.startNew();
  assert.equal(restored.current().length, 0);
});

test('stored user turns reconstruct project selection and technical follow-ups after a reload', () => {
  const sandbox = {window: {}}; vm.runInNewContext(code, sandbox);
  const data = Object.fromEntries(['competitions', 'journals', 'technical-knowledge'].map(kind => [kind, JSON.parse(fs.readFileSync(new URL(`../data/${kind}.json`, import.meta.url), 'utf8'))]));
  const makeEngine = () => sandbox.window.XiaoyiEngine.create({data});
  const saved = storage(), memory = sandbox.window.XiaoyiMemory.create({storage: saved}), original = makeEngine(), messages = [];
  for (const question of ['我大二会 Python，没有硬件，想做机器人项目', '第一个']) {
    messages.push({role: 'user', content: question});
    const result = original.reply(question, messages);
    messages.push({role: 'assistant', content: result.text});
    memory.remember(question, result.text, result.sources);
  }
  const restored = sandbox.window.XiaoyiMemory.create({storage: saved}), engine = makeEngine(), history = restored.messages();
  for (let index = 0; index < history.length; index += 2) engine.reply(history[index].content, history.slice(0, index + 1));
  const next = engine.reply('下一步怎么开始', [...history, {role: 'user', content: '下一步怎么开始'}]);
  assert.match(next.text, /机器人失败片段整理工具/);
  assert.match(next.text, /实施要点/);
  assert.match(next.text, /Python/);
});
