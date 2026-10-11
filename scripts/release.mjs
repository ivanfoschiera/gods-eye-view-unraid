import { appendFileSync } from 'node:fs';
import { policy, release } from './common.mjs';

export const imagePath = policy.image.replace(/^ghcr\.io\//, '');
if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(imagePath)) throw new Error('Invalid GHCR image path');
export const immutableTag = `upstream-${release.commit}-wrapper-${process.env.GITHUB_SHA ?? 'local-audit'}`;
export async function registryDigest(tag, authenticated = false) {
  const headers = {};
  if (authenticated) {
    if (!process.env.GH_TOKEN || !process.env.GITHUB_ACTOR) throw new Error('Missing ephemeral registry identity');
    headers.authorization = `Basic ${Buffer.from(`${process.env.GITHUB_ACTOR}:${process.env.GH_TOKEN}`).toString('base64')}`;
  }
  const auth = await fetch(`https://ghcr.io/token?service=ghcr.io&scope=${encodeURIComponent(`repository:${imagePath}:pull`)}`, { headers, signal: AbortSignal.timeout(30_000) });
  if ([401, 403, 404].includes(auth.status) && !authenticated) return null;
  if (!auth.ok) throw new Error(`GHCR token request failed: HTTP ${auth.status}`);
  const token = (await auth.json()).token;
  const response = await fetch(`https://ghcr.io/v2/${imagePath}/manifests/${tag}`, { method: 'HEAD', headers: {
    authorization: `Bearer ${token}`, accept: 'application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.index.v1+json',
  }, signal: AbortSignal.timeout(30_000) });
  if ([401, 403, 404].includes(response.status) && !authenticated) return null;
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GHCR manifest check failed: HTTP ${response.status}`);
  return response.headers.get('docker-content-digest');
}
async function github(route) {
  const headers = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
  if (process.env.GH_TOKEN) headers.authorization = `Bearer ${process.env.GH_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${policy.upstream_repository}/${route}`, { headers, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Official GitHub API lookup failed: HTTP ${response.status}`);
  return response.json();
}
async function tagCommit(tag) {
  let object = (await github(`git/ref/tags/${encodeURIComponent(tag)}`)).object;
  for (let depth = 0; object.type === 'tag' && depth < 5; depth++) object = (await github(`git/tags/${object.sha}`)).object;
  if (object.type !== 'commit') throw new Error('Release tag did not resolve to a commit');
  return object.sha;
}
function output(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}
function summary(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n\n`);
}
if (process.argv[2] === 'check') {
  const latest = await github('releases/latest');
  if (latest.draft || latest.prerelease) throw new Error('Latest release is not stable');
  const latestCommit = await tagCommit(latest.tag_name);
  const latestReview = policy.reviewed_releases[latest.tag_name];
  const latestApproved = latestReview?.commit === latestCommit;
  summary(`Latest upstream stable release: ${latest.tag_name} (${latestCommit}).`);
  if (!latestApproved) summary('PENDING AUDIT: latest release is outside the reviewed commit allowlist; it will not be built or published.');
  if (process.env.GITHUB_EVENT_NAME === 'schedule' && (!latestApproved || latest.tag_name !== policy.active_release)) {
    output('run_audit', 'false'); output('can_publish', 'false');
    throw new Error('New, moved or not-yet-selected upstream release requires a reviewed license/source policy update');
  }
  if (await tagCommit(policy.active_release) !== release.commit) throw new Error('Pinned reviewed release tag moved; refusing build');
  const publicImmutable = await registryDigest(immutableTag);
  const alreadyPromoted = publicImmutable && await registryDigest('latest') === publicImmutable;
  const publicationEnabled = policy.publication.enabled === true && policy.publication.runtime_redistribution_review === 'approved';
  const scheduledUnchanged = process.env.GITHUB_EVENT_NAME === 'schedule' && latest.tag_name === policy.active_release && !publicationEnabled;
  const runAudit = !alreadyPromoted && !scheduledUnchanged;
  output('run_audit', String(runAudit));
  output('can_publish', String(runAudit && publicationEnabled));
  if (alreadyPromoted) summary('No new wrapper/upstream build: immutable image and latest already match; skipped.');
  else if (scheduledUnchanged) summary('Reviewed upstream unchanged; publication remains blocked. Initial push/manual runs perform candidate tests.');
  else summary('Audit the pinned active release. No automatic allowlist update or Unraid migration.');
  if (!publicationEnabled) summary(`PUBLIC IMAGE BLOCKED: ${policy.publication.reason}`);
}
