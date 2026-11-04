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
    ['data/achievements-gallery.json', 30, ['competition', 'research', 'learning', 'record']],
    ['data/activity-gallery.json', 64, ['awards', 'conferences', 'practice', 'social', 'community', 'exhibitions', 'sports']]
  ];
  for (const [file, count, categories] of galleries) {
    const data = JSON.parse(read(file));
    assert.equal(data.items.length, count, file);
    assert.equal(new Set(data.items.map(item => item.id)).size, count);
    assert.doesNotMatch(read(file), /\/Users\/|file:\/\/|sourcePath|\.HEIC|\.docx|\.pptx/i);
    for (const item of data.items) {
      assert.ok(item.title && item.titleZh, item.id);
      assert.ok(categories.includes(item.category), item.id);
      assert.equal(item.group, item.category, item.id);
      assert.match(item.event, /^[a-z\d]+(?:-[a-z\d]+)*$/);
      assert.ok(Number.isInteger(item.sortOrder) && item.sortOrder >= 0, item.id);
      if (item.role) assert.ok(item.roleZh, item.id);
      if (item.sourceUrl) assert.match(item.sourceUrl, /^https:\/\/mp\.weixin\.qq\.com\/s\/[\w-]+$/);
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
  assert.match(activities.get('album-137').title, /Venue Entrance/);
  assert.match(activities.get('album-137').titleZh, /会场入口/);
});

test('award evidence and activity photographs stay in their respective archives', () => {
  const achievements = new Map(JSON.parse(read('data/achievements-gallery.json')).items.map(item => [item.id, item]));
  const activities = new Map(JSON.parse(read('data/activity-gallery.json')).items.map(item => [item.id, item]));
  for (const id of ['album-011', 'album-012', 'album-033', 'album-066']) {
    assert.ok(achievements.has(id), `${id} is archived with certificates and records`);
    assert.ok(!activities.has(id), `${id} is not shown as an activity photo`);
    assert.ok(page.includes(`assets/activities/${id}.webp`), `${id} remains available in the static archive`);
  }
  assert.ok(activities.has('record-16'), 'the 3D competition team photo belongs in activities');
  assert.ok(!achievements.has('record-16'), 'the 3D competition team photo is not an award certificate');
  assert.ok(page.includes('具身智能与人形机器人产业大会 · 会场入口'));
  assert.doesNotMatch(page, /具身智能与人形机器人产业大会 · 合影/);
  assert.doesNotMatch(read('gallery.js'), /certificates:'荣誉证书'/);
});



test('archives remain ordered by category with adjacent records from each event', () => {
  const configurations = [
    ['achievements-gallery.json', ['competition', 'research', 'learning', 'record'], [
      ['record-20', 'record-02'], ['record-06', 'record-13'], ['record-08', 'record-15'],
      ['record-22', 'record-26'], ['record-23', 'record-30', 'record-31'], ['album-011', 'album-012']
    ]],
    ['activity-gallery.json', ['awards', 'conferences', 'practice', 'social', 'community', 'exhibitions', 'sports'], [
      ['album-053', 'album-054'], ['album-083', 'album-084'],
      ['album-026', 'album-093', 'album-095', 'album-097', 'album-098'],
      ['album-020', 'album-051', 'album-163', 'album-162'], ['album-025', 'album-103'],
      ['album-133', 'album-137'], ['album-145', 'album-159'],
      ['album-039', 'album-112', 'album-151'], ['album-128', 'album-129']
    ]]
  ];
  for (const [file, categories, requiredNeighbors] of configurations) {
    const records = JSON.parse(read(`data/${file}`)).items;
    const positions = new Map(records.map((item, index) => [item.id, index]));
    const closedGroups = new Set();
    let lastKey;
    records.forEach((item, index) => {
      if (index) assert.ok(categories.indexOf(item.category) >= categories.indexOf(records[index - 1].category), `${file}: category order`);
      const key = `${item.category}/${item.event}`;
      if (key !== lastKey) {
        assert.ok(!closedGroups.has(key), `${file}: ${key} must stay adjacent`);
        if (lastKey) closedGroups.add(lastKey);
      } else assert.ok(item.sortOrder > records[index - 1].sortOrder, `${file}: stable event order`);
      lastKey = key;
    });
    for (const neighbors of requiredNeighbors) {
      const indexes = neighbors.map(id => positions.get(id)).sort((a, b) => a - b);
      assert.ok(indexes.every(Number.isInteger), `${file}: ${neighbors.join(', ')} all exist`);
      assert.equal(indexes.at(-1) - indexes[0], indexes.length - 1, `${file}: ${neighbors.join(', ')} remain adjacent`);
    }
  }
});

