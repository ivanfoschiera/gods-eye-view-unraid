# Audit candidate only. Public redistribution is blocked by policy/releases.json.
# Build context is .work/context, created by scripts/candidate.mjs after tests.
FROM docker.io/library/node@sha256:51b1100cc2a83d370c6a60952e3f2989c8a43159d0e38586e090f3b3326efefd
ARG UPSTREAM_COMMIT
ARG WRAPPER_COMMIT
ARG POLICY_SHA256
LABEL org.opencontainers.image.title="God's Eye View - unofficial Unraid packaging" \
      org.opencontainers.image.source="https://github.com/ivanfoschiera/gods-eye-view-unraid" \
      org.opencontainers.image.revision=$WRAPPER_COMMIT \
      io.gods-eye-view.upstream.commit=$UPSTREAM_COMMIT \
      io.gods-eye-view.policy.sha256=$POLICY_SHA256
WORKDIR /app
COPY --chown=1000:1000 source/ /app/
COPY licenses/ /licenses/
ENV HOST=0.0.0.0 PORT=4173 OPENSKY_AUTH_MODE=anon \
    PUPPETEER_SKIP_DOWNLOAD=true HOME=/home/node
USER 1000:1000
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4173/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
# Preserve the upstream development middleware and guards used by the local install.
# No npm install, upstream script, or compilation runs inside docker build.
CMD ["node", "node_modules/vite/bin/vite.js", "--host", "0.0.0.0", "--port", "4173", "--strictPort"]
