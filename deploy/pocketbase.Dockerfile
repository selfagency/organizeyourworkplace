# PocketBase build from a pinned release binary.
# The project's new home is ganigeorgiev.com/pocketbase/pocketbase (the GitHub
# repo is archived). Verified 2026-10-27: the release paths on the new home
# answer with an HTML page, not the asset, so GitHub stays the first source.
# The fallback is only accepted when the file really is a zip.
FROM alpine:3.20

ARG PB_VERSION=0.40.6
ARG PB_ARCH=linux_amd64

RUN apk add --no-cache unzip ca-certificates \
 && (wget -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip" \
     || (wget -q -O /tmp/pb.zip "https://ganigeorgiev.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip" \
         && unzip -t /tmp/pb.zip > /dev/null 2>&1)) \
 && unzip -t /tmp/pb.zip > /dev/null \
 && unzip /tmp/pb.zip -d /pb \
 && rm /tmp/pb.zip \
 && chmod +x /pb/pocketbase

EXPOSE 8090
WORKDIR /pb
ENTRYPOINT ["/pb/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090"]