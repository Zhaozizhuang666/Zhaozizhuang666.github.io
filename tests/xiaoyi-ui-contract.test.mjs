import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../xiaoyi.js', import.meta.url), 'utf8');
const engineSource = fs.readFileSync(new URL('../xiaoyi-engine.js', import.meta.url), 'utf8');

test('local-only model setup clears stale online choices without contacting an endpoint', async () => {
  const options = [], select = {replaceChildren(...items) { options.splice(0, options.length, ...items); }}, status = {}, hint = {};
  const state = {models: [{value: 'old/model'}], selection: 'old/model'};
  const context = vm.createContext({state, select, status, hint, onlineEnabled: false, Option: class { constructor(label, value) { this.label = label; this.value = value; } }, api() { throw Error('Local mode must not resolve online endpoints'); }, fetch() { throw Error('Local mode must not fetch providers'); }});
  const start = source.indexOf('  async function models('), end = source.indexOf('  const launcher=', start);
  vm.runInContext(source.slice(start, end), context);
  await vm.runInContext('models(select,status,hint)', context);
  assert.equal(options.length, 1);
  assert.equal(options[0].value, 'local');
  assert.equal(select.value, 'local');
  assert.equal(state.models.length, 0);
  assert.equal(state.selection, 'local');
  assert.equal(status.textContent, 'KNOWLEDGE MODE');
  assert.match(hint.textContent, /不会连接在线模型/);
});

test('local-only chat ignores stale online selection and keeps the active history in the browser', async () => {
  const history = [{role: 'user', content: 'VLA是什么'}], state = {messages: history, models: [{value: 'old/model'}], selection: 'old/model'};
  let received;
  const context = vm.createContext({state, onlineEnabled: false, window: {XiaoyiMemory: {recallRequest: () => null}}, engine: {reply(input, messages) { received = {input, messages}; return {text: 'local answer', sources: []}; }}, fetch() { throw Error('Local mode must not send chat'); }});
  const start = source.indexOf('  async function answer('), end = source.indexOf('  function richText(', start);
  vm.runInContext(source.slice(start, end), context);
  const answer = await vm.runInContext("answer('VLA是什么')", context);
  assert.equal(answer.text, 'local answer');
  assert.equal(answer.online, false);
  assert.equal(received.messages, history);
});

function memory() {
  const sandbox = {window: {}};
  vm.runInNewContext(engineSource, sandbox);
  const values = new Map();
  return sandbox.window.XiaoyiMemory.create({storage: {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)}});
}

function uiDelete(memory, messages, item) {
  const state = {messages, sources: []}, renders = [];
  const context = vm.createContext({memory, state, item, needsHydration: false, renderTranscript() { renders.push(state.messages.slice()); }});
  // Execute the production event boundary without exporting internals to visitors.
  const start = source.indexOf('  function removeMemoryEntry(');
  const end = source.indexOf('  function renderMemory(', start);
  assert.ok(start >= 0 && end > start, 'UI record deletion boundary is present');
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext('removeMemoryEntry(item)', context);
  return {state, renders, needsHydration: context.needsHydration};
}

test('memory deletion keeps an unsaved conversation when removing an older session', () => {
  for (const enabled of [true, false]) {
    const saved = memory();
    const old = saved.remember('saved question', 'saved answer');
    saved.startNew();
    saved.setEnabled(enabled);
    const active = [{role: 'user', content: 'unsaved question'}, {role: 'assistant', content: 'unsaved answer'}];
    const result = uiDelete(saved, active, old);
    assert.equal(saved.count(), 0, 'the requested record is removed from storage');
    assert.equal(result.state.messages, active, 'the active transcript is not replaced');
    assert.deepEqual(result.state.messages.map(message => message.content), ['unsaved question', 'unsaved answer']);
    assert.equal(result.renders.length, 0);
    assert.equal(result.needsHydration, false, 'unrelated deletion does not reset active reasoning');
  }
});

test('memory deletion removes only the selected saved turn and preserves duplicate text', () => {
  const saved = memory();
  const first = saved.remember('重复问题', '相同回答');
  const second = saved.remember('重复问题', '相同回答');
  saved.setEnabled(false);
  const active = [
    {role: 'user', content: '重复问题', memoryEntryId: first.id},
    {role: 'assistant', content: '相同回答', memoryEntryId: first.id},
    {role: 'user', content: '重复问题', memoryEntryId: second.id},
    {role: 'assistant', content: '相同回答', memoryEntryId: second.id},
    {role: 'user', content: '未保存问题'},
    {role: 'assistant', content: '未保存回答'}
  ];
  const result = uiDelete(saved, active, first), kept = result.state.messages;
  assert.deepEqual(Array.from(kept, message => message.memoryEntryId), [second.id, second.id, undefined, undefined]);
  assert.equal(kept.filter(message => message.content === '重复问题').length, 1);
  assert.equal(saved.count(), 1);
  assert.equal(result.renders.length, 1);
  assert.equal(result.needsHydration, true, 'remaining turns rebuild reasoning on the next question');
});

test('UI source restores IDs, assigns IDs after successful saves, and never uses disabled messages() for Continue', () => {
  assert.match(source, /const restoredMessages=\(\)=>memory\.isEnabled\(\)\?/);
  assert.match(source, /state\.messages=restoredMessages\(\);needsHydration=true;renderTranscript\(\)/);
  assert.match(source, /const saved=memory\.remember\(t,r\.text,r\.sources\);if\(saved\)userMessage\.memoryEntryId=assistantMessage\.memoryEntryId=saved\.id/);
  assert.doesNotMatch(source, /memory\.resume\(item\.conversationId\);state\.messages=memory\.messages\(\)/);
});

test('BFCache pageshow replaces cached UI messages with the current tab stream', () => {
  const saved = memory();
  saved.remember('cached question', 'cached answer');
  const state = {messages: [{role: 'user', content: 'stale question'}], sources: ['stale source']};
  let resets = 0, renders = 0;
  const context = vm.createContext({memory: saved, state, restoredMessages: () => saved.messages(), needsHydration: false, engine: {reset() { resets++; }}, renderTranscript() { renders++; }, renderMemory() { renders++; }});
  const start = source.indexOf('  function restorePageSession(');
  const end = source.indexOf("  window.addEventListener('pageshow'", start);
  assert.ok(start >= 0 && end > start, 'production pageshow restoration boundary exists');
  vm.runInContext(source.slice(start, end), context);
  vm.runInContext('restorePageSession({persisted:false})', context);
  assert.equal(state.messages[0].content, 'stale question', 'ordinary pageshow does not replace a live chat');
  saved.clear();
  vm.runInContext('restorePageSession({persisted:true})', context);
  assert.equal(state.messages.length, 0);
  assert.equal(state.sources.length, 0);
  assert.equal(resets, 1);
  assert.equal(renders, 2);
});