test('user-confirmed activity captions, team leadership and GSF sources are preserved', () => {
  const records = new Map(JSON.parse(read('data/activity-gallery.json')).items.map(item => [item.id, item]));
  assert.equal(records.get('album-046').titleZh, '创青春创新创业大赛 · 团队记录');
  assert.equal(records.get('album-046').title, 'Chuang Qing Innovation & Entrepreneurship Competition · Team');
  for (const id of ['album-053', 'album-054']) {
    assert.equal(records.get(id).role, 'Team Leader');
    assert.equal(records.get(id).roleZh, '领队带队参赛');
    assert.ok(!records.get(id).award, `${id}: leadership is a role, not a prize`);
  }
  assert.doesNotMatch(records.get('album-053').titleZh, /项目答辩/);
  assert.equal(records.get('album-073').titleZh, '2024 APMCM亚太地区大学生数学建模竞赛 · 颁奖现场');
  assert.equal(records.get('album-072').titleZh, '志愿服务 · 项目调研');
  assert.equal(records.get('album-162').titleZh, 'China3dV 活动纪实');
  assert.equal(records.get('album-162').category, 'conferences');
  assert.equal(records.get('album-162').event, 'china-3d-vision');
  assert.doesNotMatch(page, /社会实践 · 团队参访/);
  for (const id of ['album-083', 'album-084']) {
    assert.equal(records.get(id).category, 'practice');
    assert.match(records.get(id).titleZh, /^GSF黑客松/);
    assert.equal(records.get(id).sourceUrl, 'https://mp.weixin.qq.com/s/nYd9nSeopWvsoE6_F8EqQQ');
  }
});

test('official World Robot Games reports stay with the catering case, separate from Lijian', () => {
  const match = page.match(/<article><h4>World Robot Games · Catering Project<\/h4>([\s\S]*?)<\/article><article><h4>Lijian Project/);
  assert.ok(match, 'the two project cases remain distinct');
  assert.match(match[1], /href="https:\/\/mp\.weixin\.qq\.com\/s\/72bqwqyHdnddDNOmFLpvYg"/);
  assert.match(match[1], /href="https:\/\/mp\.weixin\.qq\.com\/s\/CKZt89C16-UYofxPEr-T1Q"/);
  assert.equal((match[1].match(/class="[^"]*\bcase-report-links\b[^"]*"/g) || []).length, 1);
  assert.doesNotMatch(page.match(/<article><h4>Lijian Project[\s\S]*?<\/article>/)?.[0] || '', /72bqwqyHdnddDNOmFLpvYg|CKZt89C16-UYofxPEr-T1Q/);
  const translations = read('language-copy.js');
  assert.match(translations, /'ifeng Tech · Autonomous Reasoning in Scenario Events ↗': '凤凰网科技 · 全自主推理挑战最难场景赛 ↗'/);
  assert.match(translations, /'Spirit AI · Autonomous Reasoning Wins Gold and Silver ↗': '千寻智能 · 全自主推理斩获一金一银 ↗'/);
});

test('static archives preserve grouped manifest order and provide separate report links', () => {
  for (const [gallery, file] of [['achievement-gallery', 'achievements-gallery.json'], ['activity-gallery', 'activity-gallery.json']]) {
    const fragment = page.match(new RegExp(`<div id="${gallery}"[^>]*>([\\s\\S]*?)</div></details>`))?.[1];
    assert.ok(fragment, gallery);
    const records = JSON.parse(read(`data/${file}`)).items;
    assert.deepEqual([...fragment.matchAll(/data-record-id="([^"]+)"/g)].map(match => match[1]), records.map(item => item.id));
    assert.equal((fragment.match(/class="hg-fallback-category"/g) || []).length, new Set(records.map(item => item.category)).size);
    let anchorOpen = false;
    for (const token of fragment.matchAll(/<\/?a(?:\s[^>]*|)>/g)) {
      if (token[0].startsWith('</')) { assert.ok(anchorOpen, 'closing anchor has an opening tag'); anchorOpen = false; }
      else { assert.ok(!anchorOpen, 'report links must not be nested inside image links'); anchorOpen = true; }
    }
    assert.equal(anchorOpen, false);
    assert.equal((fragment.match(/class="hg-fallback-report"/g) || []).length, records.filter(item => item.sourceUrl).length);
    for (const item of records.filter(item => item.sourceUrl)) assert.ok(fragment.includes(`href="${item.sourceUrl}"`));
  }
  const script = read('gallery.js');
  assert.match(script, /reportLink\.hidden = !item\.sourceUrl/);
  assert.match(script, /reportLink\.removeAttribute\('href'\)/);
  assert.match(script, /bottom\.append\(previous, dialogCount, next, reportLink, imageLink\)/);
  assert.doesNotMatch(script, /i % 2/);
});
