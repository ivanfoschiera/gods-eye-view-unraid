# God's Eye View for Unraid - packaging scaffold

Unofficial packaging for [God's Eye View v0.2.1](https://github.com/bilawalsidhu/gods-eye-view/releases/tag/v0.2.1), pinned to upstream commit `aa16b7c3b0166a89d8c7a6089e0aff53a22faaee`. This repository contains packaging scripts and review records, not a copy of the upstream application.

**A public GHCR image is not available from this scaffold yet.** Public image publication is disabled. Some artwork and a Google-derived runtime dataset have unresolved redistribution grants; see [LICENSE-AUDIT.md](LICENSE-AUDIT.md). The audit candidate preserves all runtime assets, layers and security checks. No replacement artwork, omitted ALPR layer, altered CCTV heights, or widened security policy is hidden in the packaging. The existing local Unraid installation is unaffected.

## What the daily workflow does

GitHub Actions checks upstream's latest non-prerelease release daily at 06:37 UTC. A new, unreviewed tag or moved commit reports **pending audit** and stops. An unchanged wrapper/upstream build that already has its immutable GHCR tag is skipped. Reviewed, unpublished candidates undergo archive, lockfile and source-manifest verification, `npm ci`, boundary/layer-token checks, the upstream unit suite, a production build and container HTTP/security/persistence checks. Binary artifacts and upstream source are never uploaded as workflow artifacts or committed here.

The workflow runs these checks on an ephemeral GitHub runner. It does not update Unraid or contact the current local installation. npm installation, upstream tests and compilation share one ordinary non-root container limited to one CPU and 3 GiB RAM. Runtime smoke tests use two CPUs, 2 GiB RAM and a PID limit of 256, matching the intended runtime limits. Neither container receives privileged mode, a Docker socket, host networking, device access or credentials. Image pulling/export and Docker's daemon bookkeeping are outside those container CPU limits.

## Source and runtime decisions

The official Node base is pinned by Linux AMD64 digest in the Dockerfile and policy (`24.21.0-bookworm-slim` is the descriptive tag). The official upstream archive and npm lockfile are pinned by SHA-256. The source and candidate file manifests include licensing/provenance documents and runtime assets. Archive extraction rejects paths outside the expected source root and symlinks.

Runtime uses upstream Vite **dev** on port 4173, matching the installed local mode. A production build is still required as a validation step. Dev mode retains the original dynamic provider configuration and middleware behavior; it also requires Vite, vite-plugin-cesium and `ws` from devDependencies. No broad `npm prune --omit=dev` is used. Chromium download is disabled; Puppeteer is not used for the HTTP smoke test. All installed dependency licenses/notices remain in the image, including Sharp/libvips notices. See the audit document for corresponding source and build references.

Only unused `docs/**`, upstream CI/agent metadata, and test-only `src/data/fixtures/**` are omitted from the candidate after upstream tests. Runtime source, binary assets, root LICENSE, DATA_SOURCES, THIRD_PARTY_NOTICES, sidecar READMEs and in-app credits are retained. There is no runtime patch set. Noncommercial and database licenses still apply to included datasets; the entire image must not be described as MIT or as generally licensed for commercial use.

## Intended Unraid configuration after a future approved publication

- Bridge networking; publish `UNRAID_LAN_IP:4173:4173` after checking that port is free. This app has no end-user authentication. Use a trusted LAN only; no internet exposure or router/firewall changes are part of this project.
- Run UID/GID `1000:1000`, `--cap-drop=ALL`, `--security-opt=no-new-privileges`, `--cpus=2`, `--memory=2g`, `--memory-swap=2g`, `--pids-limit=256`. No privileged mode, device mounts, Docker socket or broad host mounts.
- Persist only dedicated `appdata/gods-eye-view/cache` -> `/app/.gev-cache` and `appdata/gods-eye-view/logs` -> `/app/.gev-logs`. Prepare those two directories for UID/GID 1000. Vite's dependency cache stays in the container's writable layer; `.env` is neither copied nor mounted.
- Default keyless environment: `HOST=0.0.0.0`, `PORT=4173`, `OPENSKY_AUTH_MODE=anon`. Features that require provider keys remain unavailable. This project neither inserts credentials nor expands Host, Origin, MCP, Provider Settings or CSP policies.
- Keep the old container/image available for rollback. Only migrate after the package is made public, anonymous pull by digest succeeds, and a separate local UI/license review approves the candidate. This repository does not automate that migration.

## Publication gate and rollback

`policy/releases.json` defaults to `publication.enabled=false` and `runtime_redistribution_review=blocked`. The publication job also independently checks both fields. Enabling it requires a reviewed policy change with evidence resolving every runtime redistribution blocker and refreshed pinned audit inputs. A successful build cannot grant asset rights. New upstream releases always require a new reviewed allowlist entry; the daily check cannot add one or switch `latest` to unknown code automatically.

After that review, publishing uses the workflow's ephemeral `GITHUB_TOKEN` with `contents:read` and `packages:write` in the publishing job only; there is no PAT or repository secret. Tags are `upstream-<full-sha>-wrapper-<full-wrapper-sha>`, `build-<run-id>-<attempt>`, and `latest`. Immutable tags are checked before push and never intentionally overwritten. `latest` changes only after the immutable image is pushed and pulled anonymously for another smoke test. A rollback uses the previous immutable tag or recorded digest. GHCR package visibility must be explicitly set to public by its owner before the anonymous verification can pass; this workflow cannot assume new packages are public.

## Review and run in CI

The initial `push`/manual run audits the pinned active release even if a later release exists; the daily run evaluates the latest release and fails pending review when unknown or different from the selected active release. The workflow has no artifact-upload step. HTTP checks validate the HTML/module entry and assets, not actual WebGL rendering. A later Chrome UI review remains required. Read the workflow summary and logs, then review the policy and license evidence before any publication change. Locally, `.work/` is disposable staging and is ignored by Git; never add it, archives, caches, logs or generated source to a public commit.

Packaging scripts are MIT-licensed. Upstream and dependency material retains its separate licenses.
