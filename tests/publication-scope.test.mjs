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

test('research portfolio separates the two robotics projects and discloses official demo media', () => {
  const page = read('index.html');
  const experience = page.slice(page.indexOf('id="experience"'), page.indexOf('id="learning"'));
  const research = page.slice(page.indexOf('id="research"'), page.indexOf('class="records-heading"'));
  assert.match(experience, /World Robot Games · Catering Project/);
  assert.match(experience, /food tongs, the handoff area, microwave, hot-food cabinet, and water dispenser/i);
  assert.match(experience, /Lijian Project · Service Task Evaluation/);
  assert.match(experience, /coffee preparation, drink delivery, and multimodal tea-service tasks/i);
  const games = experience.split('<article>')[1].split('</article>')[0];
  assert.doesNotMatch(games, /coffee preparation/i);
  assert.match(page, /<summary><span class="when-closed">Show more/);
  assert.match(research, /assets\/research\/spirit-v1-5-demo\.mp4/);
  for (const name of ['act-demo.mp4', 'diffusion-policy-demo.mp4', 'openvla-demo.mp4']) {
    assert.ok(research.includes(`assets/research/${name}`), name);
  }
  assert.match(research, /paper-keywords/);
  assert.doesNotMatch(research, /Reproduction Plan|candidates, not completed results|PHASE [123]/);
  assert.match(read('assets/research/SOURCES.md'), /not demonstrations produced by the portfolio owner/);
});
