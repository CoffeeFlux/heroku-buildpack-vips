// Tests only: fake release downloads exercise installer/cache behavior offline.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vips-installer-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['app', 'cache', 'env', 'buildpack/bin', 'mock-bin', 'release', 'payload/bin', 'payload/lib/pkgconfig']) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  fs.copyFileSync(path.join(__dirname, '../bin/compile'), path.join(root, 'buildpack/bin/compile'));
  fs.copyFileSync(path.join(__dirname, '../package-version'), path.join(root, 'buildpack/package-version'));
  fs.writeFileSync(path.join(root, 'payload/bin/vips'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'payload/lib/pkgconfig/vips-cpp.pc'), 'prefix=/usr/local/vips\nlibdir=${prefix}/lib\n');
  const archive = path.join(root, 'release/heroku-24.tar.gz');
  assert.equal(spawnSync('tar', ['-czf', archive, '-C', path.join(root, 'payload'), '.']).status, 0);
  fs.writeFileSync(archive + '.sha256', createHash('sha256').update(fs.readFileSync(archive)).digest('hex') + '  heroku-24.tar.gz\n');
  fs.writeFileSync(path.join(root, 'mock-bin/uname'), '#!/bin/sh\necho x86_64\n', { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'mock-bin/curl'), `#!/bin/bash
set -eu
if [[ \${FAIL_DOWNLOAD:-0} == 1 ]]; then exit 22; fi
url=''
output=''
while (( $# )); do
  case "$1" in
    https://*) url=$1 ;;
    -o) shift; output=$1 ;;
  esac
  shift
done
echo "$url" >> "$TEST_ROOT/downloads.log"
cp "$TEST_ROOT/release/\${url##*/}" "$output"
`, { mode: 0o755 });
  function run(app = 'app', extraEnv = {}) {
    fs.mkdirSync(path.join(root, app), { recursive: true });
    return spawnSync('bash', [path.join(root, 'buildpack/bin/compile'), path.join(root, app), path.join(root, 'cache'), path.join(root, 'env')], {
      encoding: 'utf8', env: { ...process.env, STACK: 'heroku-24', TEST_ROOT: root, PATH: path.join(root, 'mock-bin') + ':' + process.env.PATH, ...extraEnv },
    });
  }
  const version = fs.readFileSync(path.join(root, 'buildpack/package-version'), 'utf8').trim();
  return { root, archive, run, version, complete: path.join(root, 'cache/vips-coffeeflux', version, 'heroku-24/.complete') };
}

const linuxOnly = { skip: process.platform !== 'linux' }; // Installer uses GNU sed, as Heroku does.
test('cold install verifies the fork release; repeat build uses its own cache', linuxOnly, t => {
  const f = fixture(t);
  const first = f.run();
  assert.equal(first.status, 0, first.stderr);
  assert.ok(fs.existsSync(f.complete));
  const urls = fs.readFileSync(path.join(f.root, 'downloads.log'), 'utf8').trim().split('\n');
  assert.equal(urls.length, 2);
  assert.ok(urls.every(url => url.startsWith(`https://github.com/CoffeeFlux/heroku-buildpack-vips/releases/download/v${f.version}/`)));
  assert.match(fs.readFileSync(path.join(f.root, 'app/vendor/vips/lib/pkgconfig/vips-cpp.pc'), 'utf8'), /prefix=\$\{pcfiledir\}\/\.\.\/\.\./);
  assert.match(fs.readFileSync(path.join(f.root, 'app/.profile.d/vips.sh'), 'utf8'), /\$HOME\/vendor\/vips\/lib/);
  const cached = f.run('second-app', { FAIL_DOWNLOAD: '1' });
  assert.equal(cached.status, 0, cached.stderr);
  assert.notEqual(f.run().status, 0, 'must not overlay stale vendor libraries');
});
test('checksum mismatch never installs or marks the cache complete', linuxOnly, t => {
  const f = fixture(t);
  fs.appendFileSync(f.archive, 'corrupt');
  assert.notEqual(f.run().status, 0);
  assert.equal(fs.existsSync(f.complete), false);
  assert.equal(fs.existsSync(path.join(f.root, 'app/vendor/vips')), false);
});
test('download failure can be retried without a poisoned cache', linuxOnly, t => {
  const f = fixture(t);
  assert.notEqual(f.run('app', { FAIL_DOWNLOAD: '1' }).status, 0);
  assert.equal(fs.existsSync(f.complete), false);
  const retry = f.run();
  assert.equal(retry.status, 0, retry.stderr);
});
test('unsupported stack and invalid release version fail before downloading', linuxOnly, t => {
  const f = fixture(t);
  assert.notEqual(f.run('app', { STACK: 'heroku-22' }).status, 0);
  fs.writeFileSync(path.join(f.root, 'env/VIPS_VERSION'), '../../other');
  assert.notEqual(f.run().status, 0);
  assert.equal(fs.existsSync(path.join(f.root, 'downloads.log')), false);
});
