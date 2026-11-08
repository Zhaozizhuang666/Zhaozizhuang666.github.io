import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const wrapper = fileURLToPath(new URL('../scripts/deploy-cloudbase-site.py', import.meta.url));
const commit = 'a'.repeat(40);

function artifact(directory, files, sha = commit) {
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    fs.writeFileSync(path.join(directory, name), bytes);
  }
  const release = { format: 'zizhuang-public-site-v1', commit: sha, sourceDirty: false,
    files: Object.entries(files).map(([name, value]) => {
      const bytes = Buffer.from(value);
      return { path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }) };
  fs.writeFileSync(path.join(directory, 'release.json'), JSON.stringify(release));
}

function fixture(t, previous = true, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudbase-deploy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
  const current = path.join(root, 'artifact'), remote = path.join(root, 'remote');
  const files = { 'index.html': '<title>Current</title>', 'xiaoyi.js': 'current assistant',
    'knowledge.html': '<title>Knowledge</title>', 'guide.html': '<title>Guide</title>',
    'assets/new.webp': 'current image' };
  artifact(current, files);
  fs.mkdirSync(remote);
  if (previous) artifact(remote, { ...files, 'index.html': '<title>Previous</title>',
    'assets/withdrawn.webp': 'withdrawn image' }, 'b'.repeat(40));
  fs.writeFileSync(path.join(root, 'options.json'), JSON.stringify(options));
  const cli = path.join(root, 'fake-tcb');
  fs.writeFileSync(cli, `#!/usr/bin/env python3
import json, os, pathlib, shutil, sys
root = pathlib.Path(os.environ['DEPLOY_TEST_ROOT'])
remote = root / 'remote'
options = json.loads((root / 'options.json').read_text())
args = sys.argv[1:]
with (root / 'calls.jsonl').open('a') as log: log.write(json.dumps(args)+'\\n')
assert args[:1] == ['hosting'] and '--json' in args and '--yes' in args
assert '--safe' not in args and '--prune' not in args and '--dir' not in args
assert pathlib.Path.cwd().resolve() == root.resolve(), 'CLI must retain the project-scoped login cwd'
action = args[1]
def reply(data, **meta): print(json.dumps({'data':data, 'meta':meta}))
if action == 'list':
    files = sorted(p for p in remote.rglob('*') if p.is_file())
    data = [{'key':p.relative_to(remote).as_posix(), 'size':str(p.stat().st_size)} for p in files]
    reply(data, total=len(data))
elif action == 'download':
    target = pathlib.Path(args[3]); shutil.copyfile(remote/args[2], target); reply({'localPath':str(target)})
elif action == 'delete':
    if options.get('failDelete'): sys.exit(1)
    if not options.get('silentDeleteFailure'): (remote/args[2]).unlink()
    reply({'message':'Deleted'})
elif action == 'deploy':
    source = pathlib.Path(args[2]); dest=args[3]
    if source.is_dir():
        assert dest == '--ignore', 'Root deployment must omit cloudPath, never use a positional /'
        assert args[args.index('--ignore')+1] == 'release.json'
        assert '--verify' in args and '--entry' in args
        names = [p for p in source.rglob('*') if p.is_file() and p.name != 'release.json']
        for p in names:
            target=remote/p.relative_to(source); target.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(p,target)
        if options.get('failUploadOnce'):
            options.pop('failUploadOnce'); (root/'options.json').write_text(json.dumps(options)); sys.exit(1)
        if options.get('unexpectedAfterUpload'): (remote/'unrelated.json').write_text('unknown')
        reply({'totalFiles':len(names)+1,'successCount':len(names),'failedCount':0,'verified':not options.get('unverified')})
    else:
        assert dest == 'release.json'
        shutil.copyfile(source, remote/dest)
        reply({'totalFiles':1,'successCount':1,'failedCount':0,'verified':False})
else: sys.exit(2)
`);
  fs.chmodSync(cli, 0o755);
  const runner = path.join(root, 'run.py');
  // Exercise the actual wrapper and subprocess CLI boundary. Only HTTPS transport
  // is substituted by exact fixture bytes; no account, secret, or network is used.
  fs.writeFileSync(runner, `import importlib.util,json,os,pathlib,sys
spec=importlib.util.spec_from_file_location('deploy',sys.argv[1]); deploy=importlib.util.module_from_spec(spec); spec.loader.exec_module(deploy)
root=pathlib.Path(os.environ['DEPLOY_TEST_ROOT']); remote=root/'remote'
def fetch(base,name,size,digest,optional_missing=False):
    options=json.loads((root/'options.json').read_text())
    p=remote/name
    if not p.is_file(): return None if optional_missing else 'HTTP 404'
    raw=p.read_bytes()
    if options.get('stalePublic') and name=='assets/new.webp': raw=b'stale CDN asset'
    return None if len(raw)==size and deploy.VERIFY.sha256(raw)==digest else 'SHA-256 mismatch'
deploy.VERIFY.fetch=fetch
deploy.remote_absent=lambda base,name:not (remote/name).is_file()
try:
    result=deploy.deploy(root/'artifact','https://example.invalid/','dedicated-test-env',str(root/'fake-tcb'), '${commit}', 1, 0)
except (ValueError,OSError,KeyError,TypeError) as exc:
    print(json.dumps({'passed':False,'error':str(exc)})); sys.exit(1)
print(json.dumps(result))
`);
  return { root, current, remote, cli, files, run: () => {
    const result = spawnSync('python3', [runner, wrapper], { cwd: root, encoding: 'utf8', env: { ...process.env, DEPLOY_TEST_ROOT: root } });
    return { ...result, report: JSON.parse(result.stdout.trim().split('\n').at(-1)) };
  }, calls: () => fs.existsSync(path.join(root, 'calls.jsonl')) ? fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse) : [] };
}

