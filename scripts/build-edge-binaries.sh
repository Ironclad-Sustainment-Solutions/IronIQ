#!/bin/sh
# Cross-compiles the IronIQ Edge on-prem agent (edge/) for every platform
# a customer might run it on, into public/downloads/ -- Vite/Nitro serve
# everything under public/ as static files, so once this runs, the built
# app serves these directly at /downloads/<filename> with no separate
# hosting, GitHub Release, or CDN needed. Requires only the Go toolchain
# (no third-party packages -- edge/go.mod has zero dependencies), so this
# never needs network access to anywhere other than wherever `go` itself
# was installed from.
#
# Also writes CHECKSUMS.txt (SHA-256 of every binary) and VERSION.txt
# (the git commit this build came from) into the same directory -- lets
# a customer, or their IT/security team, verify a download wasn't
# tampered with in transit, and identifies exactly which build a running
# agent is from. This isn't a substitute for code signing (still
# recommended, still a real gap -- see the setup guide), but it's real,
# free, verifiable integrity checking in the meantime.
#
# Run as part of the production build (see render.yaml's buildCommand,
# which installs Go via apt first). Safe to run locally too -- if `go`
# isn't installed, this exits cleanly with a warning rather than failing
# the whole build, since most local/CI verification (typecheck, lint,
# test, npm run build) has nothing to do with these binaries existing.

set -e

if ! command -v go >/dev/null 2>&1; then
  echo "Go toolchain not found -- skipping edge agent binary builds (this is fine for local dev/CI; the app itself doesn't need these to build or run)."
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/public/downloads"
mkdir -p "$OUT_DIR"

GIT_SHA="$(cd "$ROOT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")"
BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
VERSION="$GIT_SHA"
LDFLAGS="-s -w -X main.version=$VERSION -X main.buildDate=$BUILD_DATE"

build() {
  GOOS="$1" GOARCH="$2" OUT="$OUT_DIR/$3"
  echo "Building $3 ($1/$2) version $VERSION..."
  (cd "$ROOT_DIR/edge" && GOOS="$1" GOARCH="$2" go build -trimpath -ldflags="$LDFLAGS" -o "$OUT" .)
}

build linux amd64 ironiq-edge-linux-amd64
build windows amd64 ironiq-edge-windows-amd64.exe
build darwin amd64 ironiq-edge-macos-amd64
build darwin arm64 ironiq-edge-macos-arm64

echo "$VERSION (built $BUILD_DATE)" > "$OUT_DIR/VERSION.txt"

(
  cd "$OUT_DIR"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum ironiq-edge-linux-amd64 ironiq-edge-windows-amd64.exe ironiq-edge-macos-amd64 ironiq-edge-macos-arm64 > CHECKSUMS.txt
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 ironiq-edge-linux-amd64 ironiq-edge-windows-amd64.exe ironiq-edge-macos-amd64 ironiq-edge-macos-arm64 > CHECKSUMS.txt
  else
    echo "Neither sha256sum nor shasum found -- CHECKSUMS.txt not generated." >&2
  fi
)

echo "Edge agent binaries built (version $VERSION):"
ls -la "$OUT_DIR"
