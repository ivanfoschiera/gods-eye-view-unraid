import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const image = process.argv[2];
if (!image || image.startsWith('-')) throw new Error('Pass a local audit image or pinned registry digest');
const suffix = randomUUID().replaceAll('-', '');
const name = `gev-smoke-${suffix}`;
const cache = `${name}-cache`;
const logs = `${name}-logs`;
const marker = `CI_PERSISTENCE_${suffix}`;
function docker(args, allowFailure = false) {
  const result = spawnSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) throw new Error(`Docker operation ${args[0]} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}
function check(ok, message) { if (!ok) throw new Error(message); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let base;
async function request(route, options = {}) {
  return fetch(`${base}${route}`, { redirect: 'manual', signal: AbortSignal.timeout(10_000), ...options });
}
async function ready() {
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    try {
      const response = await request('/');
      if (response.status === 200 && docker(['inspect', '--format', '{{.State.Health.Status}}', name]) === 'healthy') return;
    } catch { /* Wait for startup and first health probe. */ }
    await pause(1000);
  }
  throw new Error('HTTP readiness and container healthy state were not achieved');
}
try {
  docker(['volume', 'create', cache]);
  docker(['volume', 'create', logs]);
  docker(['run', '-d', '--pull=never', '--platform=linux/amd64', '--name', name,
    '--cpus=2', '--memory=2g', '--memory-swap=2g', '--pids-limit=256', '--cap-drop=ALL',
    '--security-opt=no-new-privileges', '--publish', '127.0.0.1::4173',
    '--mount', `type=volume,src=${cache},dst=/app/.gev-cache`,
    '--mount', `type=volume,src=${logs},dst=/app/.gev-logs`, image]);
  const binding = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', name]));
  base = `http://127.0.0.1:${binding['4173/tcp'][0].HostPort}`;
  check(docker(['exec', name, 'node', '-e', 'process.stdout.write(String(process.getuid()))']) === '1000', 'Runtime must run as UID 1000');
  await ready();
  const document = await request('/');
  const html = await document.text();
  check(html.includes("God's Eye View") && html.includes('/src/main.js'), 'Application HTML/module entry missing');
  check(document.headers.get('x-content-type-options') === 'nosniff', 'Missing nosniff header');
  check(document.headers.get('x-frame-options') === 'DENY', 'Missing frame protection');
  check(document.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"), 'Missing original CSP');
  check((await request('/src/main.js')).status === 200, 'Vite did not serve the application module');
  for (const route of ['/logo.svg', '/location.svg', '/mic.svg', '/pin.svg', '/visual-presets.svg',
    '/src/layers/alpr/assets/alpr-marker-normal.png', '/src/layers/alpr/assets/alpr-marker-selected.png',
    '/src/layers/alpr/assets/alpr-marker-selected-brackets.png']) {
    const response = await request(route);
    check(response.status === 200 && response.headers.get('content-type')?.startsWith('image/'), `Original runtime asset not served: ${route}`);
  }
  check((await request('/', { headers: { host: 'untrusted.invalid' } })).status === 403, 'Host guard did not refuse foreign Host');
  check((await request('/api/realtime/debug-log', { method: 'POST', headers: { host: 'untrusted.invalid' }, body: '{}' })).status === 403, 'API route bypassed Host guard');
  check((await request('/api/realtime/debug-log', { method: 'POST', headers: { origin: 'https://untrusted.invalid', 'content-type': 'application/json' }, body: '{}' })).status === 403, 'Origin guard did not refuse cross-site write');
  check((await request('/mcp')).status === 403, 'MCP accepted a remote Docker-bridge request');
  check((await request('/api/setup/status')).status === 403, 'Provider Settings exposed status to a remote Docker-bridge request');
  check((await request('/api/__ci_missing')).status === 404, 'Unknown API route fell back to the app');
  const write = await request('/api/realtime/debug-log', { method: 'POST', headers: {
    origin: base, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json',
  }, body: JSON.stringify({ type: 'packaging-ci', marker }) });
  check(write.status === 204, 'Application could not write its dedicated persistent log');
  const testLog = () => docker(['exec', name, 'node', '-e',
    "const fs=require('node:fs');process.stdout.write(fs.readFileSync('/app/.gev-logs/realtime-conversations.jsonl','utf8').includes(process.argv[1])?'present':'missing')", marker]);
  check(testLog() === 'present', 'Application log marker missing');
  docker(['exec', name, 'node', '-e', "require('node:fs').writeFileSync('/app/.gev-cache/.ci-persistence',process.argv[1])", marker]);
  docker(['restart', name]); // Only this new ephemeral CI container.
  await ready();
  check(testLog() === 'present', 'Application log did not persist across container restart');
  check(docker(['exec', name, 'node', '-e', "process.stdout.write(require('node:fs').readFileSync('/app/.gev-cache/.ci-persistence','utf8'))"]) === marker, 'Cache volume did not persist across restart');
  console.log('PASS: non-root runtime, healthy HTTP/UI entry/assets, original Host/Origin/MCP/Provider Settings guards, app-log and cache-volume persistence.');
} finally {
  docker(['rm', '-f', name], true);
  docker(['volume', 'rm', cache, logs], true);
}
