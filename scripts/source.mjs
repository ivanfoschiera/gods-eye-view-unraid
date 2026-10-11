// Standard-library archive/hash preparation only. Never executes upstream code.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, WORK, policy, release, sourceRoot, sha256, assertHash, run, walk, manifest, runtimePaths } from './common.mjs';

mkdirSync(WORK, { recursive: true });
const archive = path.join(WORK, 'upstream.tar.gz');
const expectedUrl = `https://codeload.github.com/${policy.upstream_repository}/tar.gz/${release.commit}`;
if (release.archive_url !== expectedUrl) throw new Error('Archive must use the exact official pinned codeload URL');
if (!existsSync(archive)) {
  const response = await fetch(expectedUrl, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error(`Archive download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 512 * 1024 * 1024) throw new Error('Archive exceeds reviewed size limit');
  if (sha256(bytes) !== release.archive_sha256) throw new Error('Downloaded archive SHA-256 mismatch');
  writeFileSync(archive, bytes, { flag: 'wx' });
}
assertHash(archive, release.archive_sha256);
const prefix = `gods-eye-view-${release.commit}/`;
const names = run('tar', ['-tzf', archive], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split(/\r?\n/);
for (const name of names) {
  if (!name.startsWith(prefix) || name.includes('\\') || name.split('/').includes('..') || name.includes('\0')) {
    throw new Error('Unsafe archive member');
  }
}
const types = run('tar', ['-tvzf', archive], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().split(/\r?\n/);
if (types.some(line => !['-', 'd'].includes(line[0]))) throw new Error('Archive links/special files are not allowed');
if (!existsSync(sourceRoot)) {
  mkdirSync(path.dirname(sourceRoot), { recursive: true });
  run('tar', ['-xzf', archive, '-C', path.dirname(sourceRoot), '--no-same-owner', '--no-same-permissions']);
}
const sourceFiles = walk(sourceRoot);
const fullManifest = manifest(sourceRoot, sourceFiles);
const runtimeManifest = manifest(sourceRoot, runtimePaths(sourceFiles));
assertHash(path.join(sourceRoot, 'package-lock.json'), release.package_lock_sha256);
const auditInputs = JSON.parse(readFileSync(path.join(ROOT, 'policy/audit-inputs.json'), 'utf8'));
if (auditInputs.source !== release.commit) throw new Error('Audit input source pin mismatch');
for (const [file, hash] of Object.entries(auditInputs.files)) assertHash(path.join(sourceRoot, file), hash);
if (sha256(fullManifest) !== release.source_manifest_sha256) throw new Error('Source manifest does not match reviewed pin');
if (sha256(runtimeManifest) !== release.runtime_manifest_sha256) throw new Error('Runtime manifest does not match reviewed pin');
writeFileSync(path.join(WORK, 'source.manifest'), fullManifest);
writeFileSync(path.join(WORK, 'runtime.manifest'), runtimeManifest);
console.log(`Verified official source ${policy.active_release} ${release.commit}; ${sourceFiles.length} files.`);
console.log(`Archive SHA-256 ${release.archive_sha256}; lockfile SHA-256 ${release.package_lock_sha256}`);
