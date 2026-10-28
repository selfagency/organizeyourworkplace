# The site image: the whole static site, the app, and Caddy to serve it.
#
# Build stage: Node compiles the site the way CI does, reading the content
# from the cms. The cms credentials come in as BuildKit secrets, never as
# build args or env in the image metadata:
#
#   docker build -f deploy/site.Dockerfile \
#     --secret id=PB_URL,env=PB_URL --secret id=PB_TOKEN,env=PB_TOKEN .
#
# Serve stage: Caddy with the site's rules (deploy/proxy/Caddyfile): strict
# headers, the Service-Worker-Allowed header, the sync paths proxied to the
# sync service in the same stack.
#
# The credentials never touch an image layer: the served image is a fresh
# caddy layer with dist/ and the config in it.

FROM node:24.16.0-alpine3.22 AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# A build that cannot read the cms fails loudly instead of shipping an
# empty site; a local build against the host's own cms is fine without
# secrets, because the local cms takes the dev login.
ENV CONTENT_REQUIRED=1 \
    ASTRO_TELEMETRY_DISABLED=1
# The secrets arrive as files under /run/secrets (buildx mounts them),
# whatever the caller passed: the CLI's --secret id=PB_URL,env=PB_URL or
# CI's tmpfile form. They never touch an image layer.
RUN --mount=type=secret,id=PB_URL \
    --mount=type=secret,id=PB_TOKEN \
    PB_URL="$(cat /run/secrets/PB_URL 2>/dev/null || true)" \
    PB_TOKEN="$(cat /run/secrets/PB_TOKEN 2>/dev/null || true)" \
    npm run build

FROM caddy:2.10.2-alpine
COPY deploy/proxy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /build/dist /srv/dist
