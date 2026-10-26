import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');

test('public pages and Xiaoyi sources exclude Office attachments', () => {
  for (const page of ['index.html', 'guide.html', 'docs/site-handbook.md', 'README.md']) {
    assert.doesNotMatch(read(page), /(?:href=["']|\]\()[^\s"')]*\.(?:docx|pptx?)(?:["')?#])/i, page);
  }
  const entries = JSON.parse(read('data/technical-knowledge.json')).entries;
  for (const entry of entries) {
    for (const source of entry.sourceDocuments || []) {
      assert.doesNotMatch(source.url, /\.(?:docx|pptx?)(?:[?#]|$)/i, entry.id);
    }
  }
});

test('publication files and synchronization allowlist contain only the retained PDFs', () => {
  const manifest = JSON.parse(read('assets/documents/manifest.json'));
  const allowed = ['6g-data-flows-embodied-ai-course-paper.pdf', 'chuangxiang-business-model.pdf'];
  assert.deepEqual(manifest.documents.map(item => item.publicFile).sort(), allowed);
  assert.deepEqual(fs.readdirSync(new URL('assets/documents/', root)).filter(name => name !== 'manifest.json').sort(), allowed);
  const allowlist = read('scripts/sync-public-documents.py').match(/ALLOWLIST = \(([\s\S]*?)\n\)/)[1];
  assert.doesNotMatch(allowlist, /\.(docx|pptx?)/i);
  assert.match(read('.gitignore'), /^\*\.pptx$/m);
});
