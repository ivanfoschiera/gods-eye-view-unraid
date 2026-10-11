// This module cannot push unless the separate policy gate and fresh CI evidence pass.
import { mkdirSync, readFileSync, rmSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT, WORK, policy, release, run, assertPublicationAllowed } from './common.mjs';
import { immutableTag, registryDigest } from './release.mjs';

assertPublicationAllowed();
if (!/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? '')) throw new Error('Publishing requires a committed GitHub wrapper revision');
const evidence = JSON.parse(readFileSync(path.join(WORK, 'checks-passed.json')));
const buildTag = `build-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
const authDir = path.join(WORK, `docker-auth-${randomUUID()}`);
if (!authDir.startsWith(`${WORK}${path.sep}`)) throw new Error('Invalid auth workspace');
mkdirSync(authDir, { recursive: true, mode: 0o700 });
const docker = args => run('docker', ['--config', authDir, ...args]);
function login() {
  if (!process.env.GH_TOKEN || !process.env.GITHUB_ACTOR) throw new Error('Missing ephemeral GITHUB_TOKEN');
  const result = spawnSync('docker', ['--config', authDir, 'login', 'ghcr.io', '-u', process.env.GITHUB_ACTOR, '--password-stdin'], {
    input: process.env.GH_TOKEN, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) throw new Error('Ephemeral GHCR login failed');
}
try {
  login();
  let digest = await registryDigest(immutableTag, true);
  if (await registryDigest(buildTag, true)) throw new Error('Immutable build tag already exists; refusing overwrite');
  if (!digest) {
    docker(['tag', evidence.image, `${policy.image}:${immutableTag}`]);
    docker(['push', `${policy.image}:${immutableTag}`]);
    digest = await registryDigest(immutableTag, true);
  } else {
    console.log('Immutable upstream/wrapper tag exists; retain its original digest and revalidate it.');
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(digest ?? '')) throw new Error('Registry did not confirm an immutable digest');
  const reference = `${policy.image}@${digest}`;
  docker(['logout', 'ghcr.io']);
  // Empty, dedicated Docker config guarantees this pull uses no saved credentials.
  if (await registryDigest(immutableTag) !== digest) throw new Error('Anonymous pull is unavailable. Owner must set this GHCR package public, then rerun. latest is unchanged.');
  docker(['pull', reference]);
  const labels = JSON.parse(run('docker', ['--config', authDir, 'image', 'inspect', '--format', '{{json .Config.Labels}}', reference], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (labels['org.opencontainers.image.revision'] !== process.env.GITHUB_SHA || labels['io.gods-eye-view.upstream.commit'] !== release.commit || labels['io.gods-eye-view.policy.sha256'] !== evidence.policy_sha256) throw new Error('Registry image provenance does not match reviewed source/wrapper/policy');
  run(process.execPath, [path.join(ROOT, 'scripts/smoke.mjs'), reference]);
  assertPublicationAllowed();
  login();
  docker(['tag', reference, `${policy.image}:${buildTag}`]);
  docker(['push', `${policy.image}:${buildTag}`]);
  docker(['tag', reference, `${policy.image}:latest`]);
  docker(['push', `${policy.image}:latest`]);
  if (await registryDigest('latest') !== digest || await registryDigest(buildTag) !== digest) throw new Error('Published tags do not match the anonymously tested digest');
  const message = `Published tested ${policy.active_release}: ${reference}\nImmutable tags: ${immutableTag}, ${buildTag}. Unraid migration is still a separate local UI decision.`;
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
} finally {
  // Only the exact randomly-created directory below this job's .work is removed.
  rmSync(authDir, { recursive: true, force: true });
}
