import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const profile = fs.readFileSync(new URL('../.github/profile/README.md', import.meta.url), 'utf8');

test('GitHub profile source presents the owner, work, and maintained project links', () => {
  assert.match(profile, /<h1>Hi, I'm Zizhuang Zhao<\/h1>/);
  assert.match(profile, /Robotics End-to-End Model Evaluation Engineer at Spirit AI/);
  assert.match(profile, /assets\/profile\.jpg/);
  assert.match(profile, /href="https:\/\/zhaozizhuang666\.github\.io\/vla-guide\/"/);
  assert.match(profile, /href="mailto:zizhuang\.zhao@spirit-ai\.com"/);
  assert.match(profile, /World Robot Games · Catering Tasks/);
  assert.match(profile, /Lijian · Service Tasks and OOD Evaluation/);
  assert.match(profile, /Post-Training Models · Focused Validation/);
  assert.match(profile, /Cross-robot consistency/);
  assert.match(profile, /MovaXHelper, torque-sensor calibration, Docker, Franka, RoboArena/);
  assert.match(profile, /Task benchmark.*Robot capability.*Hardware check.*Root-cause report/);
  assert.match(profile, /夹爪抖动和位置泛化偏差/);
  const defaultView = profile.split('<details>')[0];
  assert.deepEqual(defaultView.match(/[\u3400-\u9fff]+/g) || [], ['专注具身机器人评测与真机验证']);
  const shortChinese = profile.match(/<p lang="zh-CN">([^<]+)<\/p>/)?.[1] || '';
  assert.ok([...shortChinese].filter(char => /[\u3400-\u9fff]/.test(char)).length <= 30);
  assert.match(profile, /<summary>中文版<\/summary>/);
  assert.doesNotMatch(defaultView, /中文：/);
  assert.doesNotMatch(profile, /github-readme-stats|visitor-badge|profile-counter/i);
});
