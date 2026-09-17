import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  changedPaths,
  siteChanged,
  gatePassed,
  deploymentAllowed,
} from '../scripts/ci/policy.mjs';

test('only explicitly non-site documentation skips website work', () => {
  assert.equal(siteChanged(['README.md']), false);
  assert.equal(siteChanged(['docs/ci.md', 'docs/validation.md']), false);
  for (const path of [
    'src/pages/help.md',
    'src/content/guide.mdx',
    'docs/new.md',
    'package.json',
    'package-lock.json',
    'astro.config.mjs',
    '.github/workflows/deploy.yml',
    'tests/browser/site.spec.ts',
    'scripts/build.mjs',
    'public/favicon.svg',
    '.nvmrc',
  ]) {
    assert.equal(siteChanged([path]), true, path);
    assert.equal(siteChanged(['README.md', path]), true, `Mixed: ${path}`);
  }
});

test('gate fails closed for failures, cancellation, malformed outputs and unexpected skips', () => {
  assert.equal(gatePassed('success', 'false', 'skipped'), true);
  assert.equal(gatePassed('success', 'true', 'success'), true);
  for (const result of ['failure', 'cancelled', 'skipped', '']) {
    assert.equal(gatePassed(result, 'false', 'skipped'), false);
    assert.equal(gatePassed('success', 'true', result), false);
  }
  for (const output of ['', 'FALSE', 'unknown'])
    assert.equal(gatePassed('success', output, 'success'), false);
  assert.equal(gatePassed('success', 'false', 'failure'), false);
});

test('release requires exact current push commit, site change and successful gate', () => {
  assert.equal(
    deploymentAllowed('push', 'refs/heads/main', 'success', 'true', 'B', 'B'),
    true,
  );
  for (const args of [
    ['push', 'refs/heads/main', 'failure', 'true', 'B', 'B'],
    ['push', 'refs/heads/main', 'success', 'false', 'B', 'B'],
    ['pull_request', 'refs/heads/main', 'success', 'true', 'B', 'B'],
    ['merge_group', 'refs/heads/main', 'success', 'true', 'B', 'B'],
    ['push', 'refs/heads/main', 'success', 'true', 'A', 'B'],
  ])
    assert.equal(deploymentAllowed(...args), false);
});

test('real git diffs cover PR merge bases, renames, deletions and a pending site release', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kcpic-policy-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const commit = () => {
    git('add', '-A');
    git('commit', '-m', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  try {
    git('init', '-b', 'main');
    git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'user.name', 'CI fixture');
    mkdirSync(join(cwd, 'src/pages'), { recursive: true });
    writeFileSync(join(cwd, 'README.md'), 'documentation\n');
    writeFileSync(join(cwd, 'src/pages/help.md'), 'rendered content\n');
    const deployed = commit();
    writeFileSync(join(cwd, 'README.md'), 'documentation update\n');
    const docs = commit();
    assert.equal(siteChanged(changedPaths(deployed, docs, cwd)), false);
    writeFileSync(join(cwd, 'src/pages/help.md'), 'updated rendered content\n');
    const site = commit();
    writeFileSync(join(cwd, 'README.md'), 'follow-up docs\n');
    const latest = commit();
    assert.equal(siteChanged(changedPaths(site, latest, cwd)), false);
    assert.equal(
      siteChanged(changedPaths(deployed, latest, cwd)),
      true,
      'README push includes pending site release',
    );
    assert.equal(
      deploymentAllowed(
        'push',
        'refs/heads/main',
        'success',
        'true',
        site,
        latest,
      ),
      false,
    );
    assert.equal(
      deploymentAllowed(
        'push',
        'refs/heads/main',
        'success',
        'true',
        latest,
        latest,
      ),
      true,
    );
    mkdirSync(join(cwd, 'docs'));
    renameSync(join(cwd, 'src/pages/help.md'), join(cwd, 'docs/validation.md'));
    const renamed = commit();
    assert.deepEqual(changedPaths(latest, renamed, cwd), [
      'src/pages/help.md',
      'docs/validation.md',
    ]);
    assert.equal(siteChanged(changedPaths(latest, renamed, cwd)), true);
    renameSync(
      join(cwd, 'docs/validation.md'),
      join(cwd, 'src/pages/guide.mdx'),
    );
    const returned = commit();
    assert.equal(siteChanged(changedPaths(renamed, returned, cwd)), true);
    unlinkSync(join(cwd, 'src/pages/guide.mdx'));
    const deleted = commit();
    assert.equal(siteChanged(changedPaths(returned, deleted, cwd)), true);
    git('checkout', '-b', 'pr', docs);
    writeFileSync(join(cwd, 'README.md'), 'PR documentation\n');
    const pr = commit();
    const mergeBase = git('merge-base', deleted, pr);
    assert.equal(
      siteChanged(changedPaths(mergeBase, pr, cwd)),
      false,
      'Unrelated main changes do not pollute PR diff',
    );
    assert.throws(() => changedPaths('bad-sha', pr, cwd));
    assert.throws(() => changedPaths('a'.repeat(40), pr, cwd));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
