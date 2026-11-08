import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const verifier = fileURLToPath(new URL('../scripts/verify-public-release.py', import.meta.url));
const commit = 'a'.repeat(40);

function sha(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function makeArtifact(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'public-release-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
  const files = {
    'index.html': Buffer.from('<!doctype html><title>Test</title>'),
    'xiaoyi.js': Buffer.from('window.Xiaoyi = true;'),
    'assets/profile.webp': Buffer.from([0, 1, 2, 3, 254, 255]),
  };
  for (const [name, bytes] of Object.entries(files)) {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  const release = Buffer.from(JSON.stringify({
    format: 'zizhuang-public-site-v1', commit, sourceDirty: false,
    checks: { htmlPages: 1, localLinks: 0, localAnchors: 0 },
    files: Object.entries(files).map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: sha(bytes) })),
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'release.json'), release);
  return { dir, files, release };
}

async function serverFor(t, artifact, options = {}) {
  let indexRequests = 0;
  const server = http.createServer((request, response) => {
    if (options.redirect && request.url === '/assets/profile.webp') {
      response.writeHead(302, { Location: options.redirect });
      response.end();
      return;
    }
    let name;
    try {
      name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\//, '');
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (name === 'release.json' && options.omitRelease) {
      response.writeHead(404).end();
      return;
    }
    let bytes = name === 'release.json' ? artifact.release : artifact.files[name];
    if (name === 'index.html') indexRequests++;
    if (name === 'index.html' && options.staleCanary) bytes = Buffer.from('<title>Old deployment</title>');
    if (name === 'index.html' && options.staleOnce && indexRequests === 1) bytes = Buffer.from('<title>Old deployment</title>');
    if (name === 'assets/profile.webp' && options.corruptAsset) bytes = Buffer.from('corrupt');
    if (!bytes) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Length': bytes.length, 'Content-Type': 'application/octet-stream' });
    response.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/`;
}

function run(artifact, url, ...args) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [verifier, '--artifact', artifact.dir, '--url', url,
      '--attempts', '1', '--delay', '0', '--allow-local-http', ...args]);
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

function resultOf(output) {
  return JSON.parse(output.stdout.trim().split('\n').at(-1));
}

test('exact deployment identity and every file are verified by bytes and SHA-256', async t => {
  const artifact = makeArtifact(t);
  const url = await serverFor(t, artifact);
  const result = await run(artifact, url, '--identity', 'required', '--expected-commit', commit);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(resultOf(result).failures, []);
  assert.equal(resultOf(result).filesVerified, 3);
  assert.equal(resultOf(result).fullCheckStarted, true);
});

test('HTTP 200 with stale homepage or a corrupt asset is a deployment failure', async t => {
  for (const option of [{ staleCanary: true }, { corruptAsset: true }]) {
    const artifact = makeArtifact(t);
    const url = await serverFor(t, artifact, option);
    const result = await run(artifact, url, '--identity', 'required', '--expected-commit', commit);
    assert.equal(result.status, 1);
    assert.equal(resultOf(result).passed, false);
    assert.ok(resultOf(result).failures.length > 0);
  }
});

test('required identity rejects an absent manifest while optional Pages verification permits it', async t => {
  const artifact = makeArtifact(t);
  const url = await serverFor(t, artifact, { omitRelease: true });
  const required = await run(artifact, url, '--identity', 'required', '--expected-commit', commit);
  assert.equal(required.status, 1);
  assert.equal(resultOf(required).failures[0].path, 'release.json');
  const optional = await run(artifact, url, '--identity', 'optional');
  assert.equal(optional.status, 0, optional.stderr + optional.stdout);
  assert.equal(resultOf(optional).filesVerified, 3);
});

test('cross-origin file redirects cannot produce a false positive', async t => {
  const artifact = makeArtifact(t);
  const foreign = http.createServer((_request, response) => response.end(artifact.files['assets/profile.webp']));
  await new Promise(resolve => foreign.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => foreign.close(resolve)));
  const foreignUrl = `http://127.0.0.1:${foreign.address().port}/asset`;
  const url = await serverFor(t, artifact, { redirect: foreignUrl });
  const result = await run(artifact, url, '--identity', 'required', '--expected-commit', commit);
  assert.equal(result.status, 1);
  assert.match(JSON.stringify(resultOf(result).failures), /cross-origin/);
});

test('local manifest tampering fails before the remote canary is accepted', async t => {
  const artifact = makeArtifact(t);
  fs.writeFileSync(path.join(artifact.dir, 'xiaoyi.js'), 'tampered');
  const url = await serverFor(t, artifact);
  const result = await run(artifact, url, '--identity', 'required', '--expected-commit', commit);
  assert.equal(result.status, 1);
  assert.match(resultOf(result).error, /Local artifact hash mismatch/);
});

test('a successful HTTP response containing a different release identity is rejected', async t => {
  const artifact = makeArtifact(t);
  const alternate = { ...artifact, release: Buffer.from(artifact.release.toString().replace(commit, 'b'.repeat(40))) };
  const url = await serverFor(t, alternate);
  const result = await run(artifact, url, '--identity', 'required', '--expected-commit', commit);
  assert.equal(result.status, 1);
  assert.deepEqual(resultOf(result).failures, [{ path: 'release.json', reason: 'SHA-256 mismatch' }]);
});

test('production identity rejects an unexpected commit and a dirty source artifact', async t => {
  const artifact = makeArtifact(t);
  const url = await serverFor(t, artifact);
  const wrongCommit = await run(artifact, url, '--identity', 'required', '--expected-commit', 'b'.repeat(40));
  assert.equal(wrongCommit.status, 1);
  assert.match(resultOf(wrongCommit).error, /expected production HEAD/);
  const manifest = JSON.parse(artifact.release);
  manifest.sourceDirty = true;
  fs.writeFileSync(path.join(artifact.dir, 'release.json'), JSON.stringify(manifest));
  const dirty = await run(artifact, url, '--identity', 'required', '--expected-commit', commit);
  assert.equal(dirty.status, 1);
  assert.match(resultOf(dirty).error, /clean source checkout/);
});

test('unsafe or duplicate file entries and oversized responses fail closed', async t => {
  const artifact = makeArtifact(t);
  const url = await serverFor(t, artifact);
  for (const mutate of [
    manifest => { manifest.files[0].path = '../private'; },
    manifest => { manifest.files.push(manifest.files[0]); },
    manifest => { manifest.files[0].bytes = 50 * 1024 * 1024 + 1; },
  ]) {
    const manifest = JSON.parse(artifact.release);
    mutate(manifest);
    fs.writeFileSync(path.join(artifact.dir, 'release.json'), JSON.stringify(manifest));
    const result = await run(artifact, url, '--identity', 'required', '--expected-commit', commit);
    assert.equal(result.status, 1);
    assert.match(resultOf(result).error, /Invalid manifest file path|Duplicate or recursive|Invalid release file size/);
  }
});

test('polling waits for matching canaries before checking the full deployment', async t => {
  const artifact = makeArtifact(t);
  const url = await serverFor(t, artifact, { staleOnce: true });
  const result = await run(artifact, url, '--identity', 'required', '--expected-commit', commit, '--attempts', '2');
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(resultOf(result).attempts, 2);
  assert.equal(resultOf(result).filesVerified, 3);
});

test('production URLs require HTTPS and reject credentials, queries, and fragments', async t => {
  const artifact = makeArtifact(t);
  const url = await serverFor(t, artifact);
  for (const invalid of [
    'http://example.com/',
    'https://user@example.com/',
    'https://example.com/?token=secret',
    'https://example.com/#private',
  ]) {
    const result = await run(artifact, invalid, '--identity', 'required', '--expected-commit', commit);
    assert.equal(result.status, 1, invalid);
    assert.match(resultOf(result).error, /Site URL must be HTTPS/);
  }
  assert.ok(url.startsWith('http://127.0.0.1:'));
});
