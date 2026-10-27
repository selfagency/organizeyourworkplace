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
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    DB_FILE=/data/mailbox.db

# The queue lives here. Mount a volume so the data survives a redeploy.
RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]

USER node
EXPOSE 8080

# The platform uses this to decide the container is alive.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "sync-server/main.mjs"]
