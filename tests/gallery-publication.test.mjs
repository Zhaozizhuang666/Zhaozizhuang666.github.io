import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), 'utf8');
const page = read('index.html');

test('deferred archive URLs resolve to JSON, with both archives initially collapsed', () => {
  const sources = [...page.matchAll(/data-gallery-source="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(sources.map(value => value.split('?')[0]), [
    'data/achievements-gallery.json', 'data/activity-gallery.json'
  ]);
  for (const source of sources) assert.ok(JSON.parse(read(source.split('?')[0])).items.length);
  const disclosures = [...page.matchAll(/<details\b([^>]*class="gallery-disclosure"[^>]*)>/g)];
  assert.equal(disclosures.length, 2);
  for (const [, attributes] of disclosures) assert.doesNotMatch(attributes, /\bopen(?:\s|=|$)/);
  assert.equal((page.match(/class="hg-fallback-grid"/g) || []).length, 2);
});

test('public archive records have bilingual captions, valid categories and existing assets', () => {
  const galleries = [
    ['data/achievements-gallery.json', 27, ['competition', 'research', 'learning', 'record']],
    ['data/activity-gallery.json', 67, ['certificates', 'awards', 'conferences', 'practice', 'social', 'community', 'exhibitions', 'sports']]
  ];
  for (const [file, count, categories] of galleries) {
    const data = JSON.parse(read(file));
    assert.equal(data.items.length, count, file);
    assert.equal(new Set(data.items.map(item => item.id)).size, count);
    assert.doesNotMatch(read(file), /\/Users\/|file:\/\/|sourcePath|\.HEIC|\.docx|\.pptx/i);
    for (const item of data.items) {
      assert.ok(item.title && item.titleZh, item.id);
      assert.ok(categories.includes(item.category), item.id);
      assert.ok(item.width > 0 && item.height > 0, item.id);
      if (item.award) assert.ok(item.awardZh, item.id);
      for (const key of ['full', 'thumbnail']) {
        assert.match(item[key], /^assets\/(achievements|activities)\/[a-z\d-]+\.webp$/);
        assert.ok(fs.existsSync(new URL(item[key], root)), item[key]);
        assert.ok(page.includes(item[key]), `fallback: ${item[key]}`);
      }
    }
  }
});

test('withdrawn certificates cannot reappear through manifests, fallback or generated files', () => {
  for (const id of ['record-03', 'record-25', 'record-33', 'record-35']) {
    assert.ok(!read('data/achievements-gallery.json').includes(id), id);
    assert.ok(!page.includes(`${id}.webp`) && !page.includes(`${id}-thumb.webp`), id);
    assert.ok(!fs.existsSync(new URL(`assets/achievements/${id}.webp`, root)), id);
    assert.ok(!fs.existsSync(new URL(`assets/achievements/${id}-thumb.webp`, root)), id);
  }
});

test('gallery captions preserve verified competition stages and project recognitions', () => {
  const records = new Map(JSON.parse(read('data/achievements-gallery.json')).items.map(item => [item.id, item]));
  assert.equal(records.get('record-01').award, 'Campus First Prize');
  assert.equal(records.get('record-08').award, 'National Second Prize');
  assert.match(records.get('record-13').title, /16th/);
  assert.match(records.get('record-15').award, /Shanxi/);
  assert.match(records.get('record-14').award, /Project/i);
  const activities = new Map(JSON.parse(read('data/activity-gallery.json')).items.map(item => [item.id, item]));
  assert.equal(activities.get('album-128').category, 'sports');
  assert.equal(activities.get('album-011').award, 'Team Project Recognition');
});