test('owned update verifies files, deletes only withdrawn paths, and commits identity last', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(result.report.passed, true);
  assert.equal(result.report.filesVerified, 5);
  assert.equal(result.report.withdrawnFiles, 1);
  assert.equal(fs.existsSync(path.join(f.remote, 'assets/withdrawn.webp')), false);
  const calls = f.calls(), mutations = calls.filter(a => ['deploy','delete'].includes(a[1]));
  assert.equal(mutations[0][1], 'deploy');
  assert.equal(mutations[0][3], '--ignore');
  assert.deepEqual(mutations.filter(a => a[1] === 'delete').map(a => a[2]), ['assets/withdrawn.webp']);
  assert.equal(mutations.at(-1)[3], 'release.json');
  assert.deepEqual(fs.readFileSync(path.join(f.remote, 'release.json')), fs.readFileSync(path.join(f.current, 'release.json')));
  assert.equal(calls.some(a => a.includes('--safe') || a.includes('--prune') || a.includes('--dir')), false);
});

test('empty dedicated hosting bootstraps and a second identical deployment is idempotent', t => {
  const f = fixture(t, false);
  assert.equal(f.run().status, 0);
  assert.equal(f.run().status, 0);
  assert.equal(f.calls().some(a => a[1] === 'delete'), false);
  assert.equal(fs.existsSync(path.join(f.remote, '.cloudbase-backup')), false);
});

test('unknown remote files halt before any upload or deletion', t => {
  for (const previous of [true, false]) {
    const f = fixture(t, previous);
    fs.writeFileSync(path.join(f.remote, 'unrelated.json'), 'retain');
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.report.error, /Unrecognized remote|no reviewed release/);
    assert.equal(f.calls().some(a => ['deploy','delete'].includes(a[1])), false);
    assert.equal(fs.readFileSync(path.join(f.remote, 'unrelated.json'), 'utf8'), 'retain');
  }
});

test('CloudBase protected directories are preserved through bootstrap, update and cleanup', t => {
  for (const previous of [false, true]) {
    const f = fixture(t, previous);
    const reserved = { '__auth/index.html': 'platform auth content',
      'cloud-admin/console/config.json': '{"platform":"admin"}' };
    for (const [name, bytes] of Object.entries(reserved)) {
      fs.mkdirSync(path.dirname(path.join(f.remote, name)), { recursive: true });
      fs.writeFileSync(path.join(f.remote, name), bytes);
    }
    const result = f.run();
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.equal(result.report.platformObjectsPreserved, 2);
    for (const [name, bytes] of Object.entries(reserved)) {
      assert.equal(fs.readFileSync(path.join(f.remote, name), 'utf8'), bytes);
      assert.equal(f.calls().some(a => ['delete','deploy','download'].includes(a[1]) && a[2] === name), false);
    }
    assert.equal(f.run().status, 0);
  }
});

