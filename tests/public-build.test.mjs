import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repository = fileURLToPath(new URL('../', import.meta.url));
const builder = fileURLToPath(new URL('../scripts/build-public-site.py', import.meta.url));
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repository, encoding: 'utf8' }).split('\0').filter(Boolean);

function fixture(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'public-build-test-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
  for (const name of tracked) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repository, name), target);
  }
  git(root, 'init', '--quiet');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Public Build Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'Reviewed static fixture');
  return root;
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function build(root, output = path.join(root, 'dist')) {
  return spawnSync('python3', [builder, '--source-root', root, '--output', output], { encoding: 'utf8' });
}

function success(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function failure(result, pattern) {
  assert.equal(result.status, 1);
  assert.match(result.stderr, pattern);
}

function put(root, name, content, track = false) {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  if (track) git(root, 'add', '-f', '--', name);
}

test('public artifact keeps the complete local site, contacts and exact manifests without source folders', t => {
  const root = fixture(t);
  const report = success(build(root));
  const output = path.join(root, 'dist');
  const release = JSON.parse(fs.readFileSync(path.join(output, 'release.json')));
  assert.equal(release.format, 'zizhuang-public-site-v1');
  assert.match(release.commit, /^[0-9a-f]{40}$/);
  assert.equal(release.sourceDirty, false);
  assert.equal(report.htmlPages, 83);
  assert.ok(report.localLinks > 8000);
  assert.ok(report.localAnchors > 750);
  assert.equal(report.files, release.files.length + 1);
  const names = release.files.map(item => item.path);
  for (const prefix of ['server/', 'scripts/', 'tests/', 'docs/', '.git', '.github']) {
    assert.equal(names.some(name => name.startsWith(prefix)), false, prefix);
  }
  assert.equal(fs.existsSync(path.join(output, 'README.md')), false);
  assert.ok(names.includes('QA.md'));
  assert.ok(names.includes('resources/vla-guide/LICENSE'));
  assert.ok(names.includes('resources/vla-guide/CONTENT_LICENSE.md'));
  assert.deepEqual(names.filter(name => name.endsWith('.pdf')), [
    'assets/documents/6g-data-flows-embodied-ai-course-paper.pdf',
    'assets/documents/chuangxiang-business-model.pdf',
  ]);
  assert.doesNotMatch(names.join('\n'), /\.(?:docx?|pptx?)$/im);
  const index = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.equal((index.match(/mailto:zizhuang\.zhao@spirit-ai\.com/g) || []).length, 2);
  assert.equal(fs.readFileSync(path.join(output, 'xiaoyi-config.js'), 'utf8'), fs.readFileSync(path.join(root, 'xiaoyi-config.js'), 'utf8'));
  for (const item of release.files) {
    const bytes = fs.readFileSync(path.join(output, item.path));
    assert.equal(bytes.length, item.bytes, item.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path);
  }
  for (const manifest of ['resources/manifest.json', 'assets/documents/manifest.json']) {
    assert.deepEqual(fs.readFileSync(path.join(output, manifest)), fs.readFileSync(path.join(root, manifest)));
  }
});

test('untracked private files are never discovered even inside public directories', t => {
  const root = fixture(t);
  put(root, 'assets/private-note.json', '{"private":"do not publish"}');
  put(root, 'assets/private.docx', 'private office original');
  put(root, 'private-working-copy.html', '<p>private</p>');
  put(root, '.cloudbase/auth.json', '{"credential":"private"}');
  success(build(root));
  for (const name of ['assets/private-note.json', 'assets/private.docx', 'private-working-copy.html', '.cloudbase/auth.json']) {
    assert.equal(fs.existsSync(path.join(root, 'dist', name)), false, name);
  }
});

test('tracked Office files and extra PDFs inside public directories fail closed', t => {
  const root = fixture(t);
  for (const name of ['assets/withdrawn.docx', 'assets/slides.pptx', 'assets/documents/unapproved.pdf']) {
    put(root, name, 'not approved', true);
    failure(build(root), /Unapproved public file type/);
    git(root, 'rm', '--quiet', '-f', '--', name);
  }
  assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});

test('a symlink replacing a tracked public asset is rejected without reading its target', t => {
  const root = fixture(t);
  const target = path.join(root, 'assets/profile.jpg');
  fs.unlinkSync(target);
  fs.symlinkSync('/definitely-private-and-unreadable', target);
  failure(build(root), /Symlink rejected: assets\/profile\.jpg/);
  assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});

test('private paths and credential shapes fail without echoing their values', t => {
  const root = fixture(t);
  const name = 'data/private-accident.json';
  for (const value of ['/Users/ConfidentialOwner/private-documents', 'sk-' + 'a'.repeat(32)]) {
    put(root, name, JSON.stringify({ value }), true);
    const result = build(root);
    failure(result, /Rejected (?:local filesystem reference|credential shape)/);
    assert.equal(result.stderr.includes(value), false);
  }
  assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});

test('approved PDFs and learning resources must still match their reviewed hashes', t => {
  const root = fixture(t);
  for (const name of ['assets/documents/chuangxiang-business-model.pdf', 'resources/vla-guide/assets/app.js']) {
    fs.appendFileSync(path.join(root, name), '\nchanged');
    failure(build(root), /manifest mismatch/);
    git(root, 'checkout', '--', name);
  }
  assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});

test('all static local destinations and fragments are checked, including media posters', t => {
  const root = fixture(t);
  const name = 'index.html';
  const original = fs.readFileSync(path.join(root, name), 'utf8');
  for (const extra of ['<a href="missing.html">missing</a>', '<a href="guide.html#missing-section">missing</a>', '<video poster="assets/missing.webp"></video>']) {
    put(root, name, original + extra);
    failure(build(root), /(?:Broken local link|Missing local fragment)/);
  }
  put(root, name, original);
  success(build(root));
});

test('an unrelated nonempty output is preserved and a source directory cannot be the output', t => {
  const root = fixture(t);
  const output = path.join(root, 'my-important-directory');
  fs.mkdirSync(output);
  put(output, 'keep.txt', 'keep this file');
  failure(build(root, output), /Refusing to replace/);
  assert.equal(fs.readFileSync(path.join(output, 'keep.txt'), 'utf8'), 'keep this file');
  failure(build(root, root), /Output cannot replace the source/);
  failure(build(root, path.join(root, 'assets/generated')), /overlaps a source/);
});

test('builds are byte deterministic and generated artifacts can be replaced safely', t => {
  const root = fixture(t);
  success(build(root));
  const first = fs.readFileSync(path.join(root, 'dist/release.json'));
  const other = path.join(root, 'second-build');
  success(build(root, other));
  assert.deepEqual(fs.readFileSync(path.join(other, 'release.json')), first);
  success(build(root));
  assert.deepEqual(fs.readFileSync(path.join(root, 'dist/release.json')), first);
  put(root, 'dist/private-extra.json', '{"private":true}');
  failure(build(root), /Refusing to replace/);
  assert.equal(fs.existsSync(path.join(root, 'dist/private-extra.json')), true);
});
