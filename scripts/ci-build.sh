#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

node scripts/source.mjs
base=$(node --input-type=module -e 'import {policy} from "./scripts/common.mjs"; console.log(policy.prep_node_image)')
source_dir=$(node --input-type=module -e 'import {sourceRoot} from "./scripts/common.mjs"; console.log(sourceRoot)')
upstream_sha=$(node --input-type=module -e 'import {release} from "./scripts/common.mjs"; console.log(release.commit)')
layer_base_sha=$(node --input-type=module -e 'import {release} from "./scripts/common.mjs"; console.log(release.layer_token_base_commit)')
upstream_url=$(node --input-type=module -e 'import {policy} from "./scripts/common.mjs"; console.log(`https://github.com/${policy.upstream_repository}.git`)')
wrapper_sha=${GITHUB_SHA:-local-audit}
policy_sha=$(node --input-type=module -e 'import {readFileSync} from "node:fs"; import {sha256} from "./scripts/common.mjs"; console.log(sha256(readFileSync("policy/releases.json")))')
image="gev-audit:${wrapper_sha}"

docker pull --platform linux/amd64 "$base"
# Some upstream launcher tests deliberately remove HOME from child environments.
# Give the numeric runner UID a real passwd identity without changing the image,
# the host's accounts, or ownership of the dedicated source tree.
prep_uid=$(id -u)
prep_gid=$(id -g)
if [ "$prep_uid" -eq 0 ]; then
  printf 'Preparation must run as a non-root runner UID.\n' >&2
  exit 1
fi
prep_passwd="$PWD/.work/prep-passwd"
docker run --rm --platform linux/amd64 --user 1000:1000 \
  --network=none --read-only --cpus=1 --memory=128m --memory-swap=128m \
  --pids-limit=32 --cap-drop=ALL --security-opt=no-new-privileges \
  "$base" cat /etc/passwd > "$prep_passwd"
if ! awk -F: -v uid="$prep_uid" '$3 == uid { found = 1 } END { exit !found }' "$prep_passwd"; then
  printf 'gevci-%s:x:%s:%s:Ephemeral CI preparation:/tmp:/bin/sh\n' \
    "$prep_uid" "$prep_uid" "$prep_gid" >> "$prep_passwd"
fi
chmod 0600 "$prep_passwd"
# All npm lifecycle scripts, tests and compilation share this one cgroup.
# No credentials, ports, Docker socket or other host directory are passed in.
docker run --rm --platform linux/amd64 \
  --user "$prep_uid:$prep_gid" \
  --cpus=1 --memory=3g --memory-swap=3g \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --tmpfs /tmp:rw,exec,nosuid,nodev,size=512m \
  --mount "type=bind,src=$source_dir,dst=/app" --workdir /app \
  --mount "type=bind,src=$prep_passwd,dst=/etc/passwd,readonly" \
  --env HOME=/tmp --env PUPPETEER_SKIP_DOWNLOAD=true \
  --env OPENSKY_AUTH_MODE=anon --env GIT_TERMINAL_PROMPT=0 \
  --env "GEV_UPSTREAM_URL=$upstream_url" --env "GEV_SOURCE_COMMIT=$upstream_sha" \
  --env "GEV_LAYER_BASE=$layer_base_sha" \
  "$base" sh -euc '
    # Upstream tests create executable npm stubs in their temporary fixtures.
    # Docker tmpfs keeps noexec by default unless exec is explicitly supplied.
    probe=$(mktemp /tmp/gev-ci-exec.XXXXXX)
    printf "#!/bin/sh\nexit 0\n" > "$probe"
    chmod 0700 "$probe"
    "$probe"
    rm -f -- "$probe"
    env -i PATH="$PATH" node -e "console.log(require(\"node:os\").homedir())"
    env -i PATH="$PATH" npm --version
    git --version
    git init --quiet .
    git config core.autocrlf false
    git config core.filemode false
    git -c credential.helper= fetch --quiet --no-tags --depth=1 "$GEV_UPSTREAM_URL" "$GEV_SOURCE_COMMIT"
    test "$(git rev-parse FETCH_HEAD)" = "$GEV_SOURCE_COMMIT"
    git reset --mixed "$GEV_SOURCE_COMMIT" >/dev/null
    git diff --quiet "$GEV_SOURCE_COMMIT" -- .
    if [ "$GEV_LAYER_BASE" != "$GEV_SOURCE_COMMIT" ]; then
      git -c credential.helper= fetch --quiet --no-tags --depth=1 "$GEV_UPSTREAM_URL" "$GEV_LAYER_BASE"
      test "$(git rev-parse FETCH_HEAD)" = "$GEV_LAYER_BASE"
    fi
    npm ci --no-audit --no-fund
    node --test --test-concurrency=1 src/devCctv.test.mjs src/toolProjectRoot.test.mjs
    npm run check:boundaries
    npm run layer-token:check -- --base-ref "$GEV_LAYER_BASE"
    npm test
    npm run build
  '

node scripts/candidate.mjs
docker build --platform linux/amd64 \
  --build-arg "UPSTREAM_COMMIT=$upstream_sha" \
  --build-arg "WRAPPER_COMMIT=$wrapper_sha" \
  --build-arg "POLICY_SHA256=$policy_sha" \
  --tag "$image" --file Dockerfile .work/context
node scripts/smoke.mjs "$image"
image_id=$(docker image inspect --format '{{.Id}}' "$image")
AUDIT_IMAGE_ID="$image_id" AUDIT_IMAGE="$image" node --input-type=module -e '
  import {writeFileSync,readFileSync} from "node:fs";
  import path from "node:path";
  import {ROOT,WORK,release,sha256} from "./scripts/common.mjs";
  writeFileSync(path.join(WORK,"checks-passed.json"), JSON.stringify({
    source:release.commit, wrapper:process.env.GITHUB_SHA ?? "local-audit",
    run_id:process.env.GITHUB_RUN_ID, run_attempt:process.env.GITHUB_RUN_ATTEMPT,
    image:process.env.AUDIT_IMAGE, image_id:process.env.AUDIT_IMAGE_ID,
    archive_sha256:release.archive_sha256, lock_sha256:release.package_lock_sha256,
    runtime_manifest_sha256:release.runtime_manifest_sha256,
    policy_sha256:sha256(readFileSync(path.join(ROOT,"policy/releases.json"))),
    checks:["archive","lockfile","source-manifest","runtime-manifest","npm-ci","boundaries","layer-token","upstream-unit-tests","vite-build","http","host-origin-guards","health","persistent-app-log","persistent-cache-volume"]
  },null,2)+"\n");'
printf 'Audit candidate checks passed; publication still requires the independent policy gate.\n'
