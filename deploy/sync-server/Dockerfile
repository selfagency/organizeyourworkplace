# The Committee Workspace sync server.
#
# One process, one port, one file on a volume. Host it anywhere that runs
# a container: Coolify, Railway, Fly, Render, or your own box.
#
# The server never opens a blob. It stores and forwards ciphertext the
# members sealed with the room key, so a breach gives an attacker the
# labels, the sizes and the timing, and nothing else.
#
# Build from the repo root:
#   docker build -f deploy/sync-server/Dockerfile -t oyw-sync-server .
#
# Run:
#   docker run -p 8080:8080 -v oyw-sync-data:/data oyw-sync-server
# Pinned by digest as well as tag: the base image never moves on its own
# (AGENTS.md rule 22).
FROM node:24.16.0-alpine@sha256:21f403ab171f2dc89bad4dd69d7721bfd15f084ccb46cdd225f31f2bc59b5c9a

WORKDIR /app

# Only the server. No build step, no dependencies: the server is plain
# Node with no packages, so nothing needs to be installed or audited.
COPY deploy/sync-server/ ./sync-server/
COPY deploy/mailbox/guard.mjs ./mailbox/guard.mjs
COPY deploy/matchmaker/server.mjs ./matchmaker/server.mjs

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=:: \
    DATA_DIR=/data \
    DB_FILE=/data/mailbox.db

# The platforms that deploy containers check the health with curl or wget
# from inside the container. Busybox has wget but not curl, so curl goes in
# too. The version is pinned: if the alpine repo drops it, the build fails
# instead of silently taking a different one.
RUN apk add --no-cache curl=8.23.0-r0

# The queue lives here. Mount a volume so the data survives a redeploy.
RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]

USER node
EXPOSE 8080

# The platform uses this to decide the container is alive. The same check
# the platform runs itself: a GET to the health path.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -fsS "http://[::1]:$(printf %s "${PORT:-8080}")/health" || curl -fsS "http://127.0.0.1:${PORT:-8080}/health"

ENTRYPOINT ["node", "sync-server/main.mjs"]
