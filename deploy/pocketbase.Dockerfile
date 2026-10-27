# PocketBase build from a pinned release binary.
# The project announced a move to ganigeorgiev.com/pocketbase/pocketbase, but
# the release asset for the pinned version is still on the GitHub release
# (checked 2026-10-27: HTTP 200, 12.8 MB). When the new home serves the
# assets, switch the URL and drop the old one.
FROM alpine:3.20

ARG PB_VERSION=0.40.6
ARG PB_ARCH=linux_amd64

RUN apk add --no-cache unzip ca-certificates \
 && wget -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip" \
 && unzip -t /tmp/pb.zip > /dev/null \
 && unzip /tmp/pb.zip -d /pb \
 && rm /tmp/pb.zip \
 && chmod +x /pb/pocketbase

EXPOSE 8090
WORKDIR /pb
ENTRYPOINT ["/pb/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090"]