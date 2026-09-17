import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { changedPaths, siteChanged } from './policy.mjs';

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const head = process.env.GITHUB_SHA;
const repo = process.env.GITHUB_REPOSITORY;

async function api(path) {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`Deployment history API failed: ${response.status}`);
  return response.json();
}

// Bound history lookup. Missing/too-old history means full validation, never a skip.
async function deployedSha() {
  for (let page = 1; page <= 5; page++) {
    const deployments = await api(
      `deployments?environment=github-pages&per_page=20&page=${page}`,
    );
    for (const deployment of deployments) {
      const statuses = await api(
        `deployments/${deployment.id}/statuses?per_page=100`,
      );
      if (statuses.some((status) => status.state === 'success'))
        return deployment.sha;
    }
    if (deployments.length < 20) break;
  }
  return null;
}

let changed;
let reason;
if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
  const base = git(
    'merge-base',
    event.pull_request.base.sha,
    event.pull_request.head.sha,
  );
  changed = siteChanged(changedPaths(base, event.pull_request.head.sha));
  reason = 'PR merge-base to head';
} else if (process.env.GITHUB_EVENT_NAME === 'merge_group') {
  changed = siteChanged(
    changedPaths(event.merge_group.base_sha, event.merge_group.head_sha),
  );
  reason = 'merge queue base to head';
} else if (process.env.GITHUB_EVENT_NAME === 'push') {
  const deployed = await deployedSha();
  const before = event.before;
  const known = (sha) => sha && /^[a-f0-9]{40}$/.test(sha) && !/^0+$/.test(sha);
  if (!known(deployed) || !known(before)) {
    changed = true;
    reason = 'No usable deployment/push baseline; validate conservatively';
  } else {
    // Non-ancestor baselines can follow a force push: validate rather than skip.
    const { spawnSync } = await import('node:child_process');
    const ancestry = spawnSync('git', [
      'merge-base',
      '--is-ancestor',
      deployed,
      head,
    ]);
    if (ancestry.error || ancestry.status > 1 || ancestry.status === null)
      throw new Error('Cannot read deployment ancestry');
    changed =
      ancestry.status === 1 ||
      siteChanged([
        ...changedPaths(before, head),
        ...changedPaths(deployed, head),
      ]);
    reason = `Push range plus last successful Pages deployment ${deployed}`;
  }
} else {
  throw new Error('Unsupported event; refusing to skip checks');
}
appendFileSync(process.env.GITHUB_OUTPUT, `site_changed=${changed}\n`);
console.log(`${reason}: site_changed=${changed}`);
