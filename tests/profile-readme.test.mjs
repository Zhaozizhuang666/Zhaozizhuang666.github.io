import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const profile = fs.readFileSync(new URL('../.github/profile/README.md', import.meta.url), 'utf8');

test('GitHub profile source presents the owner, work, and maintained project links', () => {
  assert.match(profile, /Zizhuang Zhao · 赵子状/);
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
  assert.doesNotMatch(profile, /github-readme-stats|visitor-badge|profile-counter/i);
});
