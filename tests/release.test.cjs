// Tests only: GitHub CLI is replaced with a recorder; no releases are created.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vips-release-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['build', 'mock-bin']) fs.mkdirSync(path.join(root, dir));
  for (const file of ['release.sh', 'package-version']) fs.copyFileSync(path.join(__dirname, '..', file), path.join(root, file));
  for (const file of ['heroku-24.tar.gz', 'heroku-24.tar.gz.sha256', 'heroku-24.config.log']) fs.writeFileSync(path.join(root, 'build', file), 'fixture');
  fs.writeFileSync(path.join(root, 'mock-bin/gh'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.TEST_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv[3] === 'create' && process.env.FAIL_CREATE === '1') process.exit(1);
`, { mode: 0o755 });
  const log = path.join(root, 'calls.jsonl');
  const version = fs.readFileSync(path.join(root, 'package-version'), 'utf8').trim();
  const sha = 'a'.repeat(40);
  return {
    root, version, sha,
    calls: () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) : [],
    run: (env = {}) => spawnSync('bash', [path.join(root, 'release.sh')], {
      encoding: 'utf8', env: { ...process.env, PATH: path.join(root, 'mock-bin') + ':' + process.env.PATH,
        TEST_LOG: log, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/master', GITHUB_SHA: sha, ...env },
    }),
  };
}

test('master publication uploads a draft for the tested commit, then publishes', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const [create, publish] = f.calls();
  assert.deepEqual(create.slice(0, 6), ['release', 'create', `v${f.version}`, 'build/heroku-24.tar.gz', 'build/heroku-24.tar.gz.sha256', 'build/heroku-24.config.log']);
  assert.equal(create[create.indexOf('--target') + 1], f.sha);
  assert.ok(create.includes('--draft'));
  assert.deepEqual(publish, ['release', 'edit', `v${f.version}`, '--draft=false']);
  assert.equal(f.calls().length, 2);
});
test('PRs, manual dispatches and non-master pushes cannot publish', t => {
  const f = fixture(t);
  for (const env of [{ GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_REF: 'refs/heads/review' }]) {
    assert.notEqual(f.run(env).status, 0);
  }
  assert.deepEqual(f.calls(), []);
});
test('an existing release or failed upload cannot be published or overwritten', t => {
  const f = fixture(t);
  assert.notEqual(f.run({ FAIL_CREATE: '1' }).status, 0);
  assert.equal(f.calls().length, 1);
  assert.equal(f.calls()[0][1], 'create');
});
test('missing assets or an invalid package revision fail before GitHub writes', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'package-version'), '8.17.1\n');
  assert.notEqual(f.run().status, 0);
  fs.writeFileSync(path.join(f.root, 'package-version'), f.version + '\n');
  fs.writeFileSync(path.join(f.root, 'build/heroku-24.tar.gz'), '');
  assert.notEqual(f.run().status, 0);
  assert.deepEqual(f.calls(), []);
});
