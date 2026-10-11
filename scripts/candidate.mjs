// Stage the exact reviewed runtime files after upstream tests. No runtime patch.
import { mkdirSync, readFileSync, writeFileSync, cpSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, WORK, release, sourceRoot, assertHash, sha256, manifest } from './common.mjs';

const pinned = readFileSync(path.join(WORK, 'runtime.manifest'), 'utf8');
if (sha256(pinned) !== release.runtime_manifest_sha256) throw new Error('Runtime manifest changed');
const files = pinned.trimEnd().split('\n').map(line => line.slice(66));
if (manifest(sourceRoot, files) !== pinned) throw new Error('Upstream tests/build modified pinned runtime files');
assertHash(path.join(sourceRoot, 'package-lock.json'), release.package_lock_sha256);
const context = path.join(WORK, 'context');
if (existsSync(context)) throw new Error('Candidate context already exists; use a fresh workspace');
const destination = path.join(context, 'source');
for (const rel of files) {
  mkdirSync(path.dirname(path.join(destination, rel)), { recursive: true });
  copyFileSync(path.join(sourceRoot, rel), path.join(destination, rel));
}
if (!existsSync(path.join(sourceRoot, 'node_modules/vite/bin/vite.js'))) throw new Error('npm ci has not completed');
cpSync(path.join(sourceRoot, 'node_modules'), path.join(destination, 'node_modules'), { recursive: true, dereference: false, verbatimSymlinks: true });
// These mounts have explicit owners even when the host initially uses empty volumes.
mkdirSync(path.join(destination, '.gev-cache'), { recursive: true });
mkdirSync(path.join(destination, '.gev-logs'), { recursive: true });
const licenses = path.join(context, 'licenses');
mkdirSync(licenses, { recursive: true });
for (const file of ['LICENSE', 'DATA_SOURCES.md', 'THIRD_PARTY_NOTICES.md']) {
  copyFileSync(path.join(sourceRoot, file), path.join(licenses, file));
}
copyFileSync(path.join(ROOT, 'LICENSE-AUDIT.md'), path.join(licenses, 'PACKAGING-LICENSE-AUDIT.md'));
copyFileSync(path.join(WORK, 'runtime.manifest'), path.join(licenses, 'runtime.manifest'));
writeFileSync(path.join(licenses, 'SOURCE.json'), `${JSON.stringify({ ...release, runtime_patches: [] }, null, 2)}\n`);
console.log('Audit-only candidate staged with original runtime assets and installed dependency notices.');
console.log('No binary/source workflow artifact will be uploaded. Public push remains subject to the independent policy gate.');