test('reserved directory lookalikes remain unknown and halt before any mutation', t => {
  for (const name of ['__auth', 'cloud-admin', '__auth-other/index.html', 'cloud-admin-extra/config.json']) {
    const f = fixture(t, false);
    fs.mkdirSync(path.dirname(path.join(f.remote, name)), { recursive: true });
    fs.writeFileSync(path.join(f.remote, name), 'unrelated file');
    const result = f.run();
    assert.equal(result.status, 1, name);
    assert.equal(f.calls().some(a => ['deploy','delete'].includes(a[1])), false);
  }
});

test('a current or previous release cannot claim platform-owned paths', t => {
  for (const which of ['current', 'previous']) {
    const f = fixture(t, true);
    const directory = which === 'current' ? f.current : f.remote;
    const name = '__auth/index.html', bytes = 'site must not own this';
    fs.mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    fs.writeFileSync(path.join(directory, name), bytes);
    const manifestPath = path.join(directory, 'release.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath));
    manifest.files.push({ path:name, bytes:Buffer.byteLength(bytes), sha256:createHash('sha256').update(bytes).digest('hex') });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.report.error, /reserved CloudBase platform directory/);
    assert.equal(f.calls().some(a => ['deploy','delete'].includes(a[1])), false);
  }
});

test('invalid prior identity or unknown canary bytes halt without remote mutation', t => {
  for (const corrupt of ['identity','canary']) {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.remote, corrupt === 'identity' ? 'release.json' : 'xiaoyi.js'), 'unrecognized');
    const result = f.run();
    assert.equal(result.status, 1);
    assert.equal(f.calls().some(a => ['deploy','delete'].includes(a[1])), false);
  }
});

test('unknown sizes at known current or previous paths halt before any overwrite', t => {
  for (const name of ['assets/new.webp', 'assets/withdrawn.webp']) {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.remote, name), 'unknown remote bytes');
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.report.error, /Remote file differs/);
    assert.equal(f.calls().some(a => ['deploy','delete'].includes(a[1])), false);
  }
});

test('failed upload keeps prior identity and can be retried without losing withdrawn paths', t => {
  const f = fixture(t, true, { failUploadOnce: true });
  const previous = fs.readFileSync(path.join(f.remote, 'release.json'));
  const failed = f.run();
  assert.equal(failed.status, 1);
  assert.deepEqual(fs.readFileSync(path.join(f.remote, 'release.json')), previous);
  assert.equal(f.calls().some(a => a[1] === 'delete'), false);
  const retried = f.run();
  assert.equal(retried.status, 0, retried.stderr + retried.stdout);
  assert.equal(fs.existsSync(path.join(f.remote, 'assets/withdrawn.webp')), false);
});

test('interrupted empty-hosting bootstrap remains retryable', t => {
  const f = fixture(t, false, { failUploadOnce: true });
  assert.equal(f.run().status, 1);
  assert.equal(f.run().status, 0);
});

test('bad upload receipt, changed inventory and stale public bytes never trigger cleanup', t => {
  for (const options of [{ unverified:true }, { unexpectedAfterUpload:true }, { stalePublic:true }]) {
    const f = fixture(t, true, options);
    const previous = fs.readFileSync(path.join(f.remote, 'release.json'));
    const result = f.run();
    assert.equal(result.status, 1, JSON.stringify(options));
    assert.equal(result.report.passed, false);
    assert.equal(f.calls().some(a => a[1] === 'delete'), false);
    assert.deepEqual(fs.readFileSync(path.join(f.remote, 'release.json')), previous);
  }
});

test('deletion errors or silent provider cleanup failures preserve the previous identity', t => {
  for (const options of [{ failDelete:true }, { silentDeleteFailure:true }]) {
    const f = fixture(t, true, options);
    const previous = fs.readFileSync(path.join(f.remote, 'release.json'));
    const result = f.run();
    assert.equal(result.status, 1);
    assert.equal(result.report.passed, false);
    assert.deepEqual(fs.readFileSync(path.join(f.remote, 'release.json')), previous);
    assert.equal(f.calls().filter(a => a[1] === 'deploy').length, 1);
  }
});

test('dirty or unexpected local commit fails before a remote CLI call', t => {
  for (const change of [{ sourceDirty:true }, { commit:'c'.repeat(40) }]) {
    const f = fixture(t);
    const name = path.join(f.current, 'release.json');
    fs.writeFileSync(name, JSON.stringify({ ...JSON.parse(fs.readFileSync(name)), ...change }));
    assert.equal(f.run().status, 1);
    assert.equal(f.calls().length, 0);
  }
});
