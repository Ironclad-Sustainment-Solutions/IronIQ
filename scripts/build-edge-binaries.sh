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
# which downloads Go's own official release directly -- see below for
# why, not apt). Safe to run locally too.
#
# Real incident history this comment exists because of:
# 1. This script's original behavior -- silently skip and exit 0 if `go`
#    isn't found, no matter the context -- combined with the build
#    command's own Go-install step also silently swallowing a failure,
#    meant a hiccup on a single deploy could produce an app that
#    deployed "successfully" with every download link 404ing, with
#    nothing anywhere surfacing that it happened. A customer hit this
#    directly (browser: "Couldn't download -- No file") before anyone at
#    Ironclad knew.
# 2. The fix for that (detect Render's RENDER=true build-time env var,
#    treat a missing `go` as a hard failure in that specific context
#    rather than a quiet no-op) was correct, but initially didn't fully
#    land -- Render's actual configured Build Command in the dashboard
#    had drifted from what render.yaml documented (a separate, real gap:
#    this service wasn't set up to auto-sync its build command from the
#    blueprint file in the repo). Once the dashboard was updated to
#    match, the hard-failure branch above correctly triggered -- which
#    then surfaced a THIRD real problem:
# 3. Installing golang-go via apt was itself unreliable in Render's
#    actual build container -- both the sudo and non-sudo apt install
#    attempts failed there. Rather than keep chasing why a system package
#    manager install isn't working in a container whose exact apt/sudo
#    configuration isn't something this project controls or can fully
#    inspect, render.yaml now downloads Go's own official, self-contained
#    release tarball directly from go.dev and extracts it to /tmp --
#    Go's own documented, standard "no package manager" install method,
#    needing no system privileges at all, just a writable temp
#    directory. This is also exactly what GitHub Actions' own
#    actions/setup-go does under the hood.

set -e

if ! command -v go >/dev/null 2>&1; then
  if [ -n "$RENDER" ]; then
    echo "ERROR: Go toolchain not found during a Render production build." >&2
    echo "This means the Edge agent download binaries cannot be built, and every" >&2
    echo "/downloads/* link on the live site would 404 if this build were allowed" >&2
    echo "to deploy. Failing this build on purpose rather than silently shipping" >&2
    echo "broken downloads -- see render.yaml's buildCommand for the Go install step." >&2
    exit 1
  fi
  echo "Go toolchain not found -- skipping edge agent binary builds (this is fine for local dev/CI; the app itself doesn't need these to build or run)."
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/public/downloads"
mkdir -p "$OUT_DIR"

GIT_SHA="$(cd "$ROOT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")"
# The commit's own timestamp, not the current wall-clock time this
# script happens to run at -- deliberately, not an oversight. Using
# `date -u` here meant every single deploy embedded a different string
# into the binary, even a redeploy of the exact same commit with zero
# code changes, which meant every deploy produced a genuinely different
# file (confirmed directly: identical source, only the embedded
# timestamp differing by one second, produced two completely different
# SHA-256 hashes). That mattered for a real reason beyond tidiness: a
# customer's antivirus flagged the unsigned binary, they allow-listed
# it, then the very next unrelated deploy silently produced a "new"
# file their AV had never seen and flagged again -- forcing them to
# redo the allow-list dance after every deploy, not just after a real
# Edge agent code change. Deriving this from the commit's own timestamp
# instead means rebuilding the identical commit (a Render redeploy with
# no new commits, a retry, etc.) now produces a byte-identical binary --
# confirmed directly by building the same commit twice and diffing the
# output. This doesn't fix AV flagging an unsigned binary in general --
# only code signing does that -- it just stops making the problem worse
# on every deploy that isn't actually a new Edge agent build.
BUILD_DATE="$(cd "$ROOT_DIR" && git show -s --format=%cI HEAD 2>/dev/null || echo "unknown")"
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

# Static, not compiled -- just copied alongside the Windows binary so
# someone installing the service never needs to open a command prompt
# or type anything themselves; it self-elevates and runs the same
# -install-service flag documented in the setup guide.
cp "$ROOT_DIR/edge/install-service.bat" "$OUT_DIR/install-service.bat"

echo "$VERSION (built $BUILD_DATE)" > "$OUT_DIR/VERSION.txt"

(
  cd "$OUT_DIR"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum ironiq-edge-linux-amd64 ironiq-edge-windows-amd64.exe ironiq-edge-macos-amd64 ironiq-edge-macos-arm64 install-service.bat > CHECKSUMS.txt
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 ironiq-edge-linux-amd64 ironiq-edge-windows-amd64.exe ironiq-edge-macos-amd64 ironiq-edge-macos-arm64 install-service.bat > CHECKSUMS.txt
  else
    echo "Neither sha256sum nor shasum found -- CHECKSUMS.txt not generated." >&2
  fi
)

echo "Edge agent binaries built (version $VERSION):"
ls -la "$OUT_DIR"
