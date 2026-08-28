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

build() {
  GOOS="$1" GOARCH="$2" OUT="$OUT_DIR/$3"
  echo "Building $3 ($1/$2)..."
  (cd "$ROOT_DIR/edge" && GOOS="$1" GOARCH="$2" go build -trimpath -ldflags="-s -w" -o "$OUT" .)
}

build linux amd64 ironiq-edge-linux-amd64
build windows amd64 ironiq-edge-windows-amd64.exe
build darwin amd64 ironiq-edge-macos-amd64
build darwin arm64 ironiq-edge-macos-arm64

echo "Edge agent binaries built:"
ls -la "$OUT_DIR"
