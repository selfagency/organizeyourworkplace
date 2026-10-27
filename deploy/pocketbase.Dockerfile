# PocketBase build from a pinned release binary.
# v0.40.6 assets verified on the GitHub release (2026-10-26). The project's
# announced new home (ganigeorgiev.com/pocketbase/pocketbase) does not serve
# release downloads yet — TODO(verify): recheck before the production build.
FROM alpine:3.20

ARG PB_VERSION=0.40.6
ARG PB_ARCH=linux_amd64

RUN apk add --no-cache unzip ca-certificates \
 && wget -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip" \
 && unzip /tmp/pb.zip -d /pb \
 && rm /tmp/pb.zip \
 && chmod +x /pb/pocketbase

EXPOSE 8090
WORKDIR /pb
ENTRYPOINT ["/pb/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090"]