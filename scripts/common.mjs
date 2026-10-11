import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORK = path.join(ROOT, '.work');
export const policy = JSON.parse(readFileSync(path.join(ROOT, 'policy/releases.json'), 'utf8'));
export const release = policy.reviewed_releases[policy.active_release];
if (!release || !/^[a-f0-9]{40}$/.test(release.commit)) throw new Error('Invalid reviewed source pin');
if (!/^[a-f0-9]{40}$/.test(release.layer_token_base_commit ?? '')) throw new Error('Invalid published layer-token baseline pin');
if (!/^docker\.io\/library\/node@sha256:[a-f0-9]{64}$/.test(policy.prep_node_image ?? '')) throw new Error('Preparation must use the pinned official Node image');
export const sourceRoot = path.join(WORK, 'upstream', `gods-eye-view-${release.commit}`);

export function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
export function assertHash(file, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected ?? '')) throw new Error(`Unrecorded hash: ${file}`);
  if (sha256(readFileSync(file)) !== expected) throw new Error(`Hash mismatch: ${file}`);
}
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
  return result.stdout;
}
export function walk(root, prefix = '') {
  const files = [];
  for (const name of readdirSync(path.join(root, prefix))) {
    const rel = prefix ? `${prefix}/${name}` : name;
    const stat = lstatSync(path.join(root, rel));
    if (stat.isSymbolicLink()) throw new Error(`Symlink not allowed in pinned source: ${rel}`);
    if (stat.isDirectory()) files.push(...walk(root, rel));
    else if (stat.isFile()) files.push(rel);
    else throw new Error(`Special file not allowed: ${rel}`);
  }
  return files.sort();
}
export function manifest(root, files = walk(root)) {
  return files.map(rel => `${sha256(readFileSync(path.join(root, rel)))}  ${rel}\n`).join('');
}
export function runtimePaths(files) {
  return files.filter(rel => !rel.startsWith('docs/') && !rel.startsWith('.agents/') &&
    !rel.startsWith('.github/') && !rel.startsWith('src/data/fixtures/') &&
    !rel.startsWith('.git') && !rel.startsWith('.env') && rel !== 'ENVIRONMENT' &&
    !rel.endsWith('/ENVIRONMENT'));
}
export function assertPublicationAllowed() {
  if (policy.publication.enabled !== true || policy.publication.runtime_redistribution_review !== 'approved') {
    throw new Error('PUBLICATION BLOCKED: unresolved runtime redistribution review; no image may be pushed.');
  }
  assertHash(path.join(ROOT, 'LICENSE-AUDIT.md'), policy.publication.approved_audit_sha256);
  if (!existsSync(path.join(WORK, 'checks-passed.json'))) throw new Error('Candidate checks have not passed');
  const evidence = JSON.parse(readFileSync(path.join(WORK, 'checks-passed.json')));
  if (!process.env.GITHUB_RUN_ID || !process.env.GITHUB_RUN_ATTEMPT ||
    evidence.run_id !== process.env.GITHUB_RUN_ID || evidence.run_attempt !== process.env.GITHUB_RUN_ATTEMPT ||
    evidence.source !== release.commit || evidence.wrapper !== process.env.GITHUB_SHA ||
    evidence.archive_sha256 !== release.archive_sha256 || evidence.lock_sha256 !== release.package_lock_sha256 ||
    evidence.runtime_manifest_sha256 !== release.runtime_manifest_sha256 ||
    evidence.policy_sha256 !== sha256(readFileSync(path.join(ROOT, 'policy/releases.json')))) {
    throw new Error('Checks do not match this source and wrapper revision');
  }
  const imageId = run('docker', ['image', 'inspect', '--format', '{{.Id}}', evidence.image],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (imageId !== evidence.image_id) throw new Error('Candidate image changed after smoke tests');
}
