# PocketBase build from a pinned release binary.
# Source of truth: ganigeorgiev.com/pocketbase/pocketbase (project left GitHub 2026-10-26).
# TODO(owner): set PB_VERSION to the exact release and confirm the download URL
# pattern on the new home page before the first build.
FROM alpine:3.20

ARG PB_VERSION=TODO-pin
ARG PB_ARCH=linux_amd64

RUN apk add --no-cache unzip ca-certificates \
 && wget -O /tmp/pb.zip "https://ganigeorgiev.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip" \
 && unzip /tmp/pb.zip -d /pb \
 && rm /tmp/pb.zip \
 && chmod +x /pb/pocketbase

EXPOSE 8090
WORKDIR /pb
ENTRYPOINT ["/pb/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090"]