import { execFileSync } from 'node:child_process';

// Only these files are known to be maintainer documentation, never site input.
export const documentation = new Set([
  'README.md',
  'docs/content-migration.md',
  'docs/validation.md',
  'docs/ci.md',
]);

export function changedPaths(base, head, cwd = process.cwd()) {
  for (const sha of [base, head]) {
    if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid comparison SHA');
  }
  const fields = execFileSync(
    'git',
    ['diff', '--name-status', '-z', '--find-renames', base, head, '--'],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).split('\0');
  fields.pop();
  const paths = [];
  while (fields.length) {
    const status = fields.shift();
    if (!/^[ACDMRTUXB][0-9]*$/.test(status))
      throw new Error(`Unexpected diff status: ${status}`);
    const count = /^[RC]/.test(status) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const path = fields.shift();
      if (!path) throw new Error('Incomplete diff');
      paths.push(path);
    }
  }
  return paths;
}

export function siteChanged(paths) {
  return paths.some((path) => !documentation.has(path));
}

export function gatePassed(detection, changed, validation) {
  return (
    detection === 'success' &&
    ((changed === 'false' && validation === 'skipped') ||
      (changed === 'true' && validation === 'success'))
  );
}

export function deploymentAllowed(event, ref, gate, changed, sha, currentHead) {
  return (
    event === 'push' &&
    ref === 'refs/heads/main' &&
    gate === 'success' &&
    changed === 'true' &&
    sha === currentHead
  );
}
